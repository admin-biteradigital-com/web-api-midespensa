async function getCryptoKey(keyStr: string): Promise<CryptoKey> {
  const cleanKey = keyStr.trim();
  let rawKey: Uint8Array;

  // Auto-detect format: Hex (32, 48, or 64 characters) vs Base64 (usually 44 characters)
  const isHex = /^[0-9a-fA-F]+$/.test(cleanKey) && 
                cleanKey.length % 2 === 0 && 
                (cleanKey.length === 32 || cleanKey.length === 48 || cleanKey.length === 64);

  if (isHex) {
    rawKey = new Uint8Array(
      cleanKey.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
  } else {
    // Treat as Base64 fallback (commonly used for 32-byte keys, resulting in 44 chars)
    try {
      const binaryString = atob(cleanKey);
      rawKey = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        rawKey[i] = binaryString.charCodeAt(i);
      }
    } catch (e: any) {
      throw new Error(`Failed to decode ENCRYPTION_KEY_HEX as Hex or Base64: ${e.message}`);
    }
  }

  return await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function hashEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const msgBuffer = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function encryptEmail(email: string, keyHex: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const key = await getCryptoKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(normalized);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const cipherHex = Array.from(new Uint8Array(ciphertext))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
    
  return `${ivHex}:${cipherHex}`;
}

export async function decryptEmail(encryptedStr: string, keyHex: string): Promise<string> {
  const key = await getCryptoKey(keyHex);
  const [ivHex, cipherHex] = encryptedStr.split(":");
  
  const iv = new Uint8Array(
    ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  const ciphertext = new Uint8Array(
    cipherHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}

export async function hashToken(token: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
