import { authMiddleware } from "./middleware/auth";
import { D1QueryGate } from "./middleware/tel";
import { handleMagicLink, handleVerifyMagicLink } from "./routes/auth";
import { handleCreateHogar, handleGetHogar, handleJoinHogar } from "./routes/hogar";
import { handleGetInventory, handleInventoryAdd, handleInventoryRemove, handleRebuildInventory, handleGetShoppingList, handleRestockItem } from "./routes/inventory";
import { handleRecordPrice, handleGetPriceHistory } from "./routes/prices";
import { handleGetEventsStock, handleRecordAuditLog } from "./routes/events";
import { handleGetVapidKey, handlePushSubscribe, handlePushUnsubscribe, DBPushSubscription, sendWebPush } from "./routes/push";
import { runSmokeTests } from "./utils/smoke";
import { API_ROUTES } from "../../shared/constants";
import { D1AuditEvidenceProvider } from "./utils/audit";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ENCRYPTION_KEY_HEX: string;
  RESEND_API_KEY?: string;
  ENVIRONMENT?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PATCH, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Manejo de peticiones pre-flight CORS OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    const queryGate = new D1QueryGate(env.DB);
    const auditProvider = new D1AuditEvidenceProvider(queryGate, env.JWT_SECRET);

    // Endpoint público para pruebas de humo / verificación
    if (path === "/api/v1/test") {
      const success = await runSmokeTests();
      return injectCors(
        new Response(
          JSON.stringify({
            success,
            message: success ? "Todas las pruebas pasaron con éxito" : "Pruebas fallidas",
          }),
          {
            status: success ? 200 : 500,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    }

    // Rutas Públicas de Autenticación
    if (path === API_ROUTES.AUTH_MAGIC_LINK) {
      const resp = await handleMagicLink(request, env, queryGate, auditProvider);
      return injectCors(resp);
    }
    
    if (path === API_ROUTES.AUTH_VERIFY) {
      const resp = await handleVerifyMagicLink(request, env, queryGate, auditProvider);
      return injectCors(resp);
    }

    // Validación de Token JWT para Rutas Protegidas
    const userSession = await authMiddleware(request, env);
    if (!userSession) {
      return injectCors(
        new Response(JSON.stringify({ error: "No autorizado: Token JWT inválido o ausente" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      );
    }

    // Enrutamiento de Rutas Protegidas
    try {
      if (path === API_ROUTES.HOGAR) {
        if (request.method === "POST") {
          return injectCors(await handleCreateHogar(request, env, queryGate, userSession, auditProvider));
        } else if (request.method === "GET") {
          return injectCors(await handleGetHogar(request, queryGate, userSession));
        }
      }

      if (path === API_ROUTES.HOGAR_JOIN && request.method === "POST") {
        return injectCors(await handleJoinHogar(request, env, queryGate, userSession, auditProvider));
      }

      if (path === API_ROUTES.INVENTORY) {
        return injectCors(await handleGetInventory(request, queryGate, userSession));
      }

      if (path === API_ROUTES.INVENTORY_ADD) {
        return injectCors(await handleInventoryAdd(request, queryGate, userSession, auditProvider));
      }

      if (path === API_ROUTES.INVENTORY_REMOVE) {
        return injectCors(await handleInventoryRemove(request, queryGate, userSession, auditProvider));
      }

      if (path === API_ROUTES.SHOPPING_LIST) {
        return injectCors(await handleGetShoppingList(request, queryGate, userSession));
      }

      if (path === API_ROUTES.SHOPPING_RESTOCK && request.method === "POST") {
        return injectCors(await handleRestockItem(request, queryGate, userSession, auditProvider));
      }

      if (path === API_ROUTES.PUSH_VAPID_KEY) {
        return injectCors(await handleGetVapidKey(request, env));
      }

      if (path === API_ROUTES.PUSH_SUBSCRIBE) {
        if (request.method === "POST") {
          return injectCors(await handlePushSubscribe(request, queryGate, userSession));
        } else if (request.method === "DELETE") {
          return injectCors(await handlePushUnsubscribe(request, queryGate, userSession));
        }
      }

      if (path === API_ROUTES.PRICES) {
        if (request.method === "POST") {
          return injectCors(await handleRecordPrice(request, queryGate, userSession, auditProvider));
        } else if (request.method === "GET") {
          return injectCors(await handleGetPriceHistory(request, queryGate, userSession));
        }
      }

      if (path === API_ROUTES.EVENTS) {
        return injectCors(await handleGetEventsStock(request, queryGate, userSession));
      }

      if (path === "/api/v1/admin/rebuild-inventory") {
        return injectCors(await handleRebuildInventory(request, queryGate, userSession));
      }

      if (path === "/api/v1/admin/audit-log") {
        return injectCors(await handleRecordAuditLog(request, queryGate, userSession, auditProvider));
      }

      // Ruta no encontrada
      return injectCors(
        new Response(JSON.stringify({ error: "Ruta no encontrada" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      );
    } catch (err: any) {
      if (err.message.includes("SECURE_GATE_VIOLATION")) {
        try {
          await auditProvider.recordEvent(
            userSession.userId,
            "TENANT_BREACH_ATTEMPT",
            { error: err.message, url: request.url },
            userSession.hogarId
          );
        } catch (auditErr) {
          console.error("Failed to log breach attempt:", auditErr);
        }
      }

      return injectCors(
        new Response(JSON.stringify({ error: "Error interno", details: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
  },

  // ── Scheduled Trigger: Daily Low-Stock Push Notifications ─────────────────
  // cron: "0 11 * * *" (11:00 UTC = 08:00 UYU) — configured in wrangler.toml
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) {
      console.log("[PUSH-CRON] VAPID keys not configured, skipping push notifications.");
      return;
    }

    const queryGate = new D1QueryGate(env.DB);
    const subject = env.VAPID_SUBJECT ?? "mailto:admin@biteradigital.com";

    try {
      // Find all products at or below min_stock across all hogares
      const lowStockItems = await env.DB
        .prepare(`SELECT DISTINCT i.hogar_id, i.product_name, i.quantity, i.min_stock
                  FROM inventario i
                  WHERE i.quantity <= i.min_stock
                  LIMIT 100`)
        .all();

      if (!lowStockItems.results || lowStockItems.results.length === 0) {
        console.log("[PUSH-CRON] No low-stock items found, no notifications sent.");
        return;
      }

      // Group by hogar
      const byHogar = new Map<string, string[]>();
      for (const row of lowStockItems.results as any[]) {
        const list = byHogar.get(row.hogar_id) ?? [];
        list.push(`${row.product_name} (${row.quantity}/${row.min_stock})`);
        byHogar.set(row.hogar_id, list);
      }

      // Send push notification to each hogar's subscribers
      for (const [hogarId, products] of byHogar.entries()) {
        const subs = await env.DB
          .prepare("SELECT * FROM push_subscriptions WHERE hogar_id = ?")
          .bind(hogarId)
          .all<DBPushSubscription>();

        if (!subs.results || subs.results.length === 0) continue;

        const payload = {
          title: "🛒 Mi Despensa — Stock Bajo",
          body: `Necesitas reponer: ${products.slice(0, 3).join(", ")}${products.length > 3 ? ` y ${products.length - 3} más` : ""}`,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-96.png",
          tag: "low-stock",
          data: { hogarId, url: "/" },
        };

        for (const sub of subs.results) {
          ctx.waitUntil(
            sendWebPush(sub, payload, env.VAPID_PRIVATE_KEY!, env.VAPID_PUBLIC_KEY!, subject)
              .then(r => console.log(`[PUSH-CRON] Sent to ${sub.user_id}: ok=${r.ok} status=${r.status}`))
              .catch(e => console.error("[PUSH-CRON] Error:", e))
          );
        }
      }
    } catch (err) {
      console.error("[PUSH-CRON] Scheduled trigger error:", err);
    }
  },
};


function injectCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
