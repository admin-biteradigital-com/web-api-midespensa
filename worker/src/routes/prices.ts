import { JWTPayload, DBHistorialPrecio } from "../../../shared/types";
import { D1QueryGate, TenantContext } from "../middleware/tel";
import { AuditEvidenceProvider } from "../utils/audit";
import { hashEmail } from "../utils/crypto";

export async function handleRecordPrice(
  request: Request,
  queryGate: D1QueryGate,
  userSession: JWTPayload,
  auditProvider: AuditEvidenceProvider
): Promise<Response> {
  if (request.method !== "POST") {
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
    const body: any = await request.json();
    const { product_name, price, currency = "UYU" } = body;

    if (!product_name || typeof product_name !== "string" || product_name.trim() === "") {
      return new Response(JSON.stringify({ error: "Invalid or missing product_name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (typeof price !== "number" || price <= 0) {
      return new Response(JSON.stringify({ error: "Price must be a positive number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const priceId = `price_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();
    const actorUserId = await hashEmail(userSession.email);

    const tenantCtx = new TenantContext(hogarId);
    await queryGate.executeTenantQuery(
      tenantCtx,
      "INSERT INTO historial_precios (id, hogar_id, product_name, price, currency, timestamp, actor_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [priceId, hogarId, product_name.trim(), price, currency.toUpperCase(), timestamp, actorUserId]
    );

    // Audit Evidence Registration
    await auditProvider.recordEvent(
      actorUserId,
      "RECORD_PRICE",
      {
        priceId,
        productName: product_name.trim(),
        price,
        currency,
      },
      hogarId
    );

    return new Response(
      JSON.stringify({
        success: true,
        priceRecord: {
          id: priceId,
          hogar_id: hogarId,
          product_name: product_name.trim(),
          price,
          currency: currency.toUpperCase(),
          timestamp,
          actor_user_id: actorUserId,
        },
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

export async function handleGetPriceHistory(
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

  const url = new URL(request.url);
  const productName = url.searchParams.get("product_name");

  try {
    const tenantCtx = new TenantContext(hogarId);
    let query = "SELECT id, hogar_id, product_name, price, currency, timestamp, actor_user_id FROM historial_precios WHERE hogar_id = ?";
    const params: any[] = [hogarId];

    if (productName && productName.trim() !== "") {
      query += " AND product_name = ?";
      params.push(productName.trim());
    }

    query += " ORDER BY timestamp DESC LIMIT 50";

    const prices = await queryGate.executeTenantQuery<DBHistorialPrecio>(tenantCtx, query, params);

    return new Response(JSON.stringify({ success: true, price_history: prices }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
