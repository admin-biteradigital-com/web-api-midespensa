export class TenantContext {
  constructor(public readonly hogarId: string | null) {}

  public getRequiredHogarId(): string {
    if (!this.hogarId || this.hogarId.trim() === "") {
      throw new Error(
        "SECURE_GATE_VIOLATION: context.hogar_id is required for tenant-scoped operations but was null or empty."
      );
    }
    return this.hogarId;
  }
}

export class D1QueryGate {
  constructor(private db: D1Database) {}

  /**
   * Ejecuta una consulta SQL que pertenece obligatoriamente a un Tenant (Hogar).
   * Valida en runtime que se tenga un hogarId válido y que la sentencia referencie 'hogar_id'.
   */
  public async executeTenantQuery<T>(
    context: TenantContext,
    sql: string,
    params: any[]
  ): Promise<T[]> {
    const hogarId = context.getRequiredHogarId();

    // Verificación estricta en runtime: la consulta debe contener el campo 'hogar_id'
    if (!sql.toLowerCase().includes("hogar_id")) {
      throw new Error(
        `SECURE_GATE_VIOLATION: Query does not reference 'hogar_id' dynamically. Blocked query: ${sql}`
      );
    }

    const stmt = this.db.prepare(sql).bind(...params);
    const { results } = await stmt.all<T>();
    return results || [];
  }

  public async executeTenantFirst<T>(
    context: TenantContext,
    sql: string,
    params: any[]
  ): Promise<T | null> {
    const results = await this.executeTenantQuery<T>(context, sql, params);
    return results[0] || null;
  }

  /**
   * Ejecuta una consulta a nivel de sistema (Autenticación, Registro o Creación de Hogar).
   * No requiere hogarId.
   */
  public async executeSystemQuery<T>(
    sql: string,
    params: any[]
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql).bind(...params);
    const { results } = await stmt.all<T>();
    return results || [];
  }

  public async executeSystemFirst<T>(
    sql: string,
    params: any[]
  ): Promise<T | null> {
    const results = await this.executeSystemQuery<T>(sql, params);
    return results[0] || null;
  }

  public prepare(sql: string): D1PreparedStatement {
    return this.db.prepare(sql);
  }

  public async batch(statements: D1PreparedStatement[]): Promise<any> {
    return await this.db.batch(statements);
  }
}
