import { SignJWT, jwtVerify } from "jose";
import { hashEmail, encryptEmail, hashToken } from "../utils/crypto";
import { D1QueryGate } from "../middleware/tel";
import { createToken } from "../middleware/auth";
import { DBUser, DBHogar } from "../../../shared/types";
import { sendMagicLink } from "../utils/mail";
import { AuditEvidenceProvider } from "../utils/audit";

const securityHeaders = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function handleMagicLink(
  request: Request,
  env: { JWT_SECRET: string; RESEND_API_KEY?: string; ENVIRONMENT?: string; CLIENT_URL?: string },
  queryGate: D1QueryGate,
  auditProvider: AuditEvidenceProvider
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { 
      status: 405, 
      headers: securityHeaders 
    });
  }

  try {
    const { email } = (await request.json()) as { email: string };
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...securityHeaders },
      });
    }

    const emailHash = await hashEmail(email);

    // Registrar evento de solicitud de Magic Link (PII Protegida)
    await auditProvider.recordEvent(
      "SYSTEM_CONTROL_PLANE",
      "AUTH_MAGIC_LINK_REQUESTED",
      { emailHash }
    );

    // Generar un token temporal para el Magic Link (expira en 10 min)
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const tempToken = await new SignJWT({ email, typ: "magic_link" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("biteradigital:midespensa:auth")
      .setAudience("biteradigital:midespensa:app")
      .setExpirationTime("10m")
      .sign(secret);

    // Enforce CLIENT_URL in production, fallback to request origin in local dev
    let clientUrl = env.CLIENT_URL || "https://midespensa.biteradigital.com";
    if (env.ENVIRONMENT === "local") {
      clientUrl = env.CLIENT_URL || new URL(request.url).origin;
    }
    const magicLinkUrl = `${clientUrl}/api/v1/auth/verify?token=${tempToken}`;

    // Envío del email utilizando Resend
    const emailResult = await sendMagicLink(email, magicLinkUrl, env);

    if (!emailResult.success) {
      return new Response(
        JSON.stringify({
          error: "No se pudo enviar el correo de verificación.",
          details: emailResult.error,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...securityHeaders },
        }
      );
    }

    const responseBody: Record<string, any> = {
      success: true,
      message: emailResult.delivered
        ? "Magic Link enviado a tu casilla de correo."
        : "Magic Link generado localmente (revisa logs del servidor).",
    };

    // Si es desarrollo local, se devuelve el debugUrl para agilizar testing y CI/CD
    if (env.ENVIRONMENT === "local" || !emailResult.delivered) {
      responseBody.token = tempToken;
      responseBody.debugUrl = magicLinkUrl;
    }

    return new Response(JSON.stringify(responseBody), {
      headers: { "Content-Type": "application/json", ...securityHeaders },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...securityHeaders },
    });
  }
}

export async function handleVerifyMagicLink(
  request: Request,
  env: { JWT_SECRET: string; ENCRYPTION_KEY_HEX: string; CLIENT_URL?: string; ENVIRONMENT?: string },
  queryGate: D1QueryGate,
  auditProvider: AuditEvidenceProvider
): Promise<Response> {
  // GET handler redirects (307)
  if (request.method === "GET") {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...securityHeaders },
      });
    }

    let clientUrl = env.CLIENT_URL || "https://midespensa.biteradigital.com";
    if (env.ENVIRONMENT === "local") {
      clientUrl = env.CLIENT_URL || new URL(request.url).origin;
    }

    const redirectUrl = `${clientUrl}/?token=${encodeURIComponent(token)}`;
    return new Response(null, {
      status: 307,
      headers: {
        "Location": redirectUrl,
        ...securityHeaders,
      },
    });
  }

  // POST handler verifies and consumes token
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { 
      status: 405,
      headers: securityHeaders
    });
  }

  let token = "";
  try {
    const body = (await request.json()) as { token: string };
    token = body.token;
  } catch (_) {}

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...securityHeaders },
    });
  }

  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      issuer: "biteradigital:midespensa:auth",
      audience: "biteradigital:midespensa:app",
    });

    if (payload.typ !== "magic_link") {
      return new Response(JSON.stringify({ error: "Invalid token type" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...securityHeaders },
      });
    }

    const email = payload.email as string;
    if (!email) {
      return new Response(JSON.stringify({ error: "Invalid token payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...securityHeaders },
      });
    }

    // SHA-256 Hashing of the token for atomic locking
    const tokenHash = await hashToken(token);
    const consumedAt = new Date().toISOString();

    // OTT Atomic Lock: INSERT OR IGNORE and check changes
    const runResult = await queryGate.executeSystemRun(
      "INSERT OR IGNORE INTO consumed_tokens (token_hash, consumed_at) VALUES (?, ?)",
      [tokenHash, consumedAt]
    );

    const changes = runResult.meta?.changes ?? 0;
    if (changes === 0) {
      // Replay attack blocked!
      try {
        await auditProvider.recordEvent(
          "SYSTEM_CONTROL_PLANE",
          "AUTH_FAILED",
          { error: "Token already consumed (replay blocked)", tokenSnippet: token.substring(0, 10) + "..." }
        );
      } catch (auditErr) {
        console.error("Failed to log auth failure event:", auditErr);
      }

      return new Response(
        JSON.stringify({ error: "El token ya ha sido utilizado (replay blocked)" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...securityHeaders },
        }
      );
    }

    const emailHash = await hashEmail(email);

    // Buscar si el usuario ya existe en D1 usando la QueryGate (System Query)
    let user = await queryGate.executeSystemFirst<DBUser>(
      "SELECT id, email, email_encrypted, created_at FROM users WHERE email = ?",
      [emailHash]
    );

    let userId = "";
    if (user) {
      userId = user.id;
    } else {
      // Crear usuario nuevo (3 capas de identidad)
      userId = crypto.randomUUID();
      const encryptedEmail = await encryptEmail(email, env.ENCRYPTION_KEY_HEX);
      const createdAt = new Date().toISOString();

      await queryGate.executeSystemQuery(
        "INSERT INTO users (id, email, email_encrypted, created_at) VALUES (?, ?, ?, ?)",
        [userId, emailHash, encryptedEmail, createdAt]
      );
    }

    // Buscar si posee algún hogar (owner_id = userId)
    const hogar = await queryGate.executeSystemFirst<DBHogar>(
      "SELECT id, name, owner_id FROM hogares WHERE owner_id = ?",
      [userId]
    );

    const hogarId = hogar ? hogar.id : null;

    // Generar el token de sesión JWT de 7 días
    const sessionToken = await createToken(
      {
        userId,
        email: emailHash,
        hogarId,
      },
      env.JWT_SECRET
    );

    // Registrar evento de verificación exitosa (AUTH_SUCCESS)
    await auditProvider.recordEvent(
      userId,
      "AUTH_SUCCESS",
      { email: emailHash, hogarId },
      hogarId
    );

    return new Response(
      JSON.stringify({
        success: true,
        token: sessionToken,
        user: {
          id: userId,
          emailHash,
          hogarId,
        },
      }),
      {
        headers: { "Content-Type": "application/json", ...securityHeaders },
      }
    );
  } catch (err: any) {
    // Registrar evento de verificación fallida (AUTH_FAILED)
    try {
      await auditProvider.recordEvent(
        "SYSTEM_CONTROL_PLANE",
        "AUTH_FAILED",
        { error: err.message, tokenSnippet: token.substring(0, 10) + "..." }
      );
    } catch (auditErr) {
      console.error("Failed to log auth failure event:", auditErr);
    }

    return new Response(
      JSON.stringify({ error: "Token inválido o expirado", details: err.message }),
      {
        status: 401,
        headers: { "Content-Type": "application/json", ...securityHeaders },
      }
    );
  }
}
