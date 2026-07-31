/**
 * Sprint 5 Coverage Tests
 * Covers: handleRestockItem, handleGetShoppingList (enriched paths),
 *         handleGetVapidKey, handlePushSubscribe, handlePushUnsubscribe
 *
 * Target: push inventory.ts coverage from 64% → ≥85%, add push.ts coverage.
 * Bitera Digital SAS — 2026-07-31
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleGetShoppingList, handleRestockItem } from "../routes/inventory";
import { handleGetVapidKey, handlePushSubscribe, handlePushUnsubscribe } from "../routes/push";
import { D1QueryGate } from "../middleware/tel";
import { JWTPayload } from "../../../shared/types";

// ─────────────────────────────────────────────────────────────────────────────
// Shared mocks
// ─────────────────────────────────────────────────────────────────────────────
const mockAuditProvider = {
  recordEvent: vi.fn().mockResolvedValue(undefined),
};

function buildMockDb(overrides: Partial<{
  allResults: any[];
  firstResult: any;
  runResult: any;
}> = {}) {
  const {
    allResults = [],
    runResult = { meta: { changes: 1 } },
  } = overrides;

  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: allResults }),
        run: vi.fn().mockResolvedValue(runResult),
        first: vi.fn().mockResolvedValue(allResults[0] ?? null),
      }),
    }),
    batch: vi.fn().mockResolvedValue([]),
  };
}

const validSession: JWTPayload = {
  userId: "user-abc",
  email: "user@example.com",
  hogarId: "hogar-xyz",
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const noHogarSession: JWTPayload = {
  userId: "user-abc",
  email: "user@example.com",
  hogarId: null as any,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

// ─────────────────────────────────────────────────────────────────────────────
// handleGetShoppingList — enriched paths
// ─────────────────────────────────────────────────────────────────────────────
describe("handleGetShoppingList (Sprint 5 enriched)", () => {
  it("returns 405 for non-GET methods", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list", { method: "DELETE" });
    const res = await handleGetShoppingList(req, gate, validSession);
    expect(res.status).toBe(405);
  });

  it("returns 400 when hogarId is missing", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list");
    const res = await handleGetShoppingList(req, gate, noHogarSession);
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toContain("household");
  });

  it("returns enriched shopping list with last_price chip", async () => {
    const db = buildMockDb({
      allResults: [
        {
          id: "prod-1",
          hogar_id: "hogar-xyz",
          product_name: "Leche",
          quantity: 0,
          min_stock: 2,
          category: "Lácteos",
          updated_at: new Date().toISOString(),
          last_price: 55.5,
          last_currency: "UYU",
        },
      ],
    });
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list");
    const res = await handleGetShoppingList(req, gate, validSession);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.shopping_list[0].last_price).toBe(55.5);
    expect(body.shopping_list[0].last_currency).toBe("UYU");
  });

  it("returns empty list when all items are above min_stock", async () => {
    const db = buildMockDb({ allResults: [] });
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list");
    const res = await handleGetShoppingList(req, gate, validSession);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.shopping_list).toHaveLength(0);
  });

  it("returns 500 on DB error", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockRejectedValue(new Error("D1 failure")),
        }),
      }),
      batch: vi.fn(),
    };
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list");
    const res = await handleGetShoppingList(req, gate, validSession);
    expect(res.status).toBe(500);
    const body: any = await res.json();
    expect(body.error).toBe("D1 failure");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleRestockItem
// ─────────────────────────────────────────────────────────────────────────────
describe("handleRestockItem (Sprint 5)", () => {
  const mockProduct = {
    id: "prod-1",
    product_name: "Leche",
    quantity: 1,
    min_stock: 3,
    hogar_id: "hogar-xyz",
  };

  it("returns 405 for non-POST methods", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list/restock", { method: "GET" });
    const res = await handleRestockItem(req, gate, validSession, mockAuditProvider as any);
    expect(res.status).toBe(405);
  });

  it("returns 400 when hogarId is missing", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod-1" }),
    });
    const res = await handleRestockItem(req, gate, noHogarSession, mockAuditProvider as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await handleRestockItem(req, gate, validSession, mockAuditProvider as any);
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });

  it("returns 400 when product_id is missing from body", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await handleRestockItem(req, gate, validSession, mockAuditProvider as any);
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toContain("product_id");
  });

  it("returns 404 when product is not found in hogar", async () => {
    const db = buildMockDb({ allResults: [] });
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "nonexistent" }),
    });
    const res = await handleRestockItem(req, gate, validSession, mockAuditProvider as any);
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.error).toContain("not found");
  });

  it("restocks item to min_stock + 1 and returns new_quantity", async () => {
    const db = buildMockDb({ allResults: [mockProduct] });
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod-1" }),
    });
    const res = await handleRestockItem(req, gate, validSession, mockAuditProvider as any);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.product_name).toBe("Leche");
    // new_quantity = 1 (current) + (3 + 1 - 1 = 3 added) = 4
    expect(body.new_quantity).toBe(4);
    expect(mockAuditProvider.recordEvent).toHaveBeenCalledWith(
      validSession.userId,
      "RESTOCK_FROM_SHOPPING_LIST",
      expect.objectContaining({ product_id: "prod-1" }),
      "hogar-xyz"
    );
  });

  it("uses explicit quantity_added when provided", async () => {
    const db = buildMockDb({ allResults: [mockProduct] });
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod-1", quantity_added: 10 }),
    });
    const res = await handleRestockItem(req, gate, validSession, mockAuditProvider as any);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    // new_quantity = 1 (current) + 10 = 11
    expect(body.new_quantity).toBe(11);
  });

  it("returns 500 on DB error during restock", async () => {
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce({
          // First prepare = SELECT (executeTenantQuery)
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [mockProduct] }),
          }),
        })
        .mockReturnValueOnce({
          // Second prepare = UPDATE — throws
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockRejectedValue(new Error("D1 write error")),
          }),
        }),
      batch: vi.fn(),
    };
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/shopping-list/restock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod-1" }),
    });
    const res = await handleRestockItem(req, gate, validSession, mockAuditProvider as any);
    expect(res.status).toBe(500);
    const body: any = await res.json();
    expect(body.error).toBe("D1 write error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleGetVapidKey
// ─────────────────────────────────────────────────────────────────────────────
describe("handleGetVapidKey (Sprint 5)", () => {
  it("returns 405 for non-GET requests", async () => {
    const req = new Request("http://localhost/api/v1/push/vapid-key", { method: "POST" });
    const res = await handleGetVapidKey(req, { VAPID_PUBLIC_KEY: "test-key" } as any);
    expect(res.status).toBe(405);
  });

  it("returns 503 when VAPID_PUBLIC_KEY is not configured", async () => {
    const req = new Request("http://localhost/api/v1/push/vapid-key");
    const res = await handleGetVapidKey(req, {} as any);
    expect(res.status).toBe(503);
    const body: any = await res.json();
    expect(body.push_enabled).toBe(false);
  });

  it("returns vapid_public_key and push_enabled: true when configured", async () => {
    const req = new Request("http://localhost/api/v1/push/vapid-key");
    const res = await handleGetVapidKey(req, { VAPID_PUBLIC_KEY: "BHDCh9L4Uxs..." } as any);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.push_enabled).toBe(true);
    expect(body.vapid_public_key).toBe("BHDCh9L4Uxs...");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handlePushSubscribe
// ─────────────────────────────────────────────────────────────────────────────
describe("handlePushSubscribe (Sprint 5)", () => {
  const validBody = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
    keys: { p256dh: "test-p256dh", auth: "test-auth" },
  };

  it("returns 405 for non-POST requests", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", { method: "GET" });
    const res = await handlePushSubscribe(req, gate, validSession);
    expect(res.status).toBe(405);
  });

  it("returns 400 when hogarId is missing", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await handlePushSubscribe(req, gate, noHogarSession);
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON body", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-json",
    });
    const res = await handlePushSubscribe(req, gate, validSession);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://fcm.test" }),  // missing keys
    });
    const res = await handlePushSubscribe(req, gate, validSession);
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toContain("Missing required fields");
  });

  it("registers push subscription successfully and returns 200", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await handlePushSubscribe(req, gate, validSession);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("push_subscriptions"));
  });

  it("returns 500 on DB error", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error("D1 insert error")),
        }),
      }),
      batch: vi.fn(),
    };
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await handlePushSubscribe(req, gate, validSession);
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handlePushUnsubscribe
// ─────────────────────────────────────────────────────────────────────────────
describe("handlePushUnsubscribe (Sprint 5)", () => {
  it("returns 405 for non-DELETE requests", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", { method: "POST" });
    const res = await handlePushUnsubscribe(req, gate, validSession);
    expect(res.status).toBe(405);
  });

  it("returns 400 when hogarId is missing", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", { method: "DELETE" });
    const res = await handlePushUnsubscribe(req, gate, noHogarSession);
    expect(res.status).toBe(400);
  });

  it("deletes specific endpoint when provided in body", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://fcm.test/endpoint" }),
    });
    const res = await handlePushUnsubscribe(req, gate, validSession);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    // Should use 3-param DELETE with specific endpoint
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("endpoint = ?")
    );
  });

  it("deletes all subscriptions for user when no endpoint provided", async () => {
    const db = buildMockDb();
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await handlePushUnsubscribe(req, gate, validSession);
    expect(res.status).toBe(200);
    // Should use 2-param DELETE without endpoint
    expect(db.prepare).toHaveBeenCalledWith(
      expect.not.stringContaining("endpoint = ?")
    );
  });

  it("returns 500 on DB error", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error("D1 delete error")),
        }),
      }),
      batch: vi.fn(),
    };
    const gate = new D1QueryGate(db as any);
    const req = new Request("http://localhost/api/v1/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "https://fcm.test" }),
    });
    const res = await handlePushUnsubscribe(req, gate, validSession);
    expect(res.status).toBe(500);
  });
});
