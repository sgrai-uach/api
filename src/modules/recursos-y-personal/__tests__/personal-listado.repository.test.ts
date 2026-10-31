import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock de la capa de datos para verificar las cláusulas generadas por el repositorio
 * de listado de personal (H11).
 */
const mockQuery = {
  where: vi.fn(),
  select: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  offset: vi.fn(),
  execute: vi.fn(),
  executeTakeFirst: vi.fn(),
};

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
