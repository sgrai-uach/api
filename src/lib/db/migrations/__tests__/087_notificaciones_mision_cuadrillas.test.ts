/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from "kysely";
import { up, down } from "../087_notificaciones_mision_cuadrillas";

class CapturingConnection implements DatabaseConnection {
  constructor(public queries: CompiledQuery[]) {}

  async executeQuery(compiledQuery: CompiledQuery): Promise<QueryResult<any>> {
    this.queries.push(compiledQuery);
    return { rows: [] };
  }

  async *streamQuery(): AsyncIterableIterator<never> {}
}

class CapturingDriver implements Driver {
  public queries: CompiledQuery[] = [];

  async init(): Promise<void> {}
  async acquireConnection(): Promise<DatabaseConnection> {
    return new CapturingConnection(this.queries);
  }
  async beginTransaction(): Promise<void> {}
  async commitTransaction(): Promise<void> {}
  async rollbackTransaction(): Promise<void> {}
  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {}
  async releaseSavepoint(): Promise<void> {}
  async rollbackToSavepoint(): Promise<void> {}
  async savepoint(): Promise<void> {}
}

function crearDbDePruebas() {
  const driver = new CapturingDriver();
  const db = new Kysely<unknown>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (instancia: Kysely<any>) =>
        new PostgresIntrospector(instancia),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, sql: () => driver.queries.map((q) => q.sql).join("\n") };
}

describe("Migración 087 - Soporte de notificaciones_mision para cuadrillas", () => {
  it("debe permitir patrulla_id NULL, agregar cuadrilla_id, constraint excluyente e índice parcial", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const ddl = sql();
    expect(ddl).toContain("ALTER COLUMN patrulla_id DROP NOT NULL");
    expect(ddl).toContain("ADD COLUMN IF NOT EXISTS cuadrilla_id UUID REFERENCES cuadrilla(id) ON DELETE CASCADE");
    expect(ddl).toContain("ADD CONSTRAINT chk_notificaciones_mision_destinatario");
    expect(ddl).toContain("(patrulla_id IS NOT NULL AND cuadrilla_id IS NULL)");
    expect(ddl).toContain("(patrulla_id IS NULL AND cuadrilla_id IS NOT NULL)");
    expect(ddl).toContain("CREATE INDEX IF NOT EXISTS idx_notificaciones_mision_cuadrilla_estado");
    expect(ddl).toContain("WHERE cuadrilla_id IS NOT NULL");
  });

  it("debe revertir el índice, constraint y columna cuadrilla_id en down()", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const ddl = sql();
    expect(ddl).toContain("DROP INDEX IF EXISTS idx_notificaciones_mision_cuadrilla_estado");
    expect(ddl).toContain("DROP CONSTRAINT IF EXISTS chk_notificaciones_mision_destinatario");
    expect(ddl).toContain("DROP COLUMN IF EXISTS cuadrilla_id");
    expect(ddl).toContain("ALTER TABLE notificaciones_mision ALTER COLUMN patrulla_id SET NOT NULL");
  });
});
