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
import { up, down } from "../042_cuadrilla_patrulla_integrantes_vistas";

class CapturingConnection implements DatabaseConnection {
  constructor(public queries: CompiledQuery[]) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
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
      createIntrospector: (instancia: Kysely<unknown>) =>
        new PostgresIntrospector(instancia),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, sql: () => driver.queries.map((q) => q.sql).join("\n") };
}

describe("Migración 042 - Vistas de compatibilidad cuadrilla_integrante y patrulla_integrante", () => {
  it("debe crear las vistas de compatibilidad en la función up", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("CREATE OR REPLACE VIEW cuadrilla_integrante AS");
    expect(sqlEjecutado).toContain("SELECT * FROM cuadrilla_personal");
    expect(sqlEjecutado).toContain("CREATE OR REPLACE VIEW patrulla_integrante AS");
    expect(sqlEjecutado).toContain("SELECT * FROM patrulla_personal");
  });

  it("debe eliminar las vistas en la función down", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("DROP VIEW IF EXISTS patrulla_integrante");
    expect(sqlEjecutado).toContain("DROP VIEW IF EXISTS cuadrilla_integrante");
  });
});
