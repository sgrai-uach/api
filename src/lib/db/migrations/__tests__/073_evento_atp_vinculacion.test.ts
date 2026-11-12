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
import { up, down } from "../073_evento_atp_vinculacion";

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

describe("Migración 073 - Vinculación a Eventos ATP (H60)", () => {
  it("debe migrar el estado CERRADO a FINALIZADO", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql().toLowerCase();

    expect(sqlEjecutado).toContain("update evento_atp");
    expect(sqlEjecutado).toContain("set estado = 'finalizado'");
    expect(sqlEjecutado).toContain("where estado = 'cerrado'");
  });

  it("debe reemplazar la restricción de estado por ACTIVO/FINALIZADO/CANCELADO", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql().toLowerCase();

    expect(sqlEjecutado).toContain("evento_atp_estado_valido");
    expect(sqlEjecutado).toContain(
      "check (estado in ('activo', 'finalizado', 'cancelado'))"
    );
  });

  it("debe crear el permiso eventos_atp:vincular y asignarlo a Administrador y Encargado", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql().toLowerCase();

    expect(sqlEjecutado).toContain("eventos_atp:vincular");
    expect(sqlEjecutado).toContain("insert into permiso");
    expect(sqlEjecutado).toContain("insert into rol_permiso");
    expect(sqlEjecutado).toContain(
      "20000000-0000-4000-8000-000000000001"
    );
    expect(sqlEjecutado).toContain(
      "20000000-0000-4000-8000-000000000003"
    );
  });

  it("down debe restaurar CERRADO y eliminar el permiso", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql().toLowerCase();

    expect(sqlEjecutado).toContain("set estado = 'cerrado'");
    expect(sqlEjecutado).toContain("delete from permiso");
    expect(sqlEjecutado).toContain("delete from rol_permiso");
    expect(sqlEjecutado).toContain(
      "check (estado in ('activo', 'cerrado', 'cancelado'))"
    );
  });
});
