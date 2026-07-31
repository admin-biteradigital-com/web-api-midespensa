import { JWTPayload, DBInventario } from "../../../shared/types";
import { D1QueryGate, TenantContext } from "../middleware/tel";
import { AuditEvidenceProvider } from "../utils/audit";
import { hashEmail } from "../utils/crypto";

export async function handleGetInventory(
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
    const items = await queryGate.executeTenantQuery<DBInventario>(
      tenantCtx,
      "SELECT id, hogar_id, product_name, quantity, min_stock, category, updated_at FROM inventario WHERE hogar_id = ? ORDER BY product_name ASC",
      [hogarId]
    );

    return new Response(JSON.stringify({ success: true, inventory: items }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function handleInventoryAdd(
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
    const { product_name, quantity_delta, category } = (await request.json()) as {
      product_name: string;
      quantity_delta: number;
      category?: string;
    };

    if (!product_name || product_name.trim() === "" || typeof quantity_delta !== "number" || quantity_delta <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid product_name or quantity_delta. Must be positive." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const nameNormalized = product_name.trim();
    const catNormalized = (category && category.trim()) ? category.trim() : "Almacén";
    const tenantCtx = new TenantContext(hogarId);
    const timestamp = new Date().toISOString();

    // 1. Consultar si ya existe el producto en el inventario de este hogar
    const existing = await queryGate.executeTenantFirst<DBInventario>(
      tenantCtx,
      "SELECT id, hogar_id, product_name, quantity, min_stock, category, updated_at FROM inventario WHERE hogar_id = ? AND product_name = ?",
      [hogarId, nameNormalized]
    );

    let productId = "";
    let inventarioStmt: any;

    if (existing) {
      productId = existing.id;
      const newQty = existing.quantity + quantity_delta;
      
      inventarioStmt = queryGate.prepare(
        "UPDATE inventario SET quantity = ?, category = ?, updated_at = ? WHERE id = ? AND hogar_id = ?"
      ).bind(newQty, catNormalized, timestamp, productId, hogarId);
    } else {
      productId = crypto.randomUUID();
      inventarioStmt = queryGate.prepare(
        "INSERT INTO inventario (id, hogar_id, product_name, quantity, category, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(productId, hogarId, nameNormalized, quantity_delta, catNormalized, timestamp);
    }

    // 2. Preparar el log de eventos (events_stock) - append-only
    const eventId = crypto.randomUUID();
    const eventStmt = queryGate.prepare(
      "INSERT INTO events_stock (id, hogar_id, product_id, event_type, quantity_delta, timestamp, actor_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(eventId, hogarId, productId, "ADD", quantity_delta, timestamp, userSession.userId);

    // 3. Ejecutar de forma atómica en bloque/transacción
    await queryGate.batch([inventarioStmt, eventStmt]);

    const finalQty = existing ? existing.quantity + quantity_delta : quantity_delta;

    // Registrar evento STOCK_MUTATION_ADD en auditoria_legal
    await auditProvider.recordEvent(
      userSession.userId,
      "STOCK_MUTATION_ADD",
      { productId, product_name: nameNormalized, quantity_delta, total_quantity: finalQty },
      hogarId
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Stock incrementado con éxito",
        product: {
          id: productId,
          product_name: nameNormalized,
          quantity: finalQty,
          updated_at: timestamp,
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

export async function handleInventoryRemove(
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
    const { product_name, quantity_delta } = (await request.json()) as {
      product_name: string;
      quantity_delta: number;
    };

    if (!product_name || product_name.trim() === "" || typeof quantity_delta !== "number" || quantity_delta <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid product_name or quantity_delta. Must be positive." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const nameNormalized = product_name.trim();
    const tenantCtx = new TenantContext(hogarId);
    const timestamp = new Date().toISOString();

    // 1. Consultar existencia y stock actual
    const existing = await queryGate.executeTenantFirst<DBInventario>(
      tenantCtx,
      "SELECT id, hogar_id, product_name, quantity, updated_at FROM inventario WHERE hogar_id = ? AND product_name = ?",
      [hogarId, nameNormalized]
    );

    if (!existing) {
      return new Response(
        JSON.stringify({ error: "Product not found in inventory" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const newQty = existing.quantity - quantity_delta;
    if (newQty < 0) {
      return new Response(
        JSON.stringify({ error: "Invariante violada: El stock no puede ser negativo", currentStock: existing.quantity }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. Preparar los statements
    const productId = existing.id;
    let inventarioStmt: any;

    if (newQty === 0) {
      // Si el stock llega a cero, borramos el registro de la vista materializada para limpieza,
      // pero el histórico en events_stock se conserva para siempre.
      inventarioStmt = queryGate.prepare(
        "DELETE FROM inventario WHERE id = ? AND hogar_id = ?"
      ).bind(productId, hogarId);
    } else {
      inventarioStmt = queryGate.prepare(
        "UPDATE inventario SET quantity = ?, updated_at = ? WHERE id = ? AND hogar_id = ?"
      ).bind(newQty, timestamp, productId, hogarId);
    }

    const eventId = crypto.randomUUID();
    // Registramos la reducción con delta negativo
    const eventStmt = queryGate.prepare(
      "INSERT INTO events_stock (id, hogar_id, product_id, event_type, quantity_delta, timestamp, actor_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(eventId, hogarId, productId, "REMOVE", -quantity_delta, timestamp, userSession.userId);

    // 3. Ejecutar de forma atómica
    await queryGate.batch([inventarioStmt, eventStmt]);

    // Registrar evento STOCK_MUTATION_REMOVE en auditoria_legal
    await auditProvider.recordEvent(
      userSession.userId,
      "STOCK_MUTATION_REMOVE",
      { productId, product_name: nameNormalized, quantity_delta, total_quantity: newQty },
      hogarId
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Stock decrementado con éxito",
        product: {
          id: productId,
          product_name: nameNormalized,
          quantity: newQty,
          updated_at: timestamp,
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

export async function handleRebuildInventory(
  request: Request,
  queryGate: D1QueryGate,
  userSession: JWTPayload
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Verificar que el usuario sea admin@biteradigital.com (Control Plane)
  const adminHash = await hashEmail("admin@biteradigital.com");
  if (userSession.email !== adminHash) {
    return new Response(
      JSON.stringify({ error: "Prohibido: Solo identidades del Control Plane pueden reconstruir la vista materializada." }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // 1. Obtener la correspondencia de productId -> product_name desde auditoria_legal
    const auditLogs = await queryGate.executeSystemQuery<{ details: string }>(
      "SELECT details FROM auditoria_legal WHERE action = 'STOCK_MUTATION_ADD'",
      []
    );

    const nameMap = new Map<string, string>();
    for (const log of auditLogs) {
      try {
        const details = JSON.parse(log.details);
        if (details.productId && details.product_name) {
          nameMap.set(details.productId, details.product_name);
        }
      } catch (_) {}
    }

    // 2. Obtener sumatoria de events_stock agrupados por hogar_id y product_id
    const events = await queryGate.executeSystemQuery<{
      hogar_id: string;
      product_id: string;
      quantity: number;
      updated_at: string;
    }>(
      `SELECT hogar_id, product_id, SUM(quantity_delta) as quantity, MAX(timestamp) as updated_at
       FROM events_stock
       GROUP BY hogar_id, product_id
       HAVING SUM(quantity_delta) > 0`,
      []
    );

    // 3. Reconstruir la tabla inventario en una única transacción
    const statements = [
      queryGate.prepare("DELETE FROM inventario")
    ];

    for (const event of events) {
      const name = nameMap.get(event.product_id) || "Producto Recuperado";
      statements.push(
        queryGate.prepare(
          "INSERT INTO inventario (id, hogar_id, product_name, quantity, updated_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(event.product_id, event.hogar_id, name, event.quantity, event.updated_at)
      );
    }

    await queryGate.batch(statements);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Vista materializada 'inventario' reconstruida con éxito a partir de los eventos.",
        rebuiltCount: events.length,
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

export async function handleGetShoppingList(
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
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const tenantCtx = new TenantContext(hogarId);
    // Enrich with last recorded price per product via correlated subquery
    const shoppingItems = await queryGate.executeTenantQuery<DBInventario & { last_price?: number; last_currency?: string }>(
      tenantCtx,
      `SELECT
         i.id, i.hogar_id, i.product_name, i.quantity, i.min_stock, i.category, i.updated_at,
         (SELECT hp.price FROM historial_precios hp
          WHERE hp.hogar_id = i.hogar_id AND hp.product_name = i.product_name
          ORDER BY hp.timestamp DESC LIMIT 1) AS last_price,
         (SELECT hp.currency FROM historial_precios hp
          WHERE hp.hogar_id = i.hogar_id AND hp.product_name = i.product_name
          ORDER BY hp.timestamp DESC LIMIT 1) AS last_currency
       FROM inventario i
       WHERE i.hogar_id = ? AND i.quantity <= i.min_stock
       ORDER BY i.category ASC, i.product_name ASC`,
      [hogarId]
    );

    return new Response(JSON.stringify({ success: true, shopping_list: shoppingItems }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ── POST /api/v1/shopping-list/restock ────────────────────────────────────
// Marks a shopping list item as "purchased": increments quantity to min_stock + 1
// Body: { product_id: string, quantity_added?: number }
export async function handleRestockItem(
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
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { product_id: string; quantity_added?: number };
  try {
    body = await request.json() as { product_id: string; quantity_added?: number };
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!body.product_id) {
    return new Response(
      JSON.stringify({ error: "product_id is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const tenantCtx = new TenantContext(hogarId);
  const now = new Date().toISOString();

  try {
    // Fetch current item to compute new quantity
    const rows = await queryGate.executeTenantQuery<DBInventario>(
      tenantCtx,
      "SELECT id, product_name, quantity, min_stock FROM inventario WHERE id = ? AND hogar_id = ?",
      [body.product_id, hogarId]
    );

    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "Product not found in this hogar" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const item = rows[0];
    const qtyAdded = body.quantity_added ?? ((item.min_stock ?? 0) + 1 - item.quantity);
    const newQty = item.quantity + qtyAdded;

    await queryGate.prepare(
      "UPDATE inventario SET quantity = ?, updated_at = ? WHERE id = ? AND hogar_id = ?"
    ).bind(newQty, now, body.product_id, hogarId).run();

    // Record restock event
    const eventId = crypto.randomUUID();
    await queryGate.prepare(
      `INSERT INTO events_stock (id, hogar_id, product_id, event_type, quantity_delta, timestamp, actor_user_id)
       VALUES (?, ?, ?, 'RESTOCK', ?, ?, ?)`
    ).bind(eventId, hogarId, body.product_id, qtyAdded, now, userSession.userId).run();

    await auditProvider.recordEvent(
      userSession.userId,
      "RESTOCK_FROM_SHOPPING_LIST",
      { product_id: body.product_id, product_name: item.product_name, qty_added: qtyAdded, new_qty: newQty },
      hogarId
    );

    return new Response(
      JSON.stringify({
        success: true,
        product_id: body.product_id,
        product_name: item.product_name,
        new_quantity: newQty,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
