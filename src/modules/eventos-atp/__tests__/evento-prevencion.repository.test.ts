/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
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
import type { Database } from "@/lib/db/types";

const { mockState, crearDbMock } = vi.hoisted(() => {
  const state = {
    queries: [] as CompiledQuery[],
    responses: [] as any[][],
  };

  class MockConnection implements DatabaseConnection {
    async executeQuery(compiledQuery: CompiledQuery): Promise<QueryResult<any>> {
      state.queries.push(compiledQuery);
      const rows = state.responses.shift() ?? [];
      return { rows };
    }
    async *streamQuery(): AsyncIterableIterator<never> {}
  }

  class MockDriver implements Driver {
    async init(): Promise<void> {}
    async acquireConnection(): Promise<DatabaseConnection> {
      return new MockConnection();
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

  return {
    mockState: state,
    crearDbMock: () =>
      new Kysely<Database>({
        dialect: {
          createAdapter: () => new PostgresAdapter(),
          createDriver: () => new MockDriver(),
          createIntrospector: (inst: Kysely<any>) => new PostgresIntrospector(inst),
          createQueryCompiler: () => new PostgresQueryCompiler(),
        },
      }),
  };
});

vi.mock("@/lib/db", () => ({
  db: crearDbMock(),
}));

import { listarEventosPrevencionPaginados } from "../evento-prevencion.repository";

describe("Repositorio EventoPrevencion - listarEventosPrevencionPaginados (H76)", () => {
  beforeEach(() => {
    mockState.queries = [];
    mockState.responses = [];
  });

  it("BUG-H76-API-01: debe retornar temprano cuando page > totalPages y total > 0 sin ejecutar IN ()", async () => {
    // 1a consulta: COUNT -> 6; 2a consulta: SELECT paginado -> []
    mockState.responses.push([{ total: "6" }], []);

    const res = await listarEventosPrevencionPaginados({
      page: 99,
      limit: 20,
    });

    expect(res.total).toBe(6);
    expect(res.eventos).toEqual([]);
    expect(res.misionesPorEvento.size).toBe(0);
    expect(res.recursosPorEvento.size).toBe(0);
    // Solo debe ejecutar COUNT y SELECT paginado (2 consultas, nunca mision ni recursos)
    expect(mockState.queries).toHaveLength(2);
    expect(mockState.queries[1].sql).toContain('order by "ep"."creado_en" desc, "ep"."id" desc');
  });

  it("debe aplicar filtros combinados, borrado lógico, escape ILIKE y prioridad de misión activa", async () => {
    mockState.responses.push(
      [{ total: "1" }],
      [{ ep_id: "ev-1" }],
      [
        {
          evento_prevencion_id: "ev-1",
          m_id: "mis-activa",
          m_codigo: "MIS-2026-0001",
          m_titulo: "Operativo",
          m_estado: "EN_CURSO",
          m_tipo_mision: "PREVENCION",
          m_fecha_inicio: new Date(),
          m_fecha_cierre: null,
          pv_id: "pat-1",
          pv_nombre: "Patrulla 1",
          pv_estado: "EN_PREVENCION",
          c_id: null,
          c_nombre: null,
          c_estado: null,
        },
        {
          evento_prevencion_id: "ev-1",
          m_id: "mis-cancelada",
          m_codigo: "MIS-2026-0000",
          m_titulo: "Operativo",
          m_estado: "CANCELADA",
          m_tipo_mision: "PREVENCION",
          m_fecha_inicio: new Date(),
          m_fecha_cierre: null,
          pv_id: null,
          pv_nombre: null,
          pv_estado: null,
          c_id: null,
          c_nombre: null,
          c_estado: null,
        },
      ],
      [
        {
          evento_prevencion_id: "ev-1",
          recurso_id: "rec-1",
          recurso_nombre: "Sacos",
          cantidad_asignada: 5,
        },
      ]
    );

    const res = await listarEventosPrevencionPaginados({
      page: 1,
      limit: 10,
      delegacionId: "30000000-0000-4000-8000-000000000002",
      estado: "EN_EJECUCION",
      busqueda: "100%_test",
    });

    expect(res.total).toBe(1);
    expect(res.eventos).toHaveLength(1);
    expect(res.misionesPorEvento.get("ev-1")?.m_id).toBe("mis-activa");
    expect(res.recursosPorEvento.get("ev-1")).toHaveLength(1);

    const countQuery = mockState.queries[0];
    expect(countQuery.sql).toContain('"ep"."activo" = $1');
    expect(countQuery.sql).toContain('"ep"."eliminado_en" is null');
    expect(countQuery.sql).toContain('"ep"."delegacion_id" = $');
    expect(countQuery.sql).toContain('"ep"."estado" = $');
    expect(countQuery.sql).toContain("ilike");
    expect(countQuery.parameters).toContain("%100\\%\\_test%");

    const misionQuery = mockState.queries[2];
    expect(misionQuery.sql).toContain(
      "CASE WHEN m.estado IN ('EN_CURSO', 'DESPACHADA') THEN 0 ELSE 1 END"
    );
    expect(misionQuery.sql).toContain('"m"."id" desc');
  });
});
