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
import { up, down } from "../057_permiso_misiones_terreno_ejecutar";

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

describe("Migración 057 - Permiso RBAC misiones:terreno:ejecutar (HU-41)", () => {
  it("debe registrar el permiso misiones:terreno:ejecutar y asignarlo a ADMIN y DELEGADO_CUADRILLA", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain("misiones:terreno:ejecutar");
    expect(sqlEjecutado).toContain("20000000-0000-4000-8000-000000000001");
    expect(sqlEjecutado).toContain("20000000-0000-4000-8000-000000000005");
    expect(sqlEjecutado).toContain("ON CONFLICT DO NOTHING");
  });

  it("debe revertir eliminando las asignaciones en rol_permiso y el permiso en down", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain("DELETE FROM rol_permiso");
    expect(sqlEjecutado).toContain("DELETE FROM permiso WHERE codigo = 'misiones:terreno:ejecutar'");
  });
});
