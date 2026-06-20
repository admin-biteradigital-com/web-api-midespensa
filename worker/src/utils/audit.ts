import { D1QueryGate } from "../middleware/tel";

export interface AuditEvidenceProvider {
  recordEvent(
    actorId: string,
    action: string,
    details: Record<string, any>,
    hogarId?: string | null
  ): Promise<void>;
}

export class D1AuditEvidenceProvider implements AuditEvidenceProvider {
  constructor(
    private queryGate: D1QueryGate,
    private jwtSecret: string
  ) {}

  public async recordEvent(
    actorId: string,
    action: string,
    details: Record<string, any>,
    hogarId: string | null = null
  ): Promise<void> {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const detailsStr = JSON.stringify(details);

    // 1. Obtener el hash del último registro de auditoría legal
    // Si no hay ninguno, el hash anterior es una cadena vacía
    const lastLog = await this.queryGate.executeSystemFirst<{ hash: string }>(
      "SELECT hash FROM auditoria_legal ORDER BY timestamp DESC, id DESC LIMIT 1",
      []
    );
    const prevHash = lastLog ? lastLog.hash : "";

    // 2. Calcular el hash chain: SHA-256(prevHash + timestamp + actorId + action + detailsStr)
    const contentToHash = `${prevHash}${timestamp}${actorId}${action}${detailsStr}`;
    const encoder = new TextEncoder();
    const contentBuffer = encoder.encode(contentToHash);
    const hashBuffer = await crypto.subtle.digest("SHA-256", contentBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const currentHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 3. Calcular la firma HMAC-SHA256(currentHash, jwtSecret)
    const signature = await this.calculateHmac(currentHash, this.jwtSecret);

    // 4. Guardar en la base de datos
    await this.queryGate.executeSystemQuery(
      `INSERT INTO auditoria_legal (id, timestamp, actor_id, hogar_id, action, details, hash, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, timestamp, actorId, hogarId, action, detailsStr, currentHash, signature]
    );
  }

  private async calculateHmac(message: string, secretStr: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretStr);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sigBuffer = await crypto.subtle.sign("HMAC", key, messageData);
    const sigArray = Array.from(new Uint8Array(sigBuffer));
    return sigArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}
