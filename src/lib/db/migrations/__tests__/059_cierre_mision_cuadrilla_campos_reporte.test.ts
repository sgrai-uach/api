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
import { up, down } from "../059_cierre_mision_cuadrilla_campos_reporte";

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

describe("Migración 059 - Cierre de misión de cuadrilla y reporte técnico final (HU-68)", () => {
  it("debe agregar columnas horas_hombre y materiales_consumidos en reporte_terreno, restricción y permisos RBAC", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("ALTER TABLE reporte_terreno");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS horas_hombre NUMERIC(6, 2) NULL");
    expect(sqlEjecutado).toContain(
      "ADD COLUMN IF NOT EXISTS materiales_consumidos JSONB NOT NULL DEFAULT '[]'::jsonb"
    );
    expect(sqlEjecutado).toContain("chk_reporte_terreno_horas_hombre");
    expect(sqlEjecutado).toContain("misiones:terreno:ejecutar");
    expect(sqlEjecutado).toContain("recursos:leer");
    expect(sqlEjecutado).toContain("20000000-0000-4000-8000-000000000005");
  });

  it("debe revertir la asociación recursos:leer de DELEGADO_CUADRILLA, la restricción y las columnas en down", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("DELETE FROM rol_permiso");
    expect(sqlEjecutado).toContain("20000000-0000-4000-8000-000000000005");
    expect(sqlEjecutado).toContain("recursos:leer");
    expect(sqlEjecutado).toContain("DROP CONSTRAINT IF EXISTS chk_reporte_terreno_horas_hombre");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS materiales_consumidos");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS horas_hombre");
  });
});
