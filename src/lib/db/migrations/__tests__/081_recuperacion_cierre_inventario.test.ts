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
import { up, down } from "../081_recuperacion_cierre_inventario";

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

describe("Migración 081 - Cierre e inventario de operativos de recuperación (HU-75)", () => {
  it("debe agregar cerrado_por_id, columnas de devolución con CHECKs y permiso recuperacion:cerrar", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS cerrado_por_id UUID");
    expect(sqlEjecutado).toContain("idx_recuperacion_cerrado_por");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS cantidad_consumida INTEGER");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS cantidad_devuelta INTEGER");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS devuelto_en TIMESTAMPTZ");
    expect(sqlEjecutado).toContain("chk_recuperacion_recurso_consumida");
    expect(sqlEjecutado).toContain("chk_recuperacion_recurso_devuelta");
    expect(sqlEjecutado).toContain("recuperacion:cerrar");
  });

  it("debe revertir columnas, restricciones y permiso en down()", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain("DELETE FROM rol_permiso");
    expect(sqlEjecutado).toContain("DELETE FROM permiso WHERE codigo = 'recuperacion:cerrar'");
    expect(sqlEjecutado).toContain("DROP CONSTRAINT IF EXISTS chk_recuperacion_recurso_consumida");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS cantidad_consumida");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS cerrado_por_id");
  });
});
