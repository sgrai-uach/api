import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  crearEventoAsistenciaSocialService,
  listarEventosAsistenciaSocialService,
  asignarAsistenteSocialService,
  consolidarEvaluacionSocialParaPersistencia,
  EventoAsistenciaSocialNotFoundError,
  AsistenteSocialNotFoundError,
  EstadoEventoAsistenciaSocialInvalidoError,
  AsistenteSocialNoDisponibleError,
} from "../asistencia-social.service";
import * as authService from "@/modules/seguridad/auth.service";
import * as repository from "../asistencia-social.repository";
import * as socket from "@/lib/socket";
import { ForbiddenError } from "@/modules/seguridad/auth.errors";

vi.mock("@/modules/seguridad/auth.service");
vi.mock("../asistencia-social.repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../asistencia-social.repository")>();
  return {
    ...actual,
    generarSiguienteCodigoAsistenciaSocial: vi.fn(),
    insertarEventoAsistenciaSocial: vi.fn(),
    listarEventosAsistenciaSocialPaginados: vi.fn(),
    contarEventosAsistenciaSocial: vi.fn(),
    asignarAsistenteSocialEventoRepo: vi.fn(),
  };
});
vi.mock("@/lib/socket", () => ({
  emitirAsistenciaSocialCreada: vi.fn(),
  emitirAsistenciaSocialActualizada: vi.fn(),
}));

describe("asistencia-social.service - Lógica de Negocio y RBAC (H28)", () => {
  const usuarioEncargado = {
    id: "00000000-0000-4000-8000-000000000003",
    nombre: "Encargado de Operaciones",
    rol: "Encargado",
  };

  const inputCrear = {
    descripcion: "Requerimiento urgente de evaluación social por inundación en patio y casa.",
    tipoAfectacion: "VIVIENDA_ANEGADA",
    direccionTexto: "Calle Los Alerces 1420, Sector Collico",
    latitud: -39.8234,
    longitud: -73.2189,
    personasAfectadas: 4,
    familiasAfectadas: 1,
    prioridad: "ALTA" as const,
    contactoNombre: "María González",
    contactoTelefono: "+56912345678",
    contactoRut: "12.345.678-9",
    delegacionId: "30000000-0000-4000-8000-000000000001",
  };

  const filaGuardadaMock: repository.FilaEventoAsistenciaSocialConRelaciones = {
    id: "70000000-0000-4000-8000-000000000001",
    codigo: "AS-2026-0001",
    descripcion: inputCrear.descripcion,
    tipo_afectacion: inputCrear.tipoAfectacion,
    personas_afectadas: 4,
    familias_afectadas: 1,
    direccion_texto: inputCrear.direccionTexto,
    latitud: inputCrear.latitud,
    longitud: inputCrear.longitud,
    prioridad: "ALTA",
    estado: "PENDIENTE",
    contacto_nombre: inputCrear.contactoNombre,
    contacto_telefono: inputCrear.contactoTelefono,
    contacto_rut: inputCrear.contactoRut,
    delegacion_id: inputCrear.delegacionId,
    delegacion_nombre: "Delegación Municipal Costa",
    incidente_id: null,
    asistente_social_id: null,
    asistente_social_nombre: null,
    detalles_evaluacion: null,
    creado_por_id: usuarioEncargado.id,
    creado_por_nombre: usuarioEncargado.nombre,
    creado_en: new Date("2026-10-05T12:00:00Z"),
    actualizado_en: new Date("2026-10-05T12:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("crearEventoAsistenciaSocialService", () => {
    it("debe rechazar con ForbiddenError si el usuario no cuenta con el permiso requerido", async () => {
      vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
        new ForbiddenError("No cuenta con el permiso requerido: asistencia_social:crear")
      );

      await expect(
        crearEventoAsistenciaSocialService(inputCrear, "usuario-sin-permisos")
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe registrar un evento social exitosamente generando código institucional y emitiendo Socket.io", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioEncargado);
      vi.spyOn(repository, "generarSiguienteCodigoAsistenciaSocial").mockResolvedValueOnce("AS-2026-0001");
      vi.spyOn(repository, "insertarEventoAsistenciaSocial").mockResolvedValueOnce(filaGuardadaMock);

      const resultado = await crearEventoAsistenciaSocialService(inputCrear, usuarioEncargado.id);

      expect(resultado.codigo).toBe("AS-2026-0001");
      expect(resultado.estado).toBe("PENDIENTE");
      expect(resultado.incidenteId).toBeNull();
      expect(resultado.personasAfectadas).toBe(4);
      expect(resultado.detallesEvaluacion).toBeNull();
      expect(socket.emitirAsistenciaSocialCreada).toHaveBeenCalledWith(resultado);
    });

    it("debe descartar la estimación aproximada y consolidar totales cuando se ingresa desglose por familia", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioEncargado);
      vi.spyOn(repository, "generarSiguienteCodigoAsistenciaSocial").mockResolvedValueOnce("AS-2026-0009");

      const detallesEsperados = {
        familias: [
          {
            referencia: "Hogar Beneficencia",
            nucleoFamiliarTotal: 5,
            cantidadNinos: 2,
            cantidadAdultosMayores: 0,
            personasDiscapacitadas: 1,
            personasElectrodependientes: 0,
            mascotasAfectadas: 0,
            nivelCompromisoVivienda: "MODERADO",
          },
        ],
        familiasAfectadas: 1,
        nucleoFamiliarTotal: 5,
        cantidadNinos: 2,
        cantidadAdultosMayores: 0,
        personasDiscapacitadas: 1,
        personasElectrodependientes: 0,
        mascotasAfectadas: 0,
        nivelCompromisoVivienda: "MODERADO",
        danosEstimados: "Anegamiento interior",
      };

      const insertSpy = vi.spyOn(repository, "insertarEventoAsistenciaSocial").mockResolvedValueOnce({
        ...filaGuardadaMock,
        codigo: "AS-2026-0009",
        personas_afectadas: 5,
        familias_afectadas: 1,
        detalles_evaluacion: detallesEsperados,
      });

      const resultado = await crearEventoAsistenciaSocialService(
        {
          ...inputCrear,
          personasAfectadas: 99,
          familiasAfectadas: 7,
          detallesEvaluacion: {
            nivelCompromisoVivienda: "MODERADO",
            danosEstimados: "Anegamiento interior",
            familias: [
              {
                referencia: "Hogar Beneficencia",
                nucleoFamiliarTotal: 5,
                cantidadNinos: 2,
                cantidadAdultosMayores: 0,
                personasDiscapacitadas: 1,
                personasElectrodependientes: 0,
                mascotasAfectadas: 0,
                nivelCompromisoVivienda: "MODERADO",
              },
            ],
          },
        },
        usuarioEncargado.id
      );

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          personasAfectadas: 5,
          familiasAfectadas: 1,
          detallesEvaluacion: expect.objectContaining({
            nucleoFamiliarTotal: 5,
            familiasAfectadas: 1,
            cantidadNinos: 2,
            personasDiscapacitadas: 1,
          }),
        })
      );
      expect(resultado.personasAfectadas).toBe(5);
      expect(resultado.familiasAfectadas).toBe(1);
      expect(resultado.detallesEvaluacion?.familias).toHaveLength(1);
      expect(resultado.detallesEvaluacion?.cantidadNinos).toBe(2);
      expect(resultado.detallesEvaluacion?.personasDiscapacitadas).toBe(1);
      expect(socket.emitirAsistenciaSocialCreada).toHaveBeenCalledWith(resultado);
    });

    it("debe soportar asignación inmediata de asistenteSocialId al crear (Opción A H31)", async () => {
      const asistenteId = "00000000-0000-4000-8000-000000000006";
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioEncargado);
      vi.spyOn(repository, "generarSiguienteCodigoAsistenciaSocial").mockResolvedValueOnce("AS-2026-0010");
      vi.spyOn(repository, "insertarEventoAsistenciaSocial").mockResolvedValueOnce({
        ...filaGuardadaMock,
        codigo: "AS-2026-0010",
        estado: "ASIGNADO",
        asistente_social_id: asistenteId,
        asistente_social_nombre: "Claudia Rojas",
      });

      const resultado = await crearEventoAsistenciaSocialService(
        {
          ...inputCrear,
          asistenteSocialId: asistenteId,
        },
        usuarioEncargado.id
      );

      expect(resultado.estado).toBe("ASIGNADO");
      expect(resultado.asistenteSocialId).toBe(asistenteId);
      expect(resultado.asistenteSocialNombre).toBe("Claudia Rojas");
    });

    it("debe mapear AsistenteSocialRepoError a AsistenteSocialNotFoundError / AsistenteSocialNoDisponibleError", async () => {
      const asistenteId = "00000000-0000-4000-8000-000000000006";
      vi.spyOn(authService, "verificarPermiso").mockResolvedValue(usuarioEncargado);
      vi.spyOn(repository, "generarSiguienteCodigoAsistenciaSocial").mockResolvedValue("AS-2026-0011");

      vi.spyOn(repository, "insertarEventoAsistenciaSocial").mockRejectedValueOnce(
        new repository.AsistenteSocialRepoError("ASISTENTE_NO_ENCONTRADO", "No existe")
      );
      await expect(
        crearEventoAsistenciaSocialService({ ...inputCrear, asistenteSocialId: asistenteId }, usuarioEncargado.id)
      ).rejects.toThrow(AsistenteSocialNotFoundError);

      vi.spyOn(repository, "insertarEventoAsistenciaSocial").mockRejectedValueOnce(
        new repository.AsistenteSocialRepoError("ASISTENTE_NO_ELEGIBLE", "No disponible")
      );
      await expect(
        crearEventoAsistenciaSocialService({ ...inputCrear, asistenteSocialId: asistenteId }, usuarioEncargado.id)
      ).rejects.toThrow(AsistenteSocialNoDisponibleError);
    });
  });

  describe("consolidarEvaluacionSocialParaPersistencia", () => {
    it("retorna null en modo aproximado sin campos demográficos y preserva nivelCompromisoVivienda si existe sin familias", () => {
      expect(consolidarEvaluacionSocialParaPersistencia(4, 1, null)).toEqual({
        personasAfectadas: 4,
        familiasAfectadas: 1,
        detallesEvaluacion: null,
      });

      expect(
        consolidarEvaluacionSocialParaPersistencia(4, 1, {
          nivelCompromisoVivienda: "LEVE",
          danosEstimados: "Filtración menor",
          familias: [],
        })
      ).toEqual({
        personasAfectadas: 4,
        familiasAfectadas: 1,
        detallesEvaluacion: {
          nivelCompromisoVivienda: "LEVE",
          danosEstimados: "Filtración menor",
        },
      });
    });
  });

  describe("listarEventosAsistenciaSocialService", () => {
    it("debe listar los eventos paginados y calcular totalPaginas correctamente", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioEncargado);
      vi.spyOn(repository, "listarEventosAsistenciaSocialPaginados").mockResolvedValueOnce([
        {
          ...filaGuardadaMock,
          detalles_evaluacion: JSON.stringify({
            familiasAfectadas: 1,
            nucleoFamiliarTotal: 5,
            cantidadNinos: 2,
            personasDiscapacitadas: 1,
            familias: [
              {
                nucleoFamiliarTotal: 5,
                cantidadNinos: 2,
                personasDiscapacitadas: 1,
              },
            ],
          }),
        },
      ]);
      vi.spyOn(repository, "contarEventosAsistenciaSocial").mockResolvedValueOnce(1);

      const resultado = await listarEventosAsistenciaSocialService(
        { estado: "PENDIENTE", pagina: 1, limite: 10 },
        usuarioEncargado.id
      );

      expect(resultado.data).toHaveLength(1);
      expect(resultado.total).toBe(1);
      expect(resultado.pagina).toBe(1);
      expect(resultado.totalPaginas).toBe(1);
      expect(resultado.data[0].codigo).toBe("AS-2026-0001");
      expect(resultado.data[0].detallesEvaluacion?.familias).toHaveLength(1);
      expect(resultado.data[0].detallesEvaluacion?.cantidadNinos).toBe(2);
      expect(resultado.data[0].detallesEvaluacion?.personasDiscapacitadas).toBe(1);
    });
  });

  describe("asignarAsistenteSocialService (H31)", () => {
    const eventoId = "70000000-0000-4000-8000-000000000001";
    const asistenteSocialId = "00000000-0000-4000-8000-000000000006";

    it("debe rechazar con ForbiddenError si el usuario no posee el permiso asistencia_social:crear", async () => {
      vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
        new ForbiddenError("No tiene permiso asistencia_social:crear")
      );

      await expect(
        asignarAsistenteSocialService(eventoId, { asistenteSocialId }, "usuario-sin-permiso")
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe asignar al asistente social, transicionar a ASIGNADO y emitir asistencia_social:actualizada", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioEncargado);
      const filaAsignada: repository.FilaEventoAsistenciaSocialConRelaciones = {
        ...filaGuardadaMock,
        estado: "ASIGNADO",
        asistente_social_id: asistenteSocialId,
        asistente_social_nombre: "Claudia Rojas",
      };
      vi.spyOn(repository, "asignarAsistenteSocialEventoRepo").mockResolvedValueOnce({
        ok: true,
        evento: filaAsignada,
      });

      const resultado = await asignarAsistenteSocialService(
        eventoId,
        { asistenteSocialId },
        usuarioEncargado.id
      );

      expect(authService.verificarPermiso).toHaveBeenCalledWith(
        usuarioEncargado.id,
        "asistencia_social:crear"
      );
      expect(repository.asignarAsistenteSocialEventoRepo).toHaveBeenCalledWith(
        eventoId,
        asistenteSocialId
      );
      expect(resultado.estado).toBe("ASIGNADO");
      expect(resultado.asistenteSocialId).toBe(asistenteSocialId);
      expect(resultado.asistenteSocialNombre).toBe("Claudia Rojas");
      expect(socket.emitirAsistenciaSocialActualizada).toHaveBeenCalledWith(resultado);
    });

    it("debe lanzar EventoAsistenciaSocialNotFoundError si el evento no existe", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioEncargado);
      vi.spyOn(repository, "asignarAsistenteSocialEventoRepo").mockResolvedValueOnce({
        ok: false,
        motivo: "EVENTO_NO_ENCONTRADO",
      });

      await expect(
        asignarAsistenteSocialService(eventoId, { asistenteSocialId }, usuarioEncargado.id)
      ).rejects.toThrow(EventoAsistenciaSocialNotFoundError);
    });

    it("debe lanzar AsistenteSocialNotFoundError si el usuario asistente no existe", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioEncargado);
      vi.spyOn(repository, "asignarAsistenteSocialEventoRepo").mockResolvedValueOnce({
        ok: false,
        motivo: "ASISTENTE_NO_ENCONTRADO",
      });

      await expect(
        asignarAsistenteSocialService(eventoId, { asistenteSocialId }, usuarioEncargado.id)
      ).rejects.toThrow(AsistenteSocialNotFoundError);
    });

    it("debe lanzar EstadoEventoAsistenciaSocialInvalidoError si el evento no está en PENDIENTE", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioEncargado);
      vi.spyOn(repository, "asignarAsistenteSocialEventoRepo").mockResolvedValueOnce({
        ok: false,
        motivo: "ESTADO_INVALIDO",
        detalle: "El evento ya está en estado ASIGNADO.",
      });

      await expect(
        asignarAsistenteSocialService(eventoId, { asistenteSocialId }, usuarioEncargado.id)
      ).rejects.toThrow(EstadoEventoAsistenciaSocialInvalidoError);
    });

    it("debe lanzar AsistenteSocialNoDisponibleError si el usuario no tiene rol ASISTENTE_SOCIAL o no está disponible", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioEncargado);
      vi.spyOn(repository, "asignarAsistenteSocialEventoRepo").mockResolvedValueOnce({
        ok: false,
        motivo: "ASISTENTE_NO_ELEGIBLE",
        detalle: "El asistente social está en estado ocupado.",
      });

      await expect(
        asignarAsistenteSocialService(eventoId, { asistenteSocialId }, usuarioEncargado.id)
      ).rejects.toThrow(AsistenteSocialNoDisponibleError);
    });
  });
});
