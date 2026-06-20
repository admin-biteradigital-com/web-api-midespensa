import { describe, it, expect, vi } from "vitest";
import { D1AuditEvidenceProvider } from "../utils/audit";

function createMockQueryGate(lastHash: string | null) {
  const executeSystemFirstMock = vi.fn().mockResolvedValue(lastHash ? { hash: lastHash } : null);
  const executeSystemQueryMock = vi.fn().mockResolvedValue([]);

  return {
    executeSystemFirst: executeSystemFirstMock,
    executeSystemQuery: executeSystemQueryMock,
  } as any;
}

describe("D1AuditEvidenceProvider (Audit Trail)", () => {
  const jwtSecret = "my-test-jwt-secret-key-32-bytes-long";

  it("Debería calcular el hash chain inicial y firmarlo correctamente cuando no hay registros anteriores", async () => {
    const queryGate = createMockQueryGate(null);
    const provider = new D1AuditEvidenceProvider(queryGate, jwtSecret);

    await provider.recordEvent("user-1", "AUTH_SUCCESS", { ip: "127.0.0.1" }, "hogar-12");

    expect(queryGate.executeSystemFirst).toHaveBeenCalledWith(
      "SELECT hash FROM auditoria_legal ORDER BY timestamp DESC, id DESC LIMIT 1"
    );

    expect(queryGate.executeSystemQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO auditoria_legal"),
      expect.arrayContaining([
        expect.any(String), // id (UUID)
        expect.any(String), // timestamp (ISO-8601)
        "user-1",           // actor_id
        "hogar-12",         // hogar_id
        "AUTH_SUCCESS",     // action
        JSON.stringify({ ip: "127.0.0.1" }), // details
        expect.any(String), // hash
        expect.any(String), // signature
      ])
    );

    // Obtener los argumentos guardados en el insert
    const insertArgs = queryGate.executeSystemQuery.mock.calls[0][1];
    const insertedHash = insertArgs[6];
    const insertedSignature = insertArgs[7];

    expect(insertedHash).toHaveLength(64); // SHA-256 hex string length
    expect(insertedSignature).toHaveLength(64); // HMAC-SHA256 hex string length
  });

  it("Debería encadenar el hash del registro anterior para formar el hash chain acumulativo", async () => {
    const prevHash = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
    const queryGate = createMockQueryGate(prevHash);
    const provider = new D1AuditEvidenceProvider(queryGate, jwtSecret);

    await provider.recordEvent("user-2", "STOCK_MUTATION_ADD", { qty: 5 }, "hogar-99");

    const insertArgs = queryGate.executeSystemQuery.mock.calls[0][1];
    const currentHash = insertArgs[6];
    const timestamp = insertArgs[1];
    const details = insertArgs[5];

    // Verificar manualmente el hash chain: SHA-256(prevHash + timestamp + actorId + action + detailsStr)
    const expectedInput = `${prevHash}${timestamp}user-2` + `STOCK_MUTATION_ADD` + `${details}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(expectedInput));
    const calculatedHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    expect(currentHash).toBe(calculatedHash);
  });
});
