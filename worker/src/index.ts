import { authMiddleware } from "./middleware/auth";
import { D1QueryGate } from "./middleware/tel";
import { handleMagicLink, handleVerifyMagicLink } from "./routes/auth";
import { handleCreateHogar, handleGetHogar } from "./routes/hogar";
import { handleGetInventory, handleInventoryAdd, handleInventoryRemove } from "./routes/inventory";
import { handleGetEventsStock } from "./routes/events";
import { runSmokeTests } from "./tests/smoke.test";
import { API_ROUTES } from "../../shared/constants";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ENCRYPTION_KEY_HEX: string;
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
      const resp = await handleMagicLink(request, env, queryGate);
      return injectCors(resp);
    }
    
    if (path === API_ROUTES.AUTH_VERIFY) {
      const resp = await handleVerifyMagicLink(request, env, queryGate);
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
          return injectCors(await handleCreateHogar(request, env, queryGate, userSession));
        } else if (request.method === "GET") {
          return injectCors(await handleGetHogar(request, queryGate, userSession));
        }
      }

      if (path === API_ROUTES.INVENTORY) {
        return injectCors(await handleGetInventory(request, queryGate, userSession));
      }

      if (path === API_ROUTES.INVENTORY_ADD) {
        return injectCors(await handleInventoryAdd(request, queryGate, userSession));
      }

      if (path === API_ROUTES.INVENTORY_REMOVE) {
        return injectCors(await handleInventoryRemove(request, queryGate, userSession));
      }

      if (path === API_ROUTES.EVENTS) {
        return injectCors(await handleGetEventsStock(request, queryGate, userSession));
      }

      // Ruta no encontrada
      return injectCors(
        new Response(JSON.stringify({ error: "Ruta no encontrada" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      );
    } catch (err: any) {
      return injectCors(
        new Response(JSON.stringify({ error: "Error interno", details: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      );
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
