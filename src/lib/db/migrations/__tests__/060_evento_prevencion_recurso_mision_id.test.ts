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
import { up, down } from "../060_evento_prevencion_recurso_mision_id";

class CapturingConnection implements DatabaseConnection {
  constructor(public queries: CompiledQuery[]) {}

  async executeQuery(compiledQuery: CompiledQuery): Promise<QueryResult<any>> {
    this.queries.push(compiledQuery);
    return { rows: [] };
  }

  async *streamQuery(): AsyncIterableIterator<never> {
    // No se emiten filas en las pruebas de migración
  }
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
      createIntrospector: (instancia: Kysely<any>) => new PostgresIntrospector(instancia),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, sql: () => driver.queries.map((q) => q.sql).join("\n") };
}

describe("Migración 060 - Columna mision_id en evento_prevencion_recurso (HU-33)", () => {
  it("debe agregar la columna mision_id con FK a mision y su índice en up()", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain("ALTER TABLE evento_prevencion_recurso");
    expect(sqlEjecutado).toContain(
      "ADD COLUMN IF NOT EXISTS mision_id UUID REFERENCES mision(id) ON DELETE SET NULL"
    );
    expect(sqlEjecutado).toContain("idx_evento_prevencion_recurso_mision");
    expect(sqlEjecutado).toContain('"evento_prevencion_recurso" ("mision_id")');
  });

  it("debe eliminar el índice y la columna mision_id en down()", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain('drop index if exists "idx_evento_prevencion_recurso_mision"');
    expect(sqlEjecutado).toContain("ALTER TABLE evento_prevencion_recurso");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS mision_id");
  });
});
