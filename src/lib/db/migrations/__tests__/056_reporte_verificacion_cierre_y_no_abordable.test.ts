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
import { up, down } from "../056_reporte_verificacion_cierre_y_no_abordable";

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

describe("Migración 056 - Informe técnico de verificación, cierre de misión y NO_ABORDABLE (HU-39 / HU-86)", () => {
  it("debe agregar columnas de cierre/no abordable en incidente y reporte_terreno, además del permiso reportes:crear", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("ALTER TABLE incidente");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS fecha_cierre TIMESTAMPTZ NULL");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS motivo_no_abordable TEXT NULL");

    expect(sqlEjecutado).toContain("ALTER TABLE reporte_terreno");
    expect(sqlEjecutado).toContain(
      "ADD COLUMN IF NOT EXISTS tipo_reporte VARCHAR(40) NOT NULL DEFAULT 'EVALUACION_PRIORIDAD'"
    );
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS dictamen VARCHAR(30) NULL");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS motivo_no_abordable TEXT NULL");
    expect(sqlEjecutado).toContain(
      "ADD COLUMN IF NOT EXISTS requiere_asistencia_social BOOLEAN NOT NULL DEFAULT false"
    );
    expect(sqlEjecutado).toContain("chk_reporte_terreno_dictamen");
    expect(sqlEjecutado).toContain("idx_reporte_terreno_tipo_reporte");
    expect(sqlEjecutado).toContain("reportes:crear");
    expect(sqlEjecutado).toContain("20000000-0000-4000-8000-000000000004");
    expect(sqlEjecutado).not.toContain("misiones:leer");
  });

  it("debe revertir columnas, restricción, índice y permiso en down", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("DELETE FROM rol_permiso");
    expect(sqlEjecutado).toContain("DELETE FROM permiso WHERE codigo = 'reportes:crear'");
    expect(sqlEjecutado).toContain("DROP INDEX IF EXISTS idx_reporte_terreno_tipo_reporte");
    expect(sqlEjecutado).toContain("DROP CONSTRAINT IF EXISTS chk_reporte_terreno_dictamen");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS requiere_asistencia_social");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS dictamen");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS tipo_reporte");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS motivo_no_abordable");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS fecha_cierre");
  });
});
