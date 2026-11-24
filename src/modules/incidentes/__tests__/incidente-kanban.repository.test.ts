import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostgresQueryCompiler, createQueryId } from "kysely";
import { db } from "@/lib/db";
import { listarIncidentesPaginadosRepo } from "../incidente-kanban.repository";

describe("incidente-kanban.repository (trazabilidad activa)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("restringe las subconsultas de trazabilidad a misiones activas excluyendo RECHAZADA y CANCELADA", async () => {
    const compilador = new PostgresQueryCompiler();
    const columnasSeleccionadas: unknown[] = [];

    const crearBuilder = (esConteo = false) => {
      const builder: Record<string, unknown> = {
        leftJoin: vi.fn(() => builder),
        where: vi.fn(() => builder),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        offset: vi.fn(() => builder),
        clone: vi.fn(() => crearBuilder(esConteo)),
        select: vi.fn((cols: unknown) => {
          if (Array.isArray(cols)) {
            columnasSeleccionadas.push(...cols);
          } else {
            return crearBuilder(true);
          }
          return builder;
        }),
        executeTakeFirst: vi.fn().mockResolvedValue({ total: 0 }),
        execute: vi.fn().mockResolvedValue([]),
      };
      return builder;
    };

    vi.spyOn(db, "selectFrom").mockImplementation(() => crearBuilder(false) as never);

    await listarIncidentesPaginadosRepo({ page: 1, limit: 20 });

    const sqlPorAlias = new Map<string, string>();
    for (const col of columnasSeleccionadas) {
      if (col && typeof col === "object" && "toOperationNode" in col) {
        const node = (col as { toOperationNode: () => { alias?: { name?: string }; node?: unknown } }).toOperationNode();
        const alias = node?.alias?.name;
        if (alias && alias.startsWith("trazabilidad_")) {
          const compiled = compilador.compileQuery(
            {
              kind: "SelectQueryNode",
              selections: [{ kind: "SelectionNode", selection: node as never }],
            },
            createQueryId()
          );
          sqlPorAlias.set(alias, compiled.sql);
        }
      }
    }

    expect(sqlPorAlias.has("trazabilidad_notificacion")).toBe(true);
    expect(sqlPorAlias.has("trazabilidad_mision_id")).toBe(true);
    expect(sqlPorAlias.has("trazabilidad_tipo_unidad")).toBe(true);

    for (const alias of [
      "trazabilidad_notificacion",
      "trazabilidad_mision_id",
      "trazabilidad_tipo_unidad",
    ]) {
      const querySql = sqlPorAlias.get(alias) ?? "";
      expect(querySql).toContain("m.estado IN ('PLANIFICADA', 'DESPACHADA', 'EN_CURSO')");
    }
  });
});
