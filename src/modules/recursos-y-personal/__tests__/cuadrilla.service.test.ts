import { describe, it, expect, vi, beforeEach } from "vitest";
import { editarCuadrilla } from "../cuadrilla.service";
import * as repo from "../cuadrilla.repository";
import { seguridadService } from "@/modules/seguridad/service";
import * as socketModule from "@/lib/socket";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "@/modules/seguridad/errors";

describe("Servicio editarCuadrilla (H81)", () => {
  const usuarioAdminId = "00000000-0000-4000-8000-000000000001";
  const cuadrillaId = "50000000-0000-4000-8000-000000000001";
  const delegacionId = "30000000-0000-4000-8000-000000000001";
  const delegadoId = "00000000-0000-4000-8000-000000000005";
  const personalId = "40000000-0000-4000-8000-000000000001";
  const recursoId = "e1000000-0000-4000-8000-000000000001";

  const inputValido = {
    nombre: "Cuadrilla Vías y Despeje Urbano",
    delegacionId,
    usuarioDelegadoId: delegadoId,
    recursos: [{ recursoId, cantidad: 1 }],
    trabajadores: [{ personalId }],
  };

  const cuadrillaActualMock: repo.FilaCuadrillaParaEdicion = {
    id: cuadrillaId,
    nombre: "Cuadrilla Anterior",
    estado: "DISPONIBLE",
    delegacion_id: delegacionId,
    usuario_delegado_id: "00000000-0000-4000-8000-000000000099",
    eliminado_en: null,
  };

  const delegacionMock = { id: delegacionId, nombre: "Delegación Norte", activo: true };
  const delegadoMock = {
    id: delegadoId,
    nombre: "Carlos Delegado",
    email: "carlos@valdivia.cl",
    rut: "15.111.222-3",
    activo: true,
    rol_id: "20000000-0000-4000-8000-000000000005",
    delegacion_id: delegacionId,
    rol_codigo: "DELEGADO_CUADRILLA",
  };
  const rolDelegadoMock = { id: "rol-delegado-id", codigo: "DELEGADO_CUADRILLA", nombre: "Delegado" };
  const rolBrigadistaMock = { id: "rol-brigadista-id", codigo: "BRIGADISTA", nombre: "Brigadista" };

  const personalMock = [
    {
      id: personalId,
      usuario_id: "user-trabajador-1",
      nombre: "Pedro Obrero",
      rut: "16.222.333-4",
      usuario_activo: true,
      cargo: "Motosierrista",
      especialidad: "Poda de Altura",
      estado_operativo: "disponible" as const,
      disponible_terreno: true,
    },
  ];

  const recursoMock = [
    {
      id: recursoId,
      nombre: "Camioneta 4x4",
      es_individual: true,
      estado: "DISPONIBLE",
      cantidad_inventario: 1,
      cantidad_en_uso: 0,
    },
  ];

  const resultadoTransaccionalMock: repo.FilaCuadrillaDetalleConsolidado = {
    id: cuadrillaId,
    nombre: "Cuadrilla Vías y Despeje Urbano",
    estado: "DISPONIBLE",
    creado_en: new Date("2026-10-24T12:00:00Z"),
    actualizado_en: new Date("2026-10-26T01:30:00Z"),
    creado_por_id: usuarioAdminId,
    actualizado_por_id: usuarioAdminId,
    delegacion_id: delegacionId,
    delegacion_nombre: "Delegación Norte",
    delegado_id: delegadoId,
    delegado_nombre: "Carlos Delegado",
    delegado_email: "carlos@valdivia.cl",
    delegado_rut: "15.111.222-3",
    recursos: [
      {
        id: "cr-1",
        recurso_id: recursoId,
        nombre: "Camioneta 4x4",
        cantidad_asignada: 1,
        es_individual: true,
      },
    ],
    trabajadores: [
      {
        id: "cp-1",
        personal_id: personalId,
        usuario_id: "user-trabajador-1",
        nombre: "Pedro Obrero",
        rut: "16.222.333-4",
        cargo: "Motosierrista",
        especialidad: "Poda de Altura",
        asignado_en: new Date("2026-10-26T01:30:00Z"),
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValue({
      id: usuarioAdminId,
      nombre: "Admin",
      email: "admin@valdivia.cl",
      rolId: "rol-admin",
      rolCodigo: "ADMIN",
    });
    vi.spyOn(repo, "obtenerCuadrillaPorIdParaEdicion").mockResolvedValue(cuadrillaActualMock);
    vi.spyOn(repo, "verificarMisionesActivasCuadrilla").mockResolvedValue(false);
    vi.spyOn(repo, "buscarCuadrillaPorNombreExcluyendoId").mockResolvedValue(undefined);
    vi.spyOn(repo, "obtenerDelegacionPorId").mockResolvedValue(delegacionMock);
    vi.spyOn(repo, "obtenerUsuarioPorId").mockResolvedValue(delegadoMock);
    vi.spyOn(repo, "obtenerRolPorCodigo").mockImplementation(async (codigo) => {
      if (codigo === "DELEGADO_CUADRILLA") return rolDelegadoMock;
      if (codigo === "BRIGADISTA") return rolBrigadistaMock;
      return undefined;
    });
    vi.spyOn(repo, "obtenerPersonalParaAsignacion").mockResolvedValue(personalMock);
    vi.spyOn(repo, "obtenerRecursosParaAsignacion").mockResolvedValue(recursoMock);
    vi.spyOn(repo, "obtenerRecursosIndividualesAsignadosAOtrasCuadrillas").mockResolvedValue([]);
    vi.spyOn(repo, "actualizarCuadrillaConDotacionTransaccional").mockResolvedValue(resultadoTransaccionalMock);
    vi.spyOn(socketModule, "emitirCuadrillaActualizada").mockImplementation(() => {});
  });

  it("debe rechazar con ForbiddenError si el usuario no tiene permisos", async () => {
    vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValue(
      new ForbiddenError("Acceso denegado")
    );

    await expect(editarCuadrilla(cuadrillaId, inputValido, "otro-usuario")).rejects.toThrow(
      ForbiddenError
    );
  });

  it("debe lanzar NotFoundError si la cuadrilla no existe", async () => {
    vi.spyOn(repo, "obtenerCuadrillaPorIdParaEdicion").mockResolvedValue(undefined);

    await expect(editarCuadrilla(cuadrillaId, inputValido, usuarioAdminId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("debe bloquear con ConflictError (409) si la cuadrilla está en estado EN_MISION", async () => {
    vi.spyOn(repo, "obtenerCuadrillaPorIdParaEdicion").mockResolvedValue({
      ...cuadrillaActualMock,
      estado: "EN_MISION",
    });

    await expect(editarCuadrilla(cuadrillaId, inputValido, usuarioAdminId)).rejects.toThrow(
      ConflictError
    );
  });

  it("debe bloquear con ConflictError (409) si la cuadrilla tiene misiones operativas activas", async () => {
    vi.spyOn(repo, "verificarMisionesActivasCuadrilla").mockResolvedValue(true);

    await expect(editarCuadrilla(cuadrillaId, inputValido, usuarioAdminId)).rejects.toThrow(
      ConflictError
    );
  });

  it("debe lanzar ConflictError si el nuevo nombre colisiona con otra cuadrilla", async () => {
    vi.spyOn(repo, "buscarCuadrillaPorNombreExcluyendoId").mockResolvedValue({
      id: "otra-cuadrilla-id",
      nombre: inputValido.nombre,
    });

    await expect(editarCuadrilla(cuadrillaId, inputValido, usuarioAdminId)).rejects.toThrow(
      ConflictError
    );
  });

  it("debe lanzar BadRequestError si la delegación está inactiva", async () => {
    vi.spyOn(repo, "obtenerDelegacionPorId").mockResolvedValue({
      ...delegacionMock,
      activo: false,
    });

    await expect(editarCuadrilla(cuadrillaId, inputValido, usuarioAdminId)).rejects.toThrow(
      BadRequestError
    );
  });

  it("debe lanzar BadRequestError si el delegado está inactivo", async () => {
    vi.spyOn(repo, "obtenerUsuarioPorId").mockResolvedValue({
      ...delegadoMock,
      activo: false,
    });

    await expect(editarCuadrilla(cuadrillaId, inputValido, usuarioAdminId)).rejects.toThrow(
      BadRequestError
    );
  });

  it("debe lanzar BadRequestError si un funcionario operativo asignado no está disponible", async () => {
    vi.spyOn(repo, "obtenerPersonalParaAsignacion").mockResolvedValue([
      {
        ...personalMock[0],
        estado_operativo: "en_mision" as const,
      },
    ]);

    await expect(editarCuadrilla(cuadrillaId, inputValido, usuarioAdminId)).rejects.toThrow(
      BadRequestError
    );
  });

  it("debe lanzar BadRequestError si se intenta asignar más de 1 unidad a un recurso individual", async () => {
    const inputRecursoExcedido = {
      ...inputValido,
      recursos: [{ recursoId, cantidad: 2 }],
    };

    await expect(editarCuadrilla(cuadrillaId, inputRecursoExcedido, usuarioAdminId)).rejects.toThrow(
      BadRequestError
    );
  });

  it("debe lanzar ConflictError si un recurso individual ya está asignado a otra cuadrilla", async () => {
    vi.spyOn(repo, "obtenerRecursosIndividualesAsignadosAOtrasCuadrillas").mockResolvedValue([
      {
        recurso_id: recursoId,
        recurso_nombre: "Camioneta 4x4",
        cuadrilla_nombre: "Cuadrilla Alfa",
      },
    ]);

    await expect(editarCuadrilla(cuadrillaId, inputValido, usuarioAdminId)).rejects.toThrow(
      ConflictError
    );
  });

  it("debe ejecutar actualización atómica y emitir evento WebSocket ante éxito", async () => {
    const resultado = await editarCuadrilla(cuadrillaId, inputValido, usuarioAdminId);

    expect(resultado.id).toBe(cuadrillaId);
    expect(resultado.nombre).toBe(inputValido.nombre);
    expect(resultado.recursos).toHaveLength(1);
    expect(resultado.trabajadores).toHaveLength(1);
    expect(resultado.actualizadoEn).toBeDefined();

    expect(repo.actualizarCuadrillaConDotacionTransaccional).toHaveBeenCalledTimes(1);
    expect(socketModule.emitirCuadrillaActualizada).toHaveBeenCalledWith(resultado);
  });
});
