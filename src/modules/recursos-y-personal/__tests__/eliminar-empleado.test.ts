import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  eliminarEmpleadoLogico,
  EmpleadoEnMisionActivaError,
} from "../services/eliminar-empleado.service";
import { EmpleadoNotFoundError } from "../services/actualizar-empleado.service";
import { db } from "@/lib/db";

// Mock del cliente de base de datos Kysely
vi.mock("@/lib/db", () => {
  return {
    db: {
      transaction: vi.fn(),
    },
  };
});

describe("HU-13: Baja Lógica de Empleados (eliminarEmpleadoLogico)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lanza EmpleadoNotFoundError si el ID no existe en personal ni en usuarios", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => ({
        selectAll: () => ({
          where: () => ({
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
        select: () => ({
          where: () => ({
            executeTakeFirst: vi.fn().mockResolvedValue(null),
          }),
        }),
      })),
    };

    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTrx);
      }),
    });

    await expect(
      eliminarEmpleadoLogico("00000000-0000-0000-0000-000000000099")
    ).rejects.toThrow(EmpleadoNotFoundError);
  });

  it("lanza EmpleadoEnMisionActivaError si el empleado tiene estado operativo en_mision", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "personal") {
          return {
            selectAll: () => ({
              where: () => ({
                executeTakeFirst: vi.fn().mockResolvedValue({
                  id: "personal-456",
                  usuario_id: "usuario-123",
                  estado_operativo: "en_mision",
                  disponible_terreno: false,
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTrx);
      }),
    });

    await expect(eliminarEmpleadoLogico("personal-456")).rejects.toThrow(
      EmpleadoEnMisionActivaError
    );
  });

  it("lanza EmpleadoEnMisionActivaError si el usuario es delegado de cuadrilla activa en mision", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "personal") {
          return {
            selectAll: () => ({
              where: () => ({
                executeTakeFirst: vi.fn().mockResolvedValue(null),
              }),
            }),
          };
        }
        if (table === "usuarios") {
          return {
            select: () => ({
              where: () => ({
                executeTakeFirst: vi.fn().mockResolvedValue({
                  id: "usuario-123",
                  activo: true,
                }),
              }),
            }),
          };
        }
        if (table === "cuadrilla") {
          return {
            select: () => ({
              where: (col: string, op: string, val: string) => ({
                where: () => ({
                  executeTakeFirst: vi.fn().mockResolvedValue({
                    id: "cuadrilla-1",
                    nombre: "Cuadrilla Alfa",
                    estado: "EN_MISION",
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTrx);
      }),
    });

    await expect(eliminarEmpleadoLogico("usuario-123")).rejects.toThrow(
      EmpleadoEnMisionActivaError
    );
  });

  it("da de baja exitosamente a un usuario sin ficha de personal ni misiones activas", async () => {
    const updateExecute = vi.fn().mockResolvedValue([]);
    const insertExecute = vi.fn().mockResolvedValue([]);

    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "personal") {
          return {
            selectAll: () => ({
              where: () => ({
                executeTakeFirst: vi.fn().mockResolvedValue(null),
              }),
            }),
          };
        }
        if (table === "usuarios") {
          return {
            select: () => ({
              where: () => ({
                executeTakeFirst: vi.fn().mockResolvedValue({
                  id: "usuario-123",
                  activo: true,
                  fecha_salida: null,
                }),
              }),
            }),
          };
        }
        if (table === "cuadrilla" || table === "patrulla_verificadora") {
          return {
            select: () => ({
              where: () => ({
                where: () => ({
                  executeTakeFirst: vi.fn().mockResolvedValue(null),
                }),
              }),
            }),
          };
        }
        return {};
      }),
      updateTable: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: updateExecute,
          }),
        }),
      }),
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          execute: insertExecute,
        }),
      }),
    };

    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTrx);
      }),
    });

    const resultado = await eliminarEmpleadoLogico("usuario-123");

    expect(resultado.usuario_id).toBe("usuario-123");
    expect(resultado.activo).toBe(false);
    expect(resultado.fecha_salida).toBeDefined();
    expect(updateExecute).toHaveBeenCalledTimes(1);
    expect(insertExecute).toHaveBeenCalledTimes(1);
  });

  it("desactiva tanto el usuario como la ficha de personal cuando el empleado es operativo disponible", async () => {
    const updatePersonalExecute = vi.fn().mockResolvedValue([]);
    const updateUsuarioExecute = vi.fn().mockResolvedValue([]);
    const insertAuditExecute = vi.fn().mockResolvedValue([]);

    let updateCount = 0;
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "personal") {
          return {
            selectAll: () => ({
              where: () => ({
                executeTakeFirst: vi.fn().mockResolvedValue({
                  id: "personal-456",
                  usuario_id: "usuario-123",
                  estado_operativo: "disponible",
                  disponible_terreno: true,
                }),
              }),
            }),
          };
        }
        if (table === "usuarios") {
          return {
            select: () => ({
              where: () => ({
                executeTakeFirst: vi.fn().mockResolvedValue({
                  fecha_salida: "2026-05-01",
                }),
              }),
            }),
          };
        }
        if (table === "cuadrilla" || table === "patrulla_verificadora") {
          return {
            select: () => ({
              where: () => ({
                where: () => ({
                  executeTakeFirst: vi.fn().mockResolvedValue(null),
                }),
              }),
            }),
          };
        }
        return {};
      }),
      updateTable: vi.fn().mockImplementation((table: string) => {
        updateCount++;
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: table === "personal" ? updatePersonalExecute : updateUsuarioExecute,
            }),
          }),
        };
      }),
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          execute: insertAuditExecute,
        }),
      }),
    };

    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback) => {
        return callback(mockTrx);
      }),
    });

    const resultado = await eliminarEmpleadoLogico("personal-456");

    expect(resultado.usuario_id).toBe("usuario-123");
    expect(resultado.activo).toBe(false);
    expect(resultado.fecha_salida).toBe("2026-05-01");
    expect(updatePersonalExecute).toHaveBeenCalled();
    expect(updateUsuarioExecute).toHaveBeenCalled();
    expect(insertAuditExecute).toHaveBeenCalled();
  });
});
