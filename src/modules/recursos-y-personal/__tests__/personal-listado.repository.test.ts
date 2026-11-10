import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock de la capa de datos para verificar las cláusulas generadas por el repositorio
 * de listado de personal (H11).
 */
const mockBuilder = {
  selectFrom: vi.fn(),
  leftJoin: vi.fn(),
  where: vi.fn(),
  select: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    selectFrom: (...args: unknown[]) => mockBuilder.selectFrom(...args),
  },
}));

import { listarPersonalPaginadoRepo } from "../personal-listado.repository";

describe("Repositorio de listado de personal (H11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockBuilder.selectFrom.mockReturnValue(mockBuilder);
    mockBuilder.leftJoin.mockReturnValue(mockBuilder);
    mockBuilder.where.mockReturnValue(mockBuilder);
    mockBuilder.select.mockReturnValue(mockBuilder);
    mockBuilder.orderBy.mockReturnValue(mockBuilder);
    mockBuilder.limit.mockReturnValue(mockBuilder);
    mockBuilder.offset.mockReturnValue(mockBuilder);
    mockBuilder.execute.mockResolvedValue([]);
    mockBuilder.executeTakeFirst.mockResolvedValue({ total: 0 });
  });

  it("debe consultar las tablas canónicas (usuario, rol, delegacion) y no las vistas plurales", async () => {
    await listarPersonalPaginadoRepo({
      page: 1,
      limit: 20,
      ordenarPor: "apellidos",
      orden: "asc",
    });

    expect(mockBuilder.selectFrom).toHaveBeenCalledWith("usuario");
    const joins = mockBuilder.leftJoin.mock.calls.map((c) => c[0]);
    expect(joins).toEqual(["rol", "delegacion", "personal"]);
  });

  it("debe proyectar usuario.estado_operativo y personal.disponible_terreno", async () => {
    await listarPersonalPaginadoRepo({
      page: 1,
      limit: 20,
      ordenarPor: "apellidos",
      orden: "asc",
    });

    const columnas = mockBuilder.select.mock.calls.at(-1)?.[0] as string[];
    expect(columnas).toContain("usuario.estado_operativo");
    expect(columnas).toContain("personal.disponible_terreno");
    expect(columnas).not.toContain("personal.estado_operativo");
  });

  it("debe referenciar la tabla canónica 'usuario' en la subconsulta de casos FIBE", async () => {
    await listarPersonalPaginadoRepo({
      page: 1,
      limit: 20,
      ordenarPor: "apellidos",
      orden: "asc",
    });

    const columnas = mockBuilder.select.mock.calls.at(-1)?.[0] as unknown[];
    const expresionRaw = columnas.find(
      (columna): columna is { toOperationNode: () => { node?: { sqlFragments?: string[] } } } =>
        typeof columna === "object" &&
        columna !== null &&
        "toOperationNode" in columna
    );

    expect(expresionRaw).toBeDefined();

    const fragmentos = expresionRaw?.toOperationNode().node?.sqlFragments?.join(" ") ?? "";
    expect(fragmentos).toContain("usuario.id");
    expect(fragmentos).not.toContain("usuarios.id");
  });

  it("debe filtrar el estado operativo contra usuario.estado_operativo", async () => {
    await listarPersonalPaginadoRepo({
      page: 1,
      limit: 20,
      estadoOperativo: "en_mision",
      ordenarPor: "apellidos",
      orden: "asc",
    });

    const where = mockBuilder.where.mock.calls;
    expect(where).toContainEqual(["usuario.estado_operativo", "=", "en_mision"]);
  });

  it("debe excluir por defecto a los usuarios inactivos y incluirlos con incluirInactivos", async () => {
    await listarPersonalPaginadoRepo({
      page: 1,
      limit: 20,
      ordenarPor: "apellidos",
      orden: "asc",
    });

    expect(mockBuilder.where).toHaveBeenCalledWith("usuario.activo", "=", true);

    vi.clearAllMocks();
    mockBuilder.where.mockReturnValue(mockBuilder);
    mockBuilder.select.mockReturnValue(mockBuilder);
    mockBuilder.orderBy.mockReturnValue(mockBuilder);
    mockBuilder.limit.mockReturnValue(mockBuilder);
    mockBuilder.offset.mockReturnValue(mockBuilder);
    mockBuilder.executeTakeFirst.mockResolvedValue({ total: 0 });

    await listarPersonalPaginadoRepo({
      page: 1,
      limit: 20,
      incluirInactivos: true,
      ordenarPor: "apellidos",
      orden: "asc",
    });

    expect(mockBuilder.where).not.toHaveBeenCalledWith("usuario.activo", "=", true);
  });

  it("debe filtrar soloPersonal por la existencia de ficha de terreno", async () => {
    await listarPersonalPaginadoRepo({
      page: 1,
      limit: 20,
      soloPersonal: true,
      ordenarPor: "apellidos",
      orden: "asc",
    });

    expect(mockBuilder.where).toHaveBeenCalledWith("personal.id", "is not", null);
  });

  describe("Exclusión de funcionarios asignados a cuadrillas activas", () => {
    /**
     * Extrae el texto SQL y los parámetros de una expresión cruda de Kysely.
     */
    function analizarExpresion(nodo: unknown): { sql: string; parametros: string[] } {
      if (typeof nodo === "string") return { sql: nodo, parametros: [] };
      if (!nodo || typeof nodo !== "object") return { sql: "", parametros: [] };

      const obj = nodo as { sqlFragments?: unknown[]; parameters?: unknown[]; value?: unknown };

      if ("value" in obj && obj.value !== undefined) {
        return { sql: "", parametros: [String(obj.value)] };
      }

      const fragmentos = (obj.sqlFragments ?? []).map(analizarExpresion);
      const nodosParametro = (obj.parameters ?? []).map(analizarExpresion);
      const parametros = nodosParametro.flatMap((p) => p.parametros);

      return {
        sql: [...fragmentos.map((f) => f.sql), ...nodosParametro.map((p) => p.sql)].join(" "),
        parametros: [...fragmentos.flatMap((f) => f.parametros), ...parametros],
      };
    }

    function obtenerExpresionDeFiltro(): { sql: string; parametros: string[] } {
      const llamadas = mockBuilder.where.mock.calls;
      const expresion = llamadas
        .map((c) => c[0])
        .find(
          (arg) =>
            arg !== null &&
            typeof arg === "object" &&
            "toOperationNode" in (arg as Record<string, unknown>)
        );

      expect(expresion).toBeDefined();
      const nodo = (expresion as { toOperationNode: () => unknown }).toOperationNode();
      return analizarExpresion(nodo);
    }

    it("no debe aplicar el filtro de asignación cuando sinAsignacionCuadrilla es false", async () => {
      await listarPersonalPaginadoRepo({
        page: 1,
        limit: 20,
        sinAsignacionCuadrilla: false,
        ordenarPor: "apellidos",
        orden: "asc",
      });

      const sqlGenerado = mockBuilder.where.mock.calls
        .map((c) => c[0])
        .filter(
          (arg) =>
            arg !== null &&
            typeof arg === "object" &&
            "toOperationNode" in (arg as Record<string, unknown>)
        );

      expect(sqlGenerado).toHaveLength(0);
    });

    it("debe excluir a los delegados y a los integrantes de cuadrillas activas", async () => {
      await listarPersonalPaginadoRepo({
        page: 1,
        limit: 20,
        sinAsignacionCuadrilla: true,
        ordenarPor: "apellidos",
        orden: "asc",
      });

      const { sql } = obtenerExpresionDeFiltro();

      expect(sql).toContain("NOT EXISTS");
      expect(sql).toContain("cuadrilla c_delegado");
      expect(sql).toContain("cuadrilla_personal");
      expect(sql).toContain("c_integrante");
    });

    it("debe considerar la cuadrilla excluida al evaluar las asignaciones", async () => {
      await listarPersonalPaginadoRepo({
        page: 1,
        limit: 20,
        sinAsignacionCuadrilla: true,
        excluirCuadrillaId: "50000000-0000-4000-8000-000000000001",
        ordenarPor: "apellidos",
        orden: "asc",
      });

      const { sql, parametros } = obtenerExpresionDeFiltro();

      expect(sql).toContain("<>");
      expect(parametros).toContain("50000000-0000-4000-8000-000000000001");
    });
  });

  it("debe ordenar por apellidos, nombres o RUT de la tabla usuario", async () => {
    await listarPersonalPaginadoRepo({
      page: 1,
      limit: 20,
      ordenarPor: "rut",
      orden: "desc",
    });

    expect(mockBuilder.orderBy).toHaveBeenCalledWith("usuario.rut", "desc");

    vi.clearAllMocks();
    mockBuilder.orderBy.mockReturnValue(mockBuilder);
    mockBuilder.select.mockReturnValue(mockBuilder);
    mockBuilder.where.mockReturnValue(mockBuilder);
    mockBuilder.limit.mockReturnValue(mockBuilder);
    mockBuilder.offset.mockReturnValue(mockBuilder);

    await listarPersonalPaginadoRepo({
      page: 1,
      limit: 20,
      ordenarPor: "apellidos",
      orden: "asc",
    });

    expect(mockBuilder.orderBy).toHaveBeenCalledWith("usuario.apellidos", "asc");
  });
});
