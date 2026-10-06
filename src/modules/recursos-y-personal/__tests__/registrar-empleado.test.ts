import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registrarEmpleado,
  RutDuplicadoError,
  EmailDuplicadoError,
  RolNotFoundError,
  DelegacionNotFoundError,
} from "../services/registrar-empleado.service";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

import type { Transaction } from "kysely";
import type { Database } from "@/lib/db";

interface MockTrx {
  selectFrom: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  insertInto: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  executeTakeFirst: ReturnType<typeof vi.fn>;
  executeTakeFirstOrThrow: ReturnType<typeof vi.fn>;
}

type TrxParameter = Transaction<Database>;

describe("Módulo Recursos y Personal — Servicio registrarEmpleado", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const dtoBase = {
    rut: "12.345.678-5",
    nombres: "Esteban",
    apellidos: "Morales",
    email: "esteban.morales@valdivia.cl",
    telefono: "+56912345678",
    password: "Password2026",
    rol_id: "20000000-0000-4000-8000-000000000002",
    delegacion_id: "30000000-0000-4000-8000-000000000001",
    activo: true,
    estado_operativo: "disponible" as const,
    disponible_terreno: true,
  };

  function createBaseMockTrx(): MockTrx {
    const mockTrx: Partial<MockTrx> = {};
    mockTrx.selectFrom = vi.fn().mockReturnValue(mockTrx);
    mockTrx.leftJoin = vi.fn().mockReturnValue(mockTrx);
    mockTrx.select = vi.fn().mockReturnValue(mockTrx);
    mockTrx.where = vi.fn().mockReturnValue(mockTrx);
    mockTrx.insertInto = vi.fn().mockReturnValue(mockTrx);
    mockTrx.values = vi.fn().mockReturnValue(mockTrx);
    mockTrx.returning = vi.fn().mockReturnValue(mockTrx);
    mockTrx.execute = vi.fn().mockResolvedValue([]);
    mockTrx.executeTakeFirst = vi.fn().mockResolvedValue(null);
    mockTrx.executeTakeFirstOrThrow = vi.fn().mockResolvedValue({});
    return mockTrx as MockTrx;
  }

  it("debe lanzar RutDuplicadoError si el RUT ya existe en persistencia", async () => {
    const mockTrx = createBaseMockTrx();
    mockTrx.executeTakeFirst.mockResolvedValueOnce({ id: "usuario-existente" });

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: TrxParameter) => Promise<unknown>) => {
        return await callback(mockTrx as unknown as TrxParameter);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    await expect(
      registrarEmpleado(dtoBase, "admin-uuid")
    ).rejects.toThrow(RutDuplicadoError);
  });

  it("debe lanzar EmailDuplicadoError si el correo ya existe en persistencia", async () => {
    let callCount = 0;
    const mockTrx = createBaseMockTrx();
    mockTrx.executeTakeFirst.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return null; // RUT no existe
      if (callCount === 2) return { id: "email-existente" }; // Email sí existe
      return null;
    });

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: TrxParameter) => Promise<unknown>) => {
        return await callback(mockTrx as unknown as TrxParameter);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    await expect(
      registrarEmpleado(dtoBase, "admin-uuid")
    ).rejects.toThrow(EmailDuplicadoError);
  });

  it("debe lanzar RolNotFoundError si el rol_id no se encuentra en el catálogo", async () => {
    let callCount = 0;
    const mockTrx = createBaseMockTrx();
    mockTrx.executeTakeFirst.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return null; // RUT libre
      if (callCount === 2) return null; // Email libre
      if (callCount === 3) return null; // Rol NO encontrado
      return null;
    });

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: TrxParameter) => Promise<unknown>) => {
        return await callback(mockTrx as unknown as TrxParameter);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    await expect(
      registrarEmpleado(dtoBase, "admin-uuid")
    ).rejects.toThrow(RolNotFoundError);
  });

  it("debe lanzar DelegacionNotFoundError si la delegacion_id no se encuentra en el catálogo", async () => {
    let callCount = 0;
    const mockTrx = createBaseMockTrx();
    mockTrx.executeTakeFirst.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return null; // RUT libre
      if (callCount === 2) return null; // Email libre
      if (callCount === 3) return { id: "rol-id", codigo: "CALL_CENTER", nombre: "Call Center" }; // Rol existe
      if (callCount === 4) return null; // Delegación NO encontrada
      return null;
    });

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: TrxParameter) => Promise<unknown>) => {
        return await callback(mockTrx as unknown as TrxParameter);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    await expect(
      registrarEmpleado(dtoBase, "admin-uuid")
    ).rejects.toThrow(DelegacionNotFoundError);
  });

  it("debe insertar en usuario, registrar auditoría y retornar el funcionario consolidado", async () => {
    let selectCallCount = 0;
    const mockTrx = createBaseMockTrx();

    mockTrx.execute.mockResolvedValue([{ id: "nuevo-usuario-uuid" }]);
    mockTrx.executeTakeFirst.mockImplementation(async () => {
      selectCallCount++;
      if (selectCallCount === 1) return null; // RUT libre
      if (selectCallCount === 2) return null; // Email libre
      if (selectCallCount === 3) return { id: "rol-id", codigo: "CALL_CENTER", nombre: "Call Center" };
      if (selectCallCount === 4) return { id: "del-id", codigo: "DEL_NORTE", nombre: "Delegación Municipal Norte" };
      return null;
    });
    mockTrx.executeTakeFirstOrThrow.mockResolvedValue({
      usuario_id: "nuevo-usuario-uuid",
      rut: "12345678-5",
      nombres: "Esteban",
      apellidos: "Morales",
      email: "esteban.morales@valdivia.cl",
      telefono: "+56912345678",
      usuario_activo: true,
      fecha_ingreso: "2026-10-01",
      fecha_salida: null,
      rol_id: "rol-id",
      rol_codigo: "CALL_CENTER",
      rol_nombre: "Call Center",
      delegacion_id: "del-id",
      delegacion_codigo: "DEL_NORTE",
      delegacion_nombre: "Delegación Municipal Norte",
      personal_id: null,
      especialidad: null,
      cargo: null,
      estado_operativo: null,
      disponible_terreno: null,
      observaciones: null,
      personal_updated_at: null,
    });

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: TrxParameter) => Promise<unknown>) => {
        return await callback(mockTrx as unknown as TrxParameter);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    const spyBcrypt = vi.spyOn(bcrypt, "hash");

    const resultado = await registrarEmpleado(dtoBase, "admin-uuid");

    expect(spyBcrypt).toHaveBeenCalledWith("Password2026", 10);
    expect(mockTrx.insertInto).toHaveBeenCalledWith("usuario");
    expect(mockTrx.insertInto).toHaveBeenCalledWith("log_cambios_usuarios");
    expect(resultado.usuario_id).toBe("nuevo-usuario-uuid");
    expect(resultado.es_personal).toBe(false);
    expect(resultado.rut).toBe("12345678-5");
  });

  it("debe insertar en personal cuando el rol es de terreno (PATRULLA_VERIFICADORA)", async () => {
    const dtoTerreno = {
      ...dtoBase,
      rol_id: "20000000-0000-4000-8000-000000000004",
      cargo: "Patrullero Terreno",
      especialidad: "Evaluador Rápido",
    };

    let selectCallCount = 0;
    const mockTrx = createBaseMockTrx();

    mockTrx.execute.mockResolvedValue([{ id: "nuevo-id-generado" }]);
    mockTrx.executeTakeFirst.mockImplementation(async () => {
      selectCallCount++;
      if (selectCallCount === 1) return null; // RUT libre
      if (selectCallCount === 2) return null; // Email libre
      if (selectCallCount === 3) return { id: "rol-id", codigo: "PATRULLA_VERIFICADORA", nombre: "Patrulla Verificadora" };
      if (selectCallCount === 4) return { id: "del-id", codigo: "DEL_SUR", nombre: "Delegación Municipal Sur" };
      return null;
    });
    mockTrx.executeTakeFirstOrThrow.mockResolvedValue({
      usuario_id: "nuevo-usuario-uuid",
      rut: "12345678-5",
      nombres: "Esteban",
      apellidos: "Morales",
      email: "esteban.morales@valdivia.cl",
      telefono: "+56912345678",
      usuario_activo: true,
      fecha_ingreso: "2026-10-01",
      fecha_salida: null,
      rol_id: "rol-id",
      rol_codigo: "PATRULLA_VERIFICADORA",
      rol_nombre: "Patrulla Verificadora",
      delegacion_id: "del-id",
      delegacion_codigo: "DEL_SUR",
      delegacion_nombre: "Delegación Municipal Sur",
      personal_id: "nuevo-personal-uuid",
      especialidad: "Evaluador Rápido",
      cargo: "Patrullero Terreno",
      estado_operativo: "disponible",
      disponible_terreno: true,
      observaciones: null,
      personal_updated_at: null,
    });

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: TrxParameter) => Promise<unknown>) => {
        return await callback(mockTrx as unknown as TrxParameter);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    const resultado = await registrarEmpleado(dtoTerreno, "admin-uuid");

    expect(mockTrx.insertInto).toHaveBeenCalledWith("usuario");
    expect(mockTrx.insertInto).toHaveBeenCalledWith("personal");
    expect(mockTrx.insertInto).toHaveBeenCalledWith("log_cambios_usuarios");
    expect(resultado.es_personal).toBe(true);
    expect(resultado.personal_id).toBe("nuevo-personal-uuid");
  });

  it("debe omitir inserción en personal si el funcionario es administrativo y no posee atributos de terreno (BUG-H10-API-01)", async () => {
    const dtoAdministrativo = {
      rut: "12.345.678-5",
      nombres: "Beatriz",
      apellidos: "Riquelme",
      email: "beatriz.riquelme@valdivia.cl",
      telefono: "+56977889900",
      password: "Password2026",
      rol_id: "20000000-0000-4000-8000-000000000002",
      delegacion_id: "30000000-0000-4000-8000-000000000001",
      activo: true,
    };

    let selectCallCount = 0;
    const mockTrx = createBaseMockTrx();

    mockTrx.execute.mockResolvedValue([{ id: "nuevo-usuario-uuid" }]);
    mockTrx.executeTakeFirst.mockImplementation(async () => {
      selectCallCount++;
      if (selectCallCount === 1) return null; // RUT libre
      if (selectCallCount === 2) return null; // Email libre
      if (selectCallCount === 3) return { id: "rol-id", codigo: "CALL_CENTER", nombre: "Call Center" };
      if (selectCallCount === 4) return { id: "del-id", codigo: "DEL_NORTE", nombre: "Delegación Municipal Norte" };
      return null;
    });
    mockTrx.executeTakeFirstOrThrow.mockResolvedValue({
      usuario_id: "nuevo-usuario-uuid",
      rut: "12345678-5",
      nombres: "Beatriz",
      apellidos: "Riquelme",
      email: "beatriz.riquelme@valdivia.cl",
      telefono: "+56977889900",
      usuario_activo: true,
      fecha_ingreso: "2026-10-01",
      fecha_salida: null,
      rol_id: "rol-id",
      rol_codigo: "CALL_CENTER",
      rol_nombre: "Call Center",
      delegacion_id: "del-id",
      delegacion_codigo: "DEL_NORTE",
      delegacion_nombre: "Delegación Municipal Norte",
      personal_id: null,
      especialidad: null,
      cargo: null,
      estado_operativo: null,
      disponible_terreno: null,
      observaciones: null,
      personal_updated_at: null,
    });

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: TrxParameter) => Promise<unknown>) => {
        return await callback(mockTrx as unknown as TrxParameter);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    const resultado = await registrarEmpleado(dtoAdministrativo, "admin-uuid");

    expect(mockTrx.insertInto).toHaveBeenCalledWith("usuario");
    expect(mockTrx.insertInto).not.toHaveBeenCalledWith("personal");
    expect(mockTrx.insertInto).toHaveBeenCalledWith("log_cambios_usuarios");
    expect(resultado.es_personal).toBe(false);
    expect(resultado.personal_id).toBeNull();
  });
});
