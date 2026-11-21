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
import { up, down } from "../083_evento_asistencia_social_detalles_evaluacion";

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
      createIntrospector: (instancia: Kysely<any>) =>
        new PostgresIntrospector(instancia),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, sql: () => driver.queries.map((q) => q.sql).join("\n") };
}

describe("Migración 083 - detalles_evaluacion JSONB en evento_asistencia_social", () => {
  it("up debe agregar la columna nullable detalles_evaluacion JSONB", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql().toLowerCase();
    expect(sqlEjecutado).toContain("alter table evento_asistencia_social");
    expect(sqlEjecutado).toContain("add column if not exists detalles_evaluacion jsonb null");
  });

  it("down debe eliminar la columna detalles_evaluacion", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql().toLowerCase();
    expect(sqlEjecutado).toContain("alter table evento_asistencia_social");
    expect(sqlEjecutado).toContain("drop column if exists detalles_evaluacion");
  });
});
