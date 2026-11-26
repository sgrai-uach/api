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
import {
  up,
  down,
} from "../046_eventos_prevencion_permiso_leer_y_borrado_logico";

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
      createIntrospector: (inst: Kysely<any>) => new PostgresIntrospector(inst),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, sql: () => driver.queries.map((q) => q.sql).join("\n") };
}

describe("Migración 046 - Permiso prevencion:eventos:leer y borrado lógico (H76)", () => {
  it("debe agregar columnas de borrado lógico, índices, normalizar EN_EJECUCION y registrar permiso en up", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain("ALTER TABLE evento_prevencion");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS eliminado_en TIMESTAMPTZ DEFAULT NULL");
    expect(sqlEjecutado).toContain("ADD COLUMN IF NOT EXISTS eliminado_por_id UUID REFERENCES usuario(id)");
    expect(sqlEjecutado).toContain("idx_evento_prevencion_activo_eliminado");
    expect(sqlEjecutado).toContain("idx_evento_prevencion_creado_en_desc");
    expect(sqlEjecutado).toContain("SET estado = 'EN_EJECUCION'");
    expect(sqlEjecutado).toContain("prevencion:eventos:leer");
  });

  it("debe revertir permiso, índices y columnas de borrado lógico en down", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();
    expect(sqlEjecutado).toContain("DELETE FROM rol_permiso");
    expect(sqlEjecutado).toContain("DELETE FROM permiso WHERE codigo = 'prevencion:eventos:leer'");
    expect(sqlEjecutado).toContain("idx_evento_prevencion_creado_en_desc");
    expect(sqlEjecutado).toContain("idx_evento_prevencion_activo_eliminado");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS eliminado_por_id");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS eliminado_en");
    expect(sqlEjecutado).toContain("DROP COLUMN IF EXISTS activo");
  });
});
