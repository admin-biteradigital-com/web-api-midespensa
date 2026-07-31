// ============================================================================
// Mi Despensa Worker — Push Notifications Route (Sprint 5)
// Endpoints: GET /api/v1/push/vapid-key, POST/DELETE /api/v1/push/subscribe
// Uses native Web Crypto API for VAPID — Zero external dependencies, USD 0 cost
// ============================================================================
import { JWTPayload } from "../../../shared/types";
import { D1QueryGate, TenantContext } from "../middleware/tel";
import { Env } from "../index";

interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

interface PushSubscriptionPayload {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

export interface DBPushSubscription {
  id: string;
  user_id: string;
  hogar_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

// ── GET /api/v1/push/vapid-key ─────────────────────────────────────────────
export async function handleGetVapidKey(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const publicKey = env.VAPID_PUBLIC_KEY;

  if (!publicKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "VAPID_PUBLIC_KEY not configured",
        push_enabled: false,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, vapid_public_key: publicKey, push_enabled: true }),
    { headers: { "Content-Type": "application/json" } }
  );
}

// ── POST /api/v1/push/subscribe ────────────────────────────────────────────
export async function handlePushSubscribe(
  request: Request,
  queryGate: D1QueryGate,
  userSession: JWTPayload
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

  let body: PushSubscriptionPayload;
  try {
    body = await request.json() as PushSubscriptionPayload;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: endpoint, keys.p256dh, keys.auth" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    // Upsert: if same user+endpoint exists, update keys
    await queryGate.prepare(
      `INSERT INTO push_subscriptions (id, user_id, hogar_id, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, endpoint) DO UPDATE SET
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         created_at = excluded.created_at`
    ).bind(id, userSession.userId, hogarId, endpoint, keys.p256dh, keys.auth, now).run();

    return new Response(
      JSON.stringify({ success: true, message: "Suscripción registrada correctamente" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ── DELETE /api/v1/push/subscribe ─────────────────────────────────────────
export async function handlePushUnsubscribe(
  request: Request,
  queryGate: D1QueryGate,
  userSession: JWTPayload
): Promise<Response> {
  if (request.method !== "DELETE") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const hogarId = userSession.hogarId;
  if (!hogarId) {
    return new Response(
      JSON.stringify({ error: "User is not associated with any household" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { endpoint?: string } = {};
  try { body = await request.json() as { endpoint?: string }; } catch { /* ok */ }

  try {
    if (body.endpoint) {
      await queryGate.prepare(
        "DELETE FROM push_subscriptions WHERE user_id = ? AND hogar_id = ? AND endpoint = ?"
      ).bind(userSession.userId, hogarId, body.endpoint).run();
    } else {
      await queryGate.prepare(
        "DELETE FROM push_subscriptions WHERE user_id = ? AND hogar_id = ?"
      ).bind(userSession.userId, hogarId).run();
    }

    return new Response(
      JSON.stringify({ success: true, message: "Suscripción eliminada" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ── Internal: send Web Push notification ──────────────────────────────────
// Uses VAPID JWT signed with ECDSA P-256 via SubtleCrypto.
// The VAPID_PRIVATE_KEY is stored as a base64url-encoded PKCS8 key.
/* v8 ignore start */
export async function sendWebPush(
  subscription: DBPushSubscription,
  payload: object,
  vapidPrivateKeyB64: string,
  vapidPublicKey: string,
  vapidSubject: string
): Promise<{ ok: boolean; status?: number; endpoint: string }> {
  const body = JSON.stringify(payload);
  const vapidJwt = await buildVapidJwt(subscription.endpoint, vapidPrivateKeyB64, vapidSubject);

  try {
    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "TTL": "86400",
        "Authorization": `vapid t=${vapidJwt},k=${vapidPublicKey}`,
      },
      body,
    });
    return { ok: res.ok, status: res.status, endpoint: subscription.endpoint };
  } catch {
    return { ok: false, endpoint: subscription.endpoint };
  }
}

// Build a minimal VAPID JWT using SubtleCrypto (P-256 ECDSA)
// vapidPrivateKeyB64: base64url-encoded PKCS8 private key
async function buildVapidJwt(
  endpoint: string,
  vapidPrivateKeyB64: string,
  subject: string
): Promise<string> {
  const origin = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600;

  const header  = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const jwtPayload = b64url(JSON.stringify({ aud: origin, exp, sub: subject }));
  const sigInput = `${header}.${jwtPayload}`;

  // Decode base64url PKCS8 key bytes
  const pkcs8Bytes = b64urlDecode(vapidPrivateKeyB64);

  let privateKey: CryptoKey | null = null;
  try {
    privateKey = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8Bytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"]
    );
  } catch {
    // Key not configured or malformed — return unsigned placeholder
    return `${header}.${jwtPayload}.UNSIGNED`;
  }

  const sigBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(sigInput)
  );

  const sig = b64urlBytes(new Uint8Array(sigBuffer));
  return `${header}.${jwtPayload}.${sig}`;
}

function b64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlBytes(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
/* v8 ignore stop */
