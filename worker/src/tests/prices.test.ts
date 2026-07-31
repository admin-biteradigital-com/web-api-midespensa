import { describe, it, expect, beforeEach } from "vitest";
import { handleRecordPrice, handleGetPriceHistory } from "../routes/prices";
import { D1QueryGate } from "../middleware/tel";
import { JWTPayload } from "../../../shared/types";

describe("Price History API Endpoints", () => {
  let mockDb: any;
  let queryGate: D1QueryGate;
  let mockAuditProvider: any;
  const mockUserSession: JWTPayload = {
    userId: "user-123",
    email: "user@example.com",
    hogarId: "hogar-789",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(() => {
    mockDb = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          run: async () => ({ success: true, meta: { changes: 1 } }),
          all: async () => {
            if (sql.includes("FROM historial_precios")) {
              return {
                success: true,
                results: [
                  {
                    id: "price-1",
                    hogar_id: "hogar-789",
                    product_name: "Leche",
                    price: 48.5,
                    currency: "UYU",
                    timestamp: new Date().toISOString(),
                    actor_user_id: "actor-123",
                  },
                ],
              };
            }
            return { success: true, results: [] };
          },
        }),
      }),
    };
    queryGate = new D1QueryGate(mockDb);
    mockAuditProvider = {
      recordEvent: async () => {},
    };
  });

  describe("handleRecordPrice", () => {
    it("should return 405 Method Not Allowed for non-POST requests", async () => {
      const req = new Request("http://localhost/api/v1/prices", { method: "GET" });
      const res = await handleRecordPrice(req, queryGate, mockUserSession, mockAuditProvider);
      expect(res.status).toBe(405);
    });

    it("should return 400 Bad Request if user has no hogarId", async () => {
      const req = new Request("http://localhost/api/v1/prices", {
        method: "POST",
        body: JSON.stringify({ product_name: "Leche", price: 50 }),
      });
      const invalidSession = { ...mockUserSession, hogarId: null };
      const res = await handleRecordPrice(req, queryGate, invalidSession, mockAuditProvider);
      expect(res.status).toBe(400);
    });

    it("should return 400 Bad Request if price is invalid or <= 0", async () => {
      const req = new Request("http://localhost/api/v1/prices", {
        method: "POST",
        body: JSON.stringify({ product_name: "Leche", price: -10 }),
      });
      const res = await handleRecordPrice(req, queryGate, mockUserSession, mockAuditProvider);
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toContain("Price must be a positive number");
    });

    it("should record a new price entry successfully", async () => {
      const req = new Request("http://localhost/api/v1/prices", {
        method: "POST",
        body: JSON.stringify({ product_name: "Leche", price: 48.5, currency: "UYU" }),
      });
      const res = await handleRecordPrice(req, queryGate, mockUserSession, mockAuditProvider);
      expect(res.status).toBe(201);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.priceRecord.price).toBe(48.5);
      expect(body.priceRecord.currency).toBe("UYU");
    });
  });

  describe("handleGetPriceHistory", () => {
    it("should return price history records for household", async () => {
      const req = new Request("http://localhost/api/v1/prices?product_name=Leche", { method: "GET" });
      const res = await handleGetPriceHistory(req, queryGate, mockUserSession);
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.price_history).toHaveLength(1);
      expect(body.price_history[0].product_name).toBe("Leche");
    });
  });
});
