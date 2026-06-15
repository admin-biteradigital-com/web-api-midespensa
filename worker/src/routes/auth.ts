import { SignJWT, jwtVerify } from "jose";
import { hashEmail, encryptEmail } from "../utils/crypto";
import { D1QueryGate } from "../middleware/tel";
import { createToken } from "../middleware/auth";
import { DBUser, DBHogar } from "../../../shared/types";

export async function handleMagicLink(
  request: Request,
  env: { JWT_SECRET: string },
  queryGate: D1QueryGate
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { email } = (await request.json()) as { email: string };
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generar un token temporal para el Magic Link (expira en 10 min)
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const tempToken = await new SignJWT({ email })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(secret);

    // En Sprint 0, devolvemos el token y el link de depuración directamente
    const origin = new URL(request.url).origin;
    const debugUrl = `${origin}/api/v1/auth/verify?token=${tempToken}`;

    console.log(`[MAGIC LINK] Email: ${email} | URL: ${debugUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        token: tempToken,
        debugUrl: debugUrl,
        message: "Magic Link generado con éxito. Revisa la consola o usa el debugUrl.",
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function handleVerifyMagicLink(
  request: Request,
  env: { JWT_SECRET: string; ENCRYPTION_KEY_HEX: string },
  queryGate: D1QueryGate
): Promise<Response> {
  // Acepta tanto POST con JSON como GET con query string para mayor flexibilidad de testing manual
  let token = "";
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { token: string };
      token = body.token;
    } catch (_) {}
  } else if (request.method === "GET") {
    const url = new URL(request.url);
    token = url.searchParams.get("token") || "";
  } else {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const email = payload.email as string;

    if (!email) {
      return new Response(JSON.stringify({ error: "Invalid token payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Token inválido o expirado", details: err.message }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
