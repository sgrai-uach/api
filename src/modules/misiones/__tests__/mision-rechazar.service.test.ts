import { describe, it, expect, vi, beforeEach } from "vitest";
import { rechazarMisionService } from "../mision.service";
import * as misionRepository from "../mision.repository";
import * as socketModule from "@/lib/socket";
import {
  PERMISO_EJECUTAR_MISION_TERRENO,
  PERMISO_VERIFICAR_MISION_TERRENO,
} from "@/modules/seguridad/permisos.constants";

vi.mock("../mision.repository", () => ({
  rechazarMisionRepo: vi.fn(),
  obtenerMisionDetallePorIdRepo: vi.fn(),
  crearMisionVerificacionRepo: vi.fn(),
  aceptarMisionPatrullaRepo: vi.fn(),
  asignarCuadrillaIncidenteRepo: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarMisionRechazada: vi.fn(),
  notificarIncidenteActualizado: vi.fn(),
  emitirCuadrillaActualizada: vi.fn(),
  notificarMisionAsignada: vi.fn(),
  notificarPatrullaActualizada: vi.fn(),
  notificarMisionActualizada: vi.fn(),
  notificarTrazabilidadActualizada: vi.fn(),
  tieneConexionEnSala: vi.fn(),
  notificarPatrullaLiberada: vi.fn(),
}));

describe("HU-41 / HU-69: Servicio de Negocio rechazarMisionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rechazo por Cuadrilla (HU-41)", () => {
    const misionId = "70000000-0000-4000-8000-000000000001";
    const usuarioId = "d0000000-0000-4000-8000-000000000001";
    const cuadrillaId = "50000000-0000-4000-8000-000000000001";
    const incidenteId = "30000000-0000-4000-8000-000000000001";
    const delegacionId = "30000000-0000-4000-8000-000000000002";

    const repoResultCuadrillaMock: misionRepository.RechazarMisionCuadrillaResult = {
      mision: {
        id: misionId,
        codigo: "MIS-2026-0005",
        tipoMision: "ATENCION_CUADRILLA",
        estado: "RECHAZADA",
        justificacionRechazo: "Falla hidráulica en camión tolva",
        fechaCierre: "2026-11-16T23:15:00.000Z",
        actualizadoEn: "2026-11-16T23:15:00.000Z",
      },
      cuadrilla: {
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacionId,
        usuarioDelegadoId: usuarioId,
      },
      incidente: {
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "VERIFICANDO",
        prioridad: "ALTA",
      },
      hito: {
        id: "80000000-0000-4000-8000-000000000099",
        misionId,
        hito: "RECHAZADA",
        descripcion: "Misión rechazada por cuadrilla: Falla hidráulica en camión tolva",
        registradoPorId: usuarioId,
        latitud: -39.81422,
        longitud: -73.24589,
        creadoEn: "2026-11-16T23:15:00.000Z",
      },
    };

    it("debe orquestar la transacción y emitir alerta mision:rechazada junto a incidente y cuadrilla actualizados", async () => {
      vi.mocked(misionRepository.rechazarMisionRepo).mockResolvedValueOnce(
        repoResultCuadrillaMock
      );

      const input = {
        justificacionRechazo: "Falla hidráulica en camión tolva",
        latitud: -39.81422,
        longitud: -73.24589,
      };

      const respuesta = await rechazarMisionService(
        misionId,
        usuarioId,
        false,
        input,
        [PERMISO_EJECUTAR_MISION_TERRENO]
      );

      expect(misionRepository.rechazarMisionRepo).toHaveBeenCalledWith(
        misionId,
        usuarioId,
        input.justificacionRechazo,
        false,
        { latitud: input.latitud, longitud: input.longitud },
        [PERMISO_EJECUTAR_MISION_TERRENO]
      );

      expect(socketModule.notificarMisionRechazada).toHaveBeenCalledWith(
        expect.objectContaining({
          misionId,
          codigo: "MIS-2026-0005",
          tipoMision: "ATENCION_CUADRILLA",
          motivo: "Falla hidráulica en camión tolva",
          justificacionRechazo: "Falla hidráulica en camión tolva",
          cuadrillaId,
          cuadrillaNombre: "Cuadrilla Vías y Canales 1",
          incidenteId,
          incidenteCodigo: "INC-2026-0001",
          rechazadoPorId: usuarioId,
        })
      );

      expect(socketModule.notificarIncidenteActualizado).toHaveBeenCalledWith(
        expect.objectContaining({
          id: incidenteId,
          codigo: "INC-2026-0001",
          nuevoEstado: "VERIFICANDO",
          prioridad: "ALTA",
        })
      );

      expect(socketModule.emitirCuadrillaActualizada).toHaveBeenCalledWith(
        expect.objectContaining({
          id: cuadrillaId,
          nombre: "Cuadrilla Vías y Canales 1",
          estado: "DISPONIBLE",
          delegacionId,
        })
      );

      expect(respuesta.data.mision.estado).toBe("RECHAZADA");
      expect(respuesta.data.cuadrilla?.estado).toBe("DISPONIBLE");
      expect(respuesta.data.incidente?.estado).toBe("VERIFICANDO");
    });

    it("no debe revertir ni fallar la respuesta HTTP si ocurre un error al emitir eventos WebSocket", async () => {
      vi.mocked(misionRepository.rechazarMisionRepo).mockResolvedValueOnce(
        repoResultCuadrillaMock
      );
      vi.mocked(socketModule.notificarMisionRechazada).mockImplementationOnce(() => {
        throw new Error("Redis offline");
      });

      const respuesta = await rechazarMisionService(misionId, usuarioId, true, {
        justificacionRechazo: "Falla hidráulica en camión tolva",
      });

      expect(respuesta.data.mision.estado).toBe("RECHAZADA");
    });

    it("debe construir message dinámico y no emitir incidente:actualizado si la cuadrilla sigue EN_MISION o el incidente mantiene otra misión activa (BUG-H41-API-03)", async () => {
      vi.mocked(misionRepository.rechazarMisionRepo).mockResolvedValueOnce({
        ...repoResultCuadrillaMock,
        cuadrilla: {
          ...repoResultCuadrillaMock.cuadrilla,
          estado: "EN_MISION",
        },
        incidente: {
          ...repoResultCuadrillaMock.incidente!,
          estado: "EN_ATENCION",
        },
        incidenteActualizado: false,
      });

      const respuesta = await rechazarMisionService(misionId, usuarioId, false, {
        justificacionRechazo: "Falla hidráulica en camión tolva",
      });

      expect(socketModule.notificarIncidenteActualizado).not.toHaveBeenCalled();
      expect(respuesta.message).toContain("permanece en estado EN_MISION");
      expect(respuesta.message).toContain("mantiene su estado EN_ATENCION");
      expect(respuesta.message).not.toContain("vuelto a estado DISPONIBLE");
    });

    it("debe construir message dinámico cuando la misión de cuadrilla no tiene incidente asociado (BUG-H41-API-03)", async () => {
      vi.mocked(misionRepository.rechazarMisionRepo).mockResolvedValueOnce({
        ...repoResultCuadrillaMock,
        cuadrilla: {
          ...repoResultCuadrillaMock.cuadrilla,
          estado: "NO_DISPONIBLE",
        },
        incidente: null,
        incidenteActualizado: false,
      });

      const respuesta = await rechazarMisionService(misionId, usuarioId, false, {
        justificacionRechazo: "Unidad desactivada en base",
      });

      expect(socketModule.notificarIncidenteActualizado).not.toHaveBeenCalled();
      expect(respuesta.message).toBe(
        "Misión rechazada exitosamente. La cuadrilla permanece en estado NO_DISPONIBLE."
      );
    });
  });

  describe("Rechazo por Patrulla Verificadora (HU-69)", () => {
    const misionId = "60000000-0000-4000-8000-000000000050";
    const usuarioId = "00000000-0000-4000-8000-000000000004";
    const patrullaId = "f1000000-0000-4000-8000-000000000001";
    const incidenteId = "50000000-0000-4000-8000-000000000001";

    const repoResultPatrullaMock: misionRepository.RechazarMisionPatrullaResult = {
      mision: {
        id: misionId,
        codigo: "MIS-2026-8341",
        tipoMision: "VERIFICACION",
        estado: "RECHAZADA",
        justificacionRechazo: "Falla eléctrica grave en el vehículo de la patrulla",
        actualizadoEn: "2026-11-03T18:45:00.000Z",
      },
      patrulla: {
        id: patrullaId,
        nombre: "Patrulla Ánimas Norte 1",
        estado: "DISPONIBLE",
        delegacionId: "30000000-0000-4000-8000-000000000001",
        usuarioLiderId: "00000000-0000-4000-8000-000000000010",
      },
      incidente: {
        id: incidenteId,
        codigo: "INC-2026-1042",
        estado: "REPORTADO",
        prioridad: "ALTA",
      },
      hito: {
        id: "70000000-0000-4000-8000-000000000002",
        hito: "RECHAZADA",
        descripcion:
          "Misión rechazada por patrulla: Falla eléctrica grave en el vehículo de la patrulla",
        creadoEn: "2026-11-03T18:45:00.000Z",
      },
    };

    it("debe orquestar la transacción de persistencia y emitir eventos Socket.io", async () => {
      vi.mocked(misionRepository.rechazarMisionRepo).mockResolvedValueOnce(
        repoResultPatrullaMock
      );

      const input = {
        justificacionRechazo: "Falla eléctrica grave en el vehículo de la patrulla",
        latitud: -39.814,
        longitud: -73.245,
      };

      const respuesta = await rechazarMisionService(
        misionId,
        usuarioId,
        false,
        input,
        [PERMISO_VERIFICAR_MISION_TERRENO]
      );

      expect(misionRepository.rechazarMisionRepo).toHaveBeenCalledWith(
        misionId,
        usuarioId,
        input.justificacionRechazo,
        false,
        { latitud: input.latitud, longitud: input.longitud },
        [PERMISO_VERIFICAR_MISION_TERRENO]
      );

      expect(socketModule.notificarMisionRechazada).toHaveBeenCalledWith(
        expect.objectContaining({
          misionId,
          codigo: "MIS-2026-8341",
          tipoMision: "VERIFICACION",
          motivo: "Falla eléctrica grave en el vehículo de la patrulla",
          patrullaId,
          patrullaNombre: "Patrulla Ánimas Norte 1",
          incidenteId,
          incidenteCodigo: "INC-2026-1042",
          rechazadoPorId: usuarioId,
        })
      );

      expect(socketModule.notificarIncidenteActualizado).toHaveBeenCalledWith(
        expect.objectContaining({
          id: incidenteId,
          codigo: "INC-2026-1042",
          nuevoEstado: "REPORTADO",
          prioridad: "ALTA",
        })
      );

      expect(socketModule.notificarPatrullaActualizada).toHaveBeenCalledWith(
        expect.objectContaining({
          patrullaId,
          estado: "DISPONIBLE",
          delegacionId: "30000000-0000-4000-8000-000000000001",
          usuarioLiderId: "00000000-0000-4000-8000-000000000010",
        })
      );

      expect(respuesta.data.mision.estado).toBe("RECHAZADA");
      expect(respuesta.data.patrulla?.estado).toBe("DISPONIBLE");
      expect(respuesta.data.incidente?.estado).toBe("REPORTADO");
    });

    it("no debe interrumpir la respuesta si falla la emisión de websockets", async () => {
      vi.mocked(misionRepository.rechazarMisionRepo).mockResolvedValueOnce(
        repoResultPatrullaMock
      );
      vi.mocked(socketModule.notificarMisionRechazada).mockImplementationOnce(() => {
        throw new Error("Redis connection offline");
      });

      const respuesta = await rechazarMisionService(misionId, usuarioId, true, {
        justificacionRechazo: "Falla eléctrica grave en el vehículo de la patrulla",
      });

      expect(respuesta.data.mision.estado).toBe("RECHAZADA");
    });
  });
});
