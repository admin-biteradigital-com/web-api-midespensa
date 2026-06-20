import { describe, it, expect, vi } from "vitest";
import { TenantContext, D1QueryGate } from "../middleware/tel";

// Helper Mock de D1
function createMockDB(resultsArr: any[] = [{ id: "test-item", name: "Inventario" }]) {
  const allMock = vi.fn().mockResolvedValue({ results: resultsArr });
  const prepareMock = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({
      all: allMock,
    }),
  });

  return {
    prepare: prepareMock,
    batch: vi.fn().mockResolvedValue([{ results: resultsArr }]),
    _allMock: allMock,
    _prepareMock: prepareMock,
  } as any;
}

describe("Tenant Enforcement Layer (TEL) Query Gate", () => {
  it("Debería lanzar error si TenantContext no posee un hogarId (Fail-Closed)", async () => {
    const mockDB = createMockDB();
    const gate = new D1QueryGate(mockDB);
    const context = new TenantContext(null);

    await expect(
      gate.executeTenantQuery(context, "SELECT * FROM inventario WHERE hogar_id = ?", ["hogar-1"])
    ).rejects.toThrow("SECURE_GATE_VIOLATION: context.hogar_id is required");
  });

  it("Debería lanzar error si la query no referencia 'hogar_id' en texto (Fail-Closed)", async () => {
    const mockDB = createMockDB();
    const gate = new D1QueryGate(mockDB);
    const context = new TenantContext("hogar-123");

    await expect(
      gate.executeTenantQuery(context, "SELECT * FROM inventario WHERE product_id = ?", ["prod-1"])
    ).rejects.toThrow("SECURE_GATE_VIOLATION: Query does not reference 'hogar_id'");
  });

  it("Debería permitir la ejecución si el contexto es válido y la query referencia 'hogar_id'", async () => {
    const mockDB = createMockDB();
    const gate = new D1QueryGate(mockDB);
    const context = new TenantContext("hogar-123");

    const result = await gate.executeTenantQuery(
      context,
      "SELECT * FROM inventario WHERE hogar_id = ?",
      ["hogar-123"]
    );

    expect(result).toBeDefined();
    expect(mockDB._prepareMock).toHaveBeenCalledWith("SELECT * FROM inventario WHERE hogar_id = ?");
    expect(mockDB._allMock).toHaveBeenCalled();
  });

  it("Debería permitir executeTenantFirst y retornar el primer elemento", async () => {
    const mockDB = createMockDB([{ id: "first-item" }, { id: "second-item" }]);
    const gate = new D1QueryGate(mockDB);
    const context = new TenantContext("hogar-123");

    const result = await gate.executeTenantFirst(
      context,
      "SELECT * FROM inventario WHERE hogar_id = ? LIMIT 1",
      ["hogar-123"]
    );

    expect(result).toEqual({ id: "first-item" });
  });

  it("Debería permitir queries de sistema sin hogarId", async () => {
    const mockDB = createMockDB();
    const gate = new D1QueryGate(mockDB);

    const result = await gate.executeSystemQuery("SELECT * FROM users WHERE id = ?", ["user-1"]);
    expect(result).toBeDefined();
    expect(mockDB._prepareMock).toHaveBeenCalledWith("SELECT * FROM users WHERE id = ?");
  });

  it("Debería permitir executeSystemFirst y retornar el primer elemento", async () => {
    const mockDB = createMockDB([{ id: "sys-item" }]);
    const gate = new D1QueryGate(mockDB);

    const result = await gate.executeSystemFirst("SELECT * FROM users WHERE id = ? LIMIT 1", ["user-1"]);
    expect(result).toEqual({ id: "sys-item" });
  });

  it("Debería retornar null en executeTenantFirst y executeSystemFirst si no hay resultados", async () => {
    const mockDB = createMockDB([]);
    const gate = new D1QueryGate(mockDB);
    const context = new TenantContext("hogar-123");

    const tenantFirst = await gate.executeTenantFirst(context, "SELECT * FROM inventario WHERE hogar_id = ?", ["h-1"]);
    const systemFirst = await gate.executeSystemFirst("SELECT * FROM users WHERE id = ?", ["u-1"]);

    expect(tenantFirst).toBeNull();
    expect(systemFirst).toBeNull();
  });

  it("Debería exponer prepare y batch de forma nativa", async () => {
    const mockDB = createMockDB();
    const gate = new D1QueryGate(mockDB);

    gate.prepare("SELECT 1");
    expect(mockDB.prepare).toHaveBeenCalledWith("SELECT 1");

    await gate.batch([]);
    expect(mockDB.batch).toHaveBeenCalledWith([]);
  });
});
