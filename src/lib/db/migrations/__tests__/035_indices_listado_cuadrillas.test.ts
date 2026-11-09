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
import { up, down } from "../035_indices_listado_cuadrillas";

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

describe("Migración 035 - Índices de listado de cuadrillas (H80)", () => {
  it("debe crear los índices parciales para delegacion, estado, delegacion+estado y orden DESC en registros activos", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("CREATE INDEX IF NOT EXISTS idx_cuadrilla_delegacion_id");
    expect(sqlEjecutado).toContain("ON cuadrilla (delegacion_id)");
    expect(sqlEjecutado).toContain("WHERE eliminado_en IS NULL");

    expect(sqlEjecutado).toContain("CREATE INDEX IF NOT EXISTS idx_cuadrilla_estado");
    expect(sqlEjecutado).toContain("ON cuadrilla (estado)");

    expect(sqlEjecutado).toContain("CREATE INDEX IF NOT EXISTS idx_cuadrilla_delegacion_estado");
    expect(sqlEjecutado).toContain("ON cuadrilla (delegacion_id, estado)");

    expect(sqlEjecutado).toContain("CREATE INDEX IF NOT EXISTS idx_cuadrilla_creado_en_desc");
    expect(sqlEjecutado).toContain("ON cuadrilla (creado_en DESC)");
  });

  it("debe eliminar los índices en la función down", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("DROP INDEX IF EXISTS idx_cuadrilla_creado_en_desc");
    expect(sqlEjecutado).toContain("DROP INDEX IF EXISTS idx_cuadrilla_delegacion_estado");
    expect(sqlEjecutado).toContain("DROP INDEX IF EXISTS idx_cuadrilla_estado");
    expect(sqlEjecutado).toContain("DROP INDEX IF EXISTS idx_cuadrilla_delegacion_id");
  });
});

