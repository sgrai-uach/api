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
import { up, down } from "../025_disponibilidad_usuario";

/**
 * Driver de pruebas que captura el SQL emitido por la migración sin tocar una base real.
 */
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

describe("Migración 025 - Disponibilidad operacional en usuario (H11)", () => {
  it("debe renombrar el enum, agregar la columna, copiar el estado desde personal y eliminar la columna duplicada", async () => {
    const { db, sql } = crearDbDePruebas();

    await up(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain("ALTER TYPE estado_operativo_personal RENAME TO estado_operativo");
    expect(sqlEjecutado).toContain(
      "ADD COLUMN IF NOT EXISTS estado_operativo estado_operativo NOT NULL DEFAULT 'disponible'"
    );
    // Copia del estado histórico desde la ficha de terreno
    expect(sqlEjecutado).toContain("UPDATE usuario u");
    expect(sqlEjecutado).toContain("SET estado_operativo = p.estado_operativo");
    expect(sqlEjecutado).toContain("FROM personal p");
    // Cuentas deshabilitadas quedan inactivas
    expect(sqlEjecutado).toContain("SET estado_operativo = 'inactivo'");
    expect(sqlEjecutado).toContain("WHERE activo = false");
    // Una sola fuente de verdad
    expect(sqlEjecutado).toContain("ALTER TABLE personal DROP COLUMN IF EXISTS estado_operativo");
    // Índice dedicado
    expect(sqlEjecutado).toContain(
      "CREATE INDEX IF NOT EXISTS idx_usuario_estado_operativo ON usuario(estado_operativo)"
    );
  });

  it("debe revertir el modelo restaurando personal.estado_operativo y el nombre original del enum", async () => {
    const { db, sql } = crearDbDePruebas();

    await down(db);

    const sqlEjecutado = sql();

    expect(sqlEjecutado).toContain(
      "ADD COLUMN IF NOT EXISTS estado_operativo estado_operativo NOT NULL DEFAULT 'disponible'"
    );
    expect(sqlEjecutado).toContain("SET estado_operativo = u.estado_operativo");
    expect(sqlEjecutado).toContain("ALTER TABLE usuario DROP COLUMN IF EXISTS estado_operativo");
    expect(sqlEjecutado).toContain("ALTER TYPE estado_operativo RENAME TO estado_operativo_personal");
  });
});
