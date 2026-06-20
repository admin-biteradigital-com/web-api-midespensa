import { JWTPayload, DBEventStock } from "../../../shared/types";
import { D1QueryGate, TenantContext } from "../middleware/tel";
import { AuditEvidenceProvider } from "../utils/audit";
import { hashEmail } from "../utils/crypto";

export async function handleGetEventsStock(
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
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const tenantCtx = new TenantContext(hogarId);
    const events = await queryGate.executeTenantQuery<DBEventStock>(
      tenantCtx,
      "SELECT id, hogar_id, product_id, event_type, quantity_delta, timestamp, actor_user_id FROM events_stock WHERE hogar_id = ? ORDER BY timestamp DESC",
      [hogarId]
    );

    return new Response(JSON.stringify({ success: true, events }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function handleRecordAuditLog(
  request: Request,
  queryGate: D1QueryGate,
  userSession: JWTPayload,
  auditProvider: AuditEvidenceProvider
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Verificar que el usuario sea admin@biteradigital.com (Control Plane)
  const adminHash = await hashEmail("admin@biteradigital.com");
  if (userSession.email !== adminHash) {
    return new Response(
      JSON.stringify({ error: "Prohibido: Solo identidades del Control Plane pueden registrar eventos de auditoría." }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await request.json() as any;
    const { actorId, action, details, hogarId } = body;

    if (!actorId || !action || !details) {
      return new Response(
        JSON.stringify({ error: "Campos requeridos faltantes: actorId, action, details" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await auditProvider.recordEvent(actorId, action, details, hogarId || null);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Evento de auditoría registrado con éxito.",
      }),
      {
        status: 201,
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

