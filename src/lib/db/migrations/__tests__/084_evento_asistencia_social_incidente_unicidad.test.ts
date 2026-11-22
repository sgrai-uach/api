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
import { up, down } from "../084_evento_asistencia_social_incidente_unicidad";

class CapturingConnection implements DatabaseConnection {
  constructor(public queries: CompiledQuery[]) {}

  async executeQuery(compiledQuery: CompiledQuery): Promise<QueryResult<any>> {
    this.queries.push(compiledQuery);
    return { rows: [] };
  }

  async *streamQuery(): AsyncIterableIterator<never> {
    // No se emiten filas en las pruebas unitarias de migración
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

describe("Migración 084 - Índice único parcial de asistencia social activa por incidente (HU-25)", () => {
  it("debe crear el índice único parcial uq_evento_asistencia_social_incidente_activo en up", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_asistencia_social_incidente_activo"
    );
    expect(sqlEjecutado).toContain("ON evento_asistencia_social (incidente_id)");
    expect(sqlEjecutado).toContain("incidente_id IS NOT NULL");
    expect(sqlEjecutado).toContain("eliminado_en IS NULL");
    expect(sqlEjecutado).toContain("estado <> 'DESCARTADO'");
  });

  it("debe eliminar el índice único parcial en down", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain(
      "DROP INDEX IF EXISTS uq_evento_asistencia_social_incidente_activo"
    );
  });
});
