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
import { up, down } from "../035_evento_atp_base";

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

describe("Migración 035 - Base de Eventos ATP (H61)", () => {
  it("debe crear evento_atp con restricciones de fechas, alerta y estado", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql().toLowerCase();

    expect(sqlEjecutado).toContain('create table if not exists "evento_atp"');
    expect(sqlEjecutado).toContain("fecha_termino >= fecha_inicio");
    expect(sqlEjecutado).toContain(
      "nivel_alerta in ('verde', 'amarilla', 'roja')"
    );
    expect(sqlEjecutado).toContain(
      "estado in ('activo', 'cerrado', 'cancelado')"
    );
  });

  it("debe crear la tabla puente evento_atp_delegacion con unicidad", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql().toLowerCase();

    expect(sqlEjecutado).toContain(
      'create table if not exists "evento_atp_delegacion"'
    );
    expect(sqlEjecutado).toContain("evento_atp_delegacion_unica");
  });

  it("debe agregar las columnas nullable evento_atp_id en las entidades vinculables", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql().toLowerCase();

    for (const tabla of [
      "incidente",
      "evento_prevencion",
      "recuperacion",
      "evento_asistencia_social",
    ]) {
      expect(sqlEjecutado).toContain(`alter table "${tabla}"`);
    }
    expect(sqlEjecutado).toContain("add column if not exists evento_atp_id");
    expect(sqlEjecutado).toContain("references evento_atp(id)");
  });

  it("debe reasegurar el permiso eventos_atp:crear para Administrador", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql().toLowerCase();

    expect(sqlEjecutado).toContain("eventos_atp:crear");
    expect(sqlEjecutado).toContain("insert into rol_permiso");
  });

  it("down debe eliminar las columnas, la tabla puente y evento_atp", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql().toLowerCase();

    expect(sqlEjecutado).toContain("drop column if exists evento_atp_id");
    expect(sqlEjecutado).toContain(
      'drop table if exists "evento_atp_delegacion"'
    );
    expect(sqlEjecutado).toContain('drop table if exists "evento_atp"');
  });
});
