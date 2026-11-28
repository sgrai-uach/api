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
import { up, down } from "../073_permiso_reportes_crear_y_adjuntos";

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
      createIntrospector: (instancia: Kysely<any>) => new PostgresIntrospector(instancia),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, sql: () => driver.queries.map((q) => q.sql).join("\n") };
}

describe("Migración 073 - Permiso RBAC reportes:crear idempotente y sha256_hash en adjunto (HU-43)", () => {
  it("debe asegurar reportes:crear sin sobrescribir 056, asignar roles con ON CONFLICT DO NOTHING y añadir sha256_hash", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain("reportes:crear");
    expect(sqlEjecutado).toContain("ON CONFLICT (codigo) DO NOTHING");
    expect(sqlEjecutado).toContain("ON CONFLICT DO NOTHING");
    expect(sqlEjecutado).not.toContain("UPDATE permiso");
    expect(sqlEjecutado).toContain("20000000-0000-4000-8000-000000000001");
    expect(sqlEjecutado).toContain("20000000-0000-4000-8000-000000000004");
    expect(sqlEjecutado).toContain("20000000-0000-4000-8000-000000000005");
    expect(sqlEjecutado).toContain("sha256_hash");
    expect(sqlEjecutado).toContain("idx_adjunto_sha256_hash");
  });

  it("debe revertir solo idx_adjunto_sha256_hash y sha256_hash sin borrar reportes:crear de 056", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain("DROP INDEX IF EXISTS idx_adjunto_sha256_hash");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS sha256_hash");
    expect(sqlEjecutado).not.toContain("DELETE FROM rol_permiso");
    expect(sqlEjecutado).not.toContain("DELETE FROM permiso");
  });
});
