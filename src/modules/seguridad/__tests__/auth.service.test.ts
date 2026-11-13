import { describe, it, expect, vi, beforeEach } from "vitest";
import { verificarPermiso } from "../auth.service";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "../auth.errors";

vi.mock("@/lib/db", () => {
  const mockSelectFrom = vi.fn();
  return {
    db: {
      selectFrom: mockSelectFrom,
    },
  };
});

describe("auth.service - verificarPermiso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const usuarioIdValido = "00000000-0000-4000-8000-000000000004";

  it("debe lanzar UnauthorizedError si el usuarioId es nulo o vacío", async () => {
    await expect(verificarPermiso(null, "misiones:terreno:verificar")).rejects.toThrow(
      UnauthorizedError
    );
    await expect(verificarPermiso("   ", "misiones:terreno:verificar")).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("debe lanzar UnauthorizedError si el usuarioId no tiene formato UUID", async () => {
    await expect(verificarPermiso("no-es-uuid", "misiones:terreno:verificar")).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("debe lanzar UnauthorizedError si el usuario no existe en la base de datos", async () => {
    const executeTakeFirstMock = vi.fn().mockResolvedValueOnce(undefined);
    const whereMock = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstMock });
    const selectMock = vi.fn().mockReturnValue({ where: whereMock });
    const innerJoinMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(db.selectFrom).mockReturnValue({ innerJoin: innerJoinMock } as any);

    await expect(verificarPermiso(usuarioIdValido, "misiones:terreno:verificar")).rejects.toThrow(
      `Usuario con ID '${usuarioIdValido}' no existe o no está autorizado.`
    );
  });

  it("debe lanzar UnauthorizedError si el usuario existe pero tiene activo = false (BUG-H69-API-03)", async () => {
    const usuarioInactivo = {
      id: usuarioIdValido,
      nombre: "Patrullero Inactivo",
      activo: false,
      rol_nombre: "PATRULLA_VERIFICADORA",
      rol_id: "20000000-0000-4000-8000-000000000004",
    };

    const executeTakeFirstMock = vi.fn().mockResolvedValueOnce(usuarioInactivo);
    const whereMock = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstMock });
    const selectMock = vi.fn().mockReturnValue({ where: whereMock });
    const innerJoinMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(db.selectFrom).mockReturnValue({ innerJoin: innerJoinMock } as any);

    await expect(verificarPermiso(usuarioIdValido, "misiones:terreno:verificar")).rejects.toThrow(
      "El usuario especificado se encuentra inactivo en la institución."
    );
  });

  it("debe retornar el usuario inmediatamente si es Administrador y está activo", async () => {
    const adminActivo = {
      id: usuarioIdValido,
      nombre: "Administrador Central",
      activo: true,
      rol_nombre: "Administrador",
      rol_id: "20000000-0000-4000-8000-000000000001",
    };

    const executeTakeFirstMock = vi.fn().mockResolvedValueOnce(adminActivo);
    const whereMock = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstMock });
    const selectMock = vi.fn().mockReturnValue({ where: whereMock });
    const innerJoinMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(db.selectFrom).mockReturnValue({ innerJoin: innerJoinMock } as any);

    const res = await verificarPermiso(usuarioIdValido, "cualquier:permiso");
    expect(res).toEqual({
      id: usuarioIdValido,
      nombre: "Administrador Central",
      rol: "Administrador",
    });
  });

  it("debe lanzar ForbiddenError si el usuario activo no posee el permiso requerido", async () => {
    const usuarioOperativo = {
      id: usuarioIdValido,
      nombre: "Operador Regular",
      activo: true,
      rol_nombre: "PATRULLA_VERIFICADORA",
      rol_id: "20000000-0000-4000-8000-000000000004",
    };

    // Primera query: usuario
    const executeTakeFirstMock = vi.fn().mockResolvedValueOnce(usuarioOperativo);
    const whereUsuario = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstMock });
    const selectUsuario = vi.fn().mockReturnValue({ where: whereUsuario });
    const innerJoinUsuario = vi.fn().mockReturnValue({ select: selectUsuario });

    // Segunda query: rol_permiso
    const executePermisosMock = vi.fn().mockResolvedValueOnce([{ codigo: "otro:permiso" }]);
    const wherePermisos = vi.fn().mockReturnValue({ execute: executePermisosMock });
    const selectPermisos = vi.fn().mockReturnValue({ where: wherePermisos });
    const innerJoinPermisos = vi.fn().mockReturnValue({ select: selectPermisos });

    vi.mocked(db.selectFrom)
      .mockReturnValueOnce({ innerJoin: innerJoinUsuario } as any)
      .mockReturnValueOnce({ innerJoin: innerJoinPermisos } as any);

    await expect(verificarPermiso(usuarioIdValido, "misiones:terreno:verificar")).rejects.toThrow(
      ForbiddenError
    );
  });

  it("debe retornar el usuario si está activo y posee el permiso requerido", async () => {
    const usuarioOperativo = {
      id: usuarioIdValido,
      nombre: "Patrullero Juan",
      activo: true,
      rol_nombre: "PATRULLA_VERIFICADORA",
      rol_id: "20000000-0000-4000-8000-000000000004",
    };

    const executeTakeFirstMock = vi.fn().mockResolvedValueOnce(usuarioOperativo);
    const whereUsuario = vi.fn().mockReturnValue({ executeTakeFirst: executeTakeFirstMock });
    const selectUsuario = vi.fn().mockReturnValue({ where: whereUsuario });
    const innerJoinUsuario = vi.fn().mockReturnValue({ select: selectUsuario });

    const executePermisosMock = vi
      .fn()
      .mockResolvedValueOnce([{ codigo: "misiones:terreno:verificar" }]);
    const wherePermisos = vi.fn().mockReturnValue({ execute: executePermisosMock });
    const selectPermisos = vi.fn().mockReturnValue({ where: wherePermisos });
    const innerJoinPermisos = vi.fn().mockReturnValue({ select: selectPermisos });

    vi.mocked(db.selectFrom)
      .mockReturnValueOnce({ innerJoin: innerJoinUsuario } as any)
      .mockReturnValueOnce({ innerJoin: innerJoinPermisos } as any);

    const res = await verificarPermiso(usuarioIdValido, "misiones:terreno:verificar");
    expect(res).toEqual({
      id: usuarioIdValido,
      nombre: "Patrullero Juan",
      rol: "PATRULLA_VERIFICADORA",
    });
  });
});

