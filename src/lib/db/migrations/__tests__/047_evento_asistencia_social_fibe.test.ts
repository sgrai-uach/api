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
import { up, down } from "../047_evento_asistencia_social_fibe";

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

describe("Migración 047 - Campos FIBE, auditoría y permiso asistencia_social:fibe:gestionar (HU-71)", () => {
  it("up debe agregar columnas FIBE, índice único parcial y permiso asistencia_social:fibe:gestionar", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql().toLowerCase();
    expect(sqlEjecutado).toContain("alter table evento_asistencia_social");
    expect(sqlEjecutado).toContain("add column if not exists folio_fibe varchar(50)");
    expect(sqlEjecutado).toContain("add column if not exists nivel_dano_vivienda varchar(30)");
    expect(sqlEjecutado).toContain("add column if not exists observaciones_fibe text");
    expect(sqlEjecutado).toContain("add column if not exists fibe_registrada_en timestamptz");
    expect(sqlEjecutado).toContain("add column if not exists fibe_registrada_por_id uuid");
    expect(sqlEjecutado).toContain("add column if not exists actualizado_por_id uuid");
    expect(sqlEjecutado).toContain("create unique index if not exists uq_evento_asistencia_social_folio_fibe");
    expect(sqlEjecutado).toContain("upper(trim(folio_fibe))");
    expect(sqlEjecutado).toContain("asistencia_social:fibe:gestionar");
  });

  it("down debe revertir permiso, índices y columnas FIBE", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql().toLowerCase();
    expect(sqlEjecutado).toContain("delete from rol_permiso");
    expect(sqlEjecutado).toContain("asistencia_social:fibe:gestionar");
    expect(sqlEjecutado).toContain("drop index if exists uq_evento_asistencia_social_folio_fibe");
    expect(sqlEjecutado).toContain("drop column if exists folio_fibe");
    expect(sqlEjecutado).toContain("drop column if exists actualizado_por_id");
  });
});
