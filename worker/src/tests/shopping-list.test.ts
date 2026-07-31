import { describe, it, expect, beforeEach } from "vitest";
import { handleGetShoppingList } from "../routes/inventory";
import { D1QueryGate } from "../middleware/tel";
import { JWTPayload } from "../../../shared/types";

describe("Shopping List API Endpoint", () => {
  let mockDb: any;
  let queryGate: D1QueryGate;
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
          all: async () => {
            if (sql.includes("FROM inventario")) {
              return {
                success: true,
                results: [
                  {
                    id: "prod-1",
                    hogar_id: "hogar-789",
                    product_name: "Leche",
                    quantity: 1,
                    min_stock: 2,
                    updated_at: new Date().toISOString(),
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
  });

  it("should return 405 Method Not Allowed for non-GET requests", async () => {
    const req = new Request("http://localhost/api/v1/shopping-list", { method: "POST" });
    const res = await handleGetShoppingList(req, queryGate, mockUserSession);
    expect(res.status).toBe(405);
  });

  it("should return 400 Bad Request if user has no hogarId", async () => {
    const req = new Request("http://localhost/api/v1/shopping-list", { method: "GET" });
    const invalidSession = { ...mockUserSession, hogarId: null };
    const res = await handleGetShoppingList(req, queryGate, invalidSession);
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toContain("User is not associated with any household");
  });

  it("should execute tenant query and return items needing replenishment", async () => {
    const req = new Request("http://localhost/api/v1/shopping-list", { method: "GET" });
    const res = await handleGetShoppingList(req, queryGate, mockUserSession);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.shopping_list).toHaveLength(1);
    expect(body.shopping_list[0].product_name).toBe("Leche");
  });
});
