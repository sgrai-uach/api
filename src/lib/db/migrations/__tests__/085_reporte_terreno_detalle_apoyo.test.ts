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
import { up, down } from "../085_reporte_terreno_detalle_apoyo";

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

describe("Migración 085 - Detalle de apoyo requerido en reporte_terreno (HU-44)", () => {
  it("debe agregar la columna detalle_apoyo_requerido, crear el índice parcial y asegurar el permiso reportes:crear", async () => {
    const { db, sql } = crearDbDePruebas();
    await up(db);

    const sqlEjecutado = sql().toLowerCase();
    expect(sqlEjecutado).toContain("alter table reporte_terreno");
    expect(sqlEjecutado).toContain("add column if not exists detalle_apoyo_requerido text null");
    expect(sqlEjecutado).toContain("idx_reporte_terreno_apoyo_adicional");
    expect(sqlEjecutado).toContain("reportes:crear");
  });

  it("debe revertir índice y columna detalle_apoyo_requerido en down()", async () => {
    const { db, sql } = crearDbDePruebas();
    await down(db);

    const sqlEjecutado = sql().toLowerCase();
    expect(sqlEjecutado).toContain("drop index if exists idx_reporte_terreno_apoyo_adicional");
    expect(sqlEjecutado).toContain("drop column if exists detalle_apoyo_requerido");
  });
});
