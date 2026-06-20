import { hashEmail, encryptEmail, decryptEmail } from "./crypto";
import { TenantContext, D1QueryGate } from "../middleware/tel";

// Mock para simular D1 y validar el Query Gate
class MockD1Database {
  public queries: Array<{ sql: string; params: any[] }> = [];

  prepare(sql: string) {
    const parent = this;
    return {
      bind(...params: any[]) {
        return {
          async all() {
            parent.queries.push({ sql, params });
            return { results: [] };
          },
        };
      },
    };
  }

  async batch(statements: any[]) {
    return [];
  }
}

export async function runSmokeTests() {
  console.log("🧪 Iniciando pruebas de humo de Sprint 0...");
  let errors = 0;

  // 1. Validar Identity Model (hashing y cifrado)
  try {
    const email = "Test-Email@BiteraDigital.com ";
    const keyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const hash = await hashEmail(email);
    const expectedHash = "9dd1c3e351dc4ecb0b3cf8df00c9f8892d5a0f2e009155bc243c9d1c6a41b665"; // SHA-256 de test-email@biteradigital.com

    if (hash !== expectedHash) {
      throw new Error(`Hash inválido. Obtenido: ${hash}, Esperado: ${expectedHash}`);
    }
    console.log("✅ Identity Model: Hash de e-mail correcto.");

    const encrypted = await encryptEmail(email, keyHex);
    const decrypted = await decryptEmail(encrypted, keyHex);

    if (decrypted !== "test-email@biteradigital.com") {
      throw new Error(`Desencriptación fallida. Obtenida: ${decrypted}`);
    }
    console.log("✅ Identity Model: Cifrado y descifrado AES-GCM correctos.");
  } catch (err: any) {
    console.error("❌ Fallo en test de Identity Model:", err.message);
    errors++;
  }

  // 2. Validar Query Gate (TEL) - Fail-Closed
  try {
    const mockDB = new MockD1Database() as any;
    const gate = new D1QueryGate(mockDB);
    const invalidCtx = new TenantContext(null); // Sin hogarId

    try {
      await gate.executeTenantQuery(
        invalidCtx,
        "SELECT * FROM inventario WHERE hogar_id = ?",
        [1]
      );
      throw new Error("El Query Gate no bloqueó una petición con TenantContext nulo.");
    } catch (err: any) {
      if (err.message.includes("SECURE_GATE_VIOLATION")) {
        console.log("✅ TEL Query Gate: Bloqueo de tenant nulo funciona (Fail-Closed).");
      } else {
        throw err;
      }
    }

    const validCtx = new TenantContext("hogar-123");
    try {
      await gate.executeTenantQuery(validCtx, "SELECT * FROM inventario", [1]); // Query sin filtrar por hogar_id
      throw new Error("El Query Gate no bloqueó una query sin la columna hogar_id.");
    } catch (err: any) {
      if (err.message.includes("SECURE_GATE_VIOLATION")) {
        console.log("✅ TEL Query Gate: Bloqueo de query no filtrada funciona (Fail-Closed).");
      } else {
        throw err;
      }
    }
  } catch (err: any) {
    console.error("❌ Fallo en test de TEL Query Gate:", err.message);
    errors++;
  }

  if (errors > 0) {
    console.error(`❌ Pruebas de humo finalizadas con ${errors} error(es).`);
    return false;
  } else {
    console.log("🎉 Todas las pruebas de humo pasaron con éxito.");
    return true;
  }
}
