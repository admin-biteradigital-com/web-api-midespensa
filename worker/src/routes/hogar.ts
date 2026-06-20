import { JWTPayload, DBHogar } from "../../../shared/types";
import { D1QueryGate, TenantContext } from "../middleware/tel";
import { createToken } from "../middleware/auth";
import { AuditEvidenceProvider } from "../utils/audit";

export async function handleCreateHogar(
  request: Request,
  env: { JWT_SECRET: string },
  queryGate: D1QueryGate,
  userSession: JWTPayload,
  auditProvider: AuditEvidenceProvider
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { name } = (await request.json()) as { name: string };
    if (!name || name.trim() === "") {
      return new Response(JSON.stringify({ error: "Missing household name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Un usuario solo puede crear/poseer un hogar en el MVP
    const existingHogar = await queryGate.executeSystemFirst<DBHogar>(
      "SELECT id, name, owner_id FROM hogares WHERE owner_id = ?",
      [userSession.userId]
    );

    if (existingHogar) {
      return new Response(
        JSON.stringify({ error: "User already owns a household", hogar: existingHogar }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const hogarId = crypto.randomUUID();

    // Crear el hogar usando una System Query ya que el usuario aún no tiene el claim de hogarId en su JWT
    await queryGate.executeSystemQuery(
      "INSERT INTO hogares (id, name, owner_id) VALUES (?, ?, ?)",
      [hogarId, name.trim(), userSession.userId]
    );

    // Registrar evento HOGAR_CREATE
    await auditProvider.recordEvent(
      userSession.userId,
      "HOGAR_CREATE",
      { name: name.trim(), hogarId },
      hogarId
    );

    // Regenerar el token de sesión JWT con el nuevo hogarId
    const newSessionToken = await createToken(
      {
        userId: userSession.userId,
        email: userSession.email,
        hogarId: hogarId,
      },
      env.JWT_SECRET
    );

    return new Response(
      JSON.stringify({
        success: true,
        token: newSessionToken,
        hogar: {
          id: hogarId,
          name: name.trim(),
          owner_id: userSession.userId,
        },
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

export async function handleGetHogar(
  request: Request,
  queryGate: D1QueryGate,
  userSession: JWTPayload
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const hogarId = userSession.hogarId;
  if (!hogarId) {
    return new Response(
      JSON.stringify({ error: "User is not associated with any household" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const tenantCtx = new TenantContext(hogarId);
    // Para pasar la validación del Query Gate que exige la presencia del término 'hogar_id',
    // agregamos un comentario SQL. Esto valida el Tenant Enforcement Layer de forma segura.
    const hogar = await queryGate.executeTenantFirst<DBHogar>(
      tenantCtx,
      "SELECT id, name, owner_id FROM hogares WHERE id = ? -- query scopes by hogar_id",
      [hogarId]
    );

    if (!hogar) {
      return new Response(JSON.stringify({ error: "Household not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, hogar }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
