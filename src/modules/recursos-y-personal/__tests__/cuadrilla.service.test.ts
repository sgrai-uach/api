import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CrearCuadrillaInputSchema,
  CuadrillaResponseSchema,
} from "../cuadrilla.schema";
import { crearCuadrilla } from "../cuadrilla.service";
import * as cuadrillaRepository from "../cuadrilla.repository";
import * as socketLib from "@/lib/socket";
import { seguridadService } from "@/modules/seguridad/service";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "@/modules/seguridad/errors";

describe("Módulo Recursos y Personal - Servicio de Cuadrillas Operativas (H79)", () => {
  const usuarioAdmin = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@valdivia.cl",
    rol: "ADMIN",
    permisos: ["recursos:crear"],
  };

  const inputValido = {
    nombre: "Cuadrilla Vías y Calles",
    delegacionId: "30000000-0000-4000-8000-000000000001",
    usuarioDelegadoId: "00000000-0000-4000-8000-000000000005",
  };

  const delegacionMock = {
    id: "30000000-0000-4000-8000-000000000001",
    nombre: "Delegación Municipal Calle Calle",
    activo: true,
  };

  const usuarioDelegadoMock = {
    id: "00000000-0000-4000-8000-000000000005",
    nombre: "Carlos Operativo",
    email: "carlos@valdivia.cl",
    rut: "15.123.456-7",
    activo: true,
    rol_id: "20000000-0000-4000-8000-000000000005",
    delegacion_id: "30000000-0000-4000-8000-000000000001",
    rol_codigo: "DELEGADO_CUADRILLA",
  };

  const rolDelegadoMock = {
    id: "20000000-0000-4000-8000-000000000005",
    codigo: "DELEGADO_CUADRILLA",
    nombre: "Delegado de Cuadrilla",
  };

  const filaDetalleMock: cuadrillaRepository.FilaCuadrillaDetalle = {
    id: "50000000-0000-4000-8000-000000000001",
    nombre: "Cuadrilla Vías y Calles",
    estado: "DISPONIBLE",
    creado_en: new Date("2026-10-24T12:00:00Z"),
    creado_por_id: usuarioAdmin.id,
    delegacion_id: delegacionMock.id,
    delegacion_nombre: delegacionMock.nombre,
    delegado_id: usuarioDelegadoMock.id,
    delegado_nombre: usuarioDelegadoMock.nombre,
    delegado_email: usuarioDelegadoMock.email,
    delegado_rut: usuarioDelegadoMock.rut,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Validaciones del Esquema Zod (CrearCuadrillaInputSchema)", () => {
    it("debe aceptar un payload completo y válido", () => {
      const parsed = CrearCuadrillaInputSchema.safeParse(inputValido);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.nombre).toBe("Cuadrilla Vías y Calles");
      }
    });

    it("debe aplicar trim() y rechazar nombres menores a 3 caracteres", () => {
      const parsed = CrearCuadrillaInputSchema.safeParse({
        ...inputValido,
        nombre: "  ab  ",
      });
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar si falta el nombre o es vacío", () => {
      const parsed = CrearCuadrillaInputSchema.safeParse({
        ...inputValido,
        nombre: "",
      });
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar UUID inválido para delegacionId o usuarioDelegadoId", () => {
      expect(
        CrearCuadrillaInputSchema.safeParse({
          ...inputValido,
          delegacionId: "invalido",
        }).success
      ).toBe(false);

      expect(
        CrearCuadrillaInputSchema.safeParse({
          ...inputValido,
          usuarioDelegadoId: "12345",
        }).success
      ).toBe(false);
    });
  });

  describe("2. Autorización y Reglas de Negocio en crearCuadrilla()", () => {
    it("debe rechazar si el usuario no está autenticado (UnauthorizedError)", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValue(
        new UnauthorizedError("No autenticado.")
      );

      await expect(crearCuadrilla(inputValido, null)).rejects.toThrow(
        UnauthorizedError
      );
    });

    it("debe rechazar con ForbiddenError si el usuario no tiene permisos suficientes", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValue(
        new ForbiddenError("Acceso denegado. Se requiere permiso recursos:crear.")
      );

      await expect(
        crearCuadrilla(inputValido, "usuario-sin-permisos")
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe rechazar con ConflictError si ya existe una cuadrilla con el mismo nombre", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue(
        usuarioAdmin as any
      );
      vi.spyOn(cuadrillaRepository, "buscarCuadrillaPorNombre").mockResolvedValue({
        id: "50000000-0000-4000-8000-000000000099",
        nombre: "cuadrilla vías y calles",
      } as any);

      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        ConflictError
      );
      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        "Ya existe una cuadrilla operativa con el nombre ingresado."
      );
    });

    it("debe rechazar con NotFoundError si la delegación municipal no existe", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue(
        usuarioAdmin as any
      );
      vi.spyOn(cuadrillaRepository, "buscarCuadrillaPorNombre").mockResolvedValue(
        undefined
      );
      vi.spyOn(cuadrillaRepository, "obtenerDelegacionPorId").mockResolvedValue(
        undefined
      );

      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        NotFoundError
      );
      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        "La delegación municipal especificada no existe."
      );
    });

    it("debe rechazar con BadRequestError si la delegación municipal está inactiva", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue(
        usuarioAdmin as any
      );
      vi.spyOn(cuadrillaRepository, "buscarCuadrillaPorNombre").mockResolvedValue(
        undefined
      );
      vi.spyOn(cuadrillaRepository, "obtenerDelegacionPorId").mockResolvedValue({
        id: delegacionMock.id,
        nombre: delegacionMock.nombre,
        activo: false,
      } as any);

      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        BadRequestError
      );
      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        "La delegación municipal seleccionada se encuentra inactiva."
      );
    });

    it("debe rechazar con NotFoundError si el delegado no existe en usuarios", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue(
        usuarioAdmin as any
      );
      vi.spyOn(cuadrillaRepository, "buscarCuadrillaPorNombre").mockResolvedValue(
        undefined
      );
      vi.spyOn(cuadrillaRepository, "obtenerDelegacionPorId").mockResolvedValue(
        delegacionMock as any
      );
      vi.spyOn(cuadrillaRepository, "obtenerUsuarioPorId").mockResolvedValue(
        undefined
      );

      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        NotFoundError
      );
      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        "El usuario designado como delegado de cuadrilla no existe."
      );
    });

    it("debe rechazar con BadRequestError si el delegado está inactivo", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue(
        usuarioAdmin as any
      );
      vi.spyOn(cuadrillaRepository, "buscarCuadrillaPorNombre").mockResolvedValue(
        undefined
      );
      vi.spyOn(cuadrillaRepository, "obtenerDelegacionPorId").mockResolvedValue(
        delegacionMock as any
      );
      vi.spyOn(cuadrillaRepository, "obtenerUsuarioPorId").mockResolvedValue({
        ...usuarioDelegadoMock,
        activo: false,
      } as any);

      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        BadRequestError
      );
      await expect(crearCuadrilla(inputValido, usuarioAdmin.id)).rejects.toThrow(
        "El usuario designado como delegado de cuadrilla se encuentra inactivo."
      );
    });

    it("Flujo Feliz: debe insertar la cuadrilla con estado DISPONIBLE y emitir WebSocket", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue(
        usuarioAdmin as any
      );
      vi.spyOn(cuadrillaRepository, "buscarCuadrillaPorNombre").mockResolvedValue(
        undefined
      );
      vi.spyOn(cuadrillaRepository, "obtenerDelegacionPorId").mockResolvedValue(
        delegacionMock as any
      );
      vi.spyOn(cuadrillaRepository, "obtenerUsuarioPorId").mockResolvedValue(
        usuarioDelegadoMock as any
      );
      vi.spyOn(cuadrillaRepository, "obtenerRolDelegadoCuadrilla").mockResolvedValue(
        rolDelegadoMock as any
      );
      const insertSpy = vi
        .spyOn(cuadrillaRepository, "insertarCuadrillaConDelegado")
        .mockResolvedValue(filaDetalleMock);
      const socketSpy = vi.spyOn(socketLib, "emitirCuadrillaCreada").mockReturnValue(undefined);

      const resultado = await crearCuadrilla(inputValido, usuarioAdmin.id);

      expect(resultado).toBeDefined();
      expect(resultado.id).toBe(filaDetalleMock.id);
      expect(resultado.nombre).toBe(filaDetalleMock.nombre);
      expect(resultado.estado).toBe("DISPONIBLE");
      expect(resultado.delegacion.nombre).toBe(delegacionMock.nombre);
      expect(resultado.delegado.email).toBe(usuarioDelegadoMock.email);
      expect(resultado.creadoPorId).toBe(usuarioAdmin.id);

      // Verificación de repositorio
      expect(insertSpy).toHaveBeenCalledWith(
        {
          nombre: inputValido.nombre,
          delegacionId: inputValido.delegacionId,
          usuarioDelegadoId: inputValido.usuarioDelegadoId,
          creadoPorId: usuarioAdmin.id,
        },
        rolDelegadoMock.id,
        "DELEGADO_CUADRILLA"
      );

      // Verificación de emisión WebSocket
      expect(socketSpy).toHaveBeenCalledWith(resultado);
    });

    it("debe promover atómicamente a DELEGADO_CUADRILLA si el usuario tiene rol previo BRIGADISTA", async () => {
      const usuarioBrigadista = {
        ...usuarioDelegadoMock,
        rol_codigo: "BRIGADISTA",
        rol_id: "20000000-0000-4000-8000-000000000009",
      };

      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue(
        usuarioAdmin as any
      );
      vi.spyOn(cuadrillaRepository, "buscarCuadrillaPorNombre").mockResolvedValue(
        undefined
      );
      vi.spyOn(cuadrillaRepository, "obtenerDelegacionPorId").mockResolvedValue(
        delegacionMock as any
      );
      vi.spyOn(cuadrillaRepository, "obtenerUsuarioPorId").mockResolvedValue(
        usuarioBrigadista as any
      );
      vi.spyOn(cuadrillaRepository, "obtenerRolDelegadoCuadrilla").mockResolvedValue(
        rolDelegadoMock as any
      );
      const insertSpy = vi
        .spyOn(cuadrillaRepository, "insertarCuadrillaConDelegado")
        .mockResolvedValue(filaDetalleMock);
      vi.spyOn(socketLib, "emitirCuadrillaCreada").mockReturnValue(undefined);

      await crearCuadrilla(inputValido, usuarioAdmin.id);

      expect(insertSpy).toHaveBeenCalledWith(
        expect.anything(),
        rolDelegadoMock.id,
        "BRIGADISTA"
      );
    });
  });
});
