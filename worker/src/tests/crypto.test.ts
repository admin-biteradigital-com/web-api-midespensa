import { describe, it, expect } from "vitest";
import { hashEmail, encryptEmail, decryptEmail } from "../utils/crypto";

describe("Identity Model Criptografía", () => {
  const testEmail = "Test-User@BiteraDigital.com";
  const keyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  it("Debería normalizar y hashear el correo con SHA-256 de forma no reversible", async () => {
    const hash1 = await hashEmail(testEmail);
    const hash2 = await hashEmail("  test-user@biteradigital.com  ");
    
    expect(hash1).toBe(hash2);
    expect(hash1).toBe("1b90988c69f08afe9cf63cb07bfcf2028fa65eaaa1af5545de86ae640d51c47b");
  });

  it("Debería cifrar y descifrar el correo con AES-GCM correctamente", async () => {
    const encrypted = await encryptEmail(testEmail, keyHex);
    expect(encrypted).toContain(":"); // formato ivHex:cipherHex

    const decrypted = await decryptEmail(encrypted, keyHex);
    expect(decrypted).toBe("test-user@biteradigital.com");
  });
});
