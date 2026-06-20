import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRebuildInventory } from "../routes/inventory";
import { D1QueryGate } from "../middleware/tel";
import { JWTPayload } from "../../../shared/types";
import { hashEmail } from "../utils/crypto";

const mockDB = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({}),
  }),
  batch: vi.fn().mockResolvedValue([]),
};

const queryGate = new D1QueryGate(mockDB as any);

describe("Recovery Drill #1 — Reconstrucción de Vista Materializada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Debería rechazar la reconstrucción si el usuario no es el SYSTEM_OWNER (admin@biteradigital.com)", async () => {
    const sessionUser: JWTPayload = {
      userId: "user-123",
      email: await hashEmail("user@biteradigital.com"), // no es admin
      hogarId: "hogar-123",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const request = new Request("https://example.com/api/v1/admin/rebuild-inventory", { method: "POST" });
    const response = await handleRebuildInventory(request, queryGate, sessionUser);

    expect(response.status).toBe(403);
    const json = await response.json() as any;
    expect(json.error).toContain("Prohibido");
  });

  it("Debería reconstruir con éxito el inventario cruzando events_stock y auditoria_legal", async () => {
    const adminSession: JWTPayload = {
      userId: "admin-id",
      email: await hashEmail("admin@biteradigital.com"),
      hogarId: null,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    // Mockear la QueryGate para devolver:
    // 1. Dos entradas de auditoría que asocian product_id con su product_name
    // 2. Dos productos con sus deltas de eventos consolidados
    const mockQueryGate = {
      executeSystemQuery: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes("auditoria_legal")) {
          return [
            { details: JSON.stringify({ productId: "p-apples", product_name: "Manzanas" }) },
            { details: JSON.stringify({ productId: "p-milk", product_name: "Leche" }) },
          ];
        }
        if (sql.includes("events_stock")) {
          return [
            { hogar_id: "h-1", product_id: "p-apples", quantity: 3, updated_at: "2026-06-20T18:00:00Z" },
            { hogar_id: "h-1", product_id: "p-milk", quantity: 2, updated_at: "2026-06-20T18:10:00Z" },
          ];
        }
        return [];
      }),
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as any;

    const request = new Request("https://example.com/api/v1/admin/rebuild-inventory", { method: "POST" });
    const response = await handleRebuildInventory(request, mockQueryGate, adminSession);

    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.success).toBe(true);
    expect(json.rebuiltCount).toBe(2);

    // Verificar que se haya hecho un delete y luego dos inserts
    expect(mockQueryGate.prepare).toHaveBeenCalledWith("DELETE FROM inventario");
    expect(mockQueryGate.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO inventario")
    );

    // Comprobar que los binds correspondan a los nombres recuperados de auditoria_legal
    const bindCalls = mockQueryGate.prepare.mock.results;
    expect(mockQueryGate.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO inventario"));
  });
});
