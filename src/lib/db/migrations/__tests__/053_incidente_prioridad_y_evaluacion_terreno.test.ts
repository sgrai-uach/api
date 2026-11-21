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
import { up, down } from "../053_incidente_prioridad_y_evaluacion_terreno";

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

describe("Migración 053 - Prioridad sugerida de incidente y evaluación de terreno (HU-38)", () => {
  it("debe agregar prioridad_sugerida y justificacion_prioridad en incidente, y columnas de evaluación versionada en reporte_terreno", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("ALTER TABLE incidente");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS prioridad_sugerida VARCHAR(20)");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS justificacion_prioridad TEXT");
    expect(sqlEjecutado).toContain("chk_incidente_prioridad_sugerida");

    expect(sqlEjecutado).toContain("ALTER TABLE reporte_terreno");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS version_reporte INTEGER NOT NULL DEFAULT 1");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS es_rectificacion BOOLEAN NOT NULL DEFAULT false");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS prioridad_sugerida VARCHAR(20)");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS prioridad_asignada VARCHAR(20)");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS detalles_evaluacion JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(sqlEjecutado).toContain("CREATE INDEX IF NOT EXISTS idx_reporte_terreno_mision_version");
  });

  it("debe revertir los cambios eliminando índice, restricción y columnas en down", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("DROP INDEX IF EXISTS idx_reporte_terreno_mision_version");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS detalles_evaluacion");
    expect(sqlEjecutado).toContain("DROP CONSTRAINT IF EXISTS chk_incidente_prioridad_sugerida");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS prioridad_sugerida");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS justificacion_prioridad");
  });
});

