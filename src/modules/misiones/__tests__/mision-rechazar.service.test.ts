import { describe, it, expect, vi, beforeEach } from "vitest";
import { rechazarMisionService } from "../mision.service";
import * as misionRepository from "../mision.repository";
import * as socketModule from "@/lib/socket";

vi.mock("../mision.repository", () => ({
  rechazarMisionCuadrillaRepo: vi.fn(),
  obtenerMisionDetallePorIdRepo: vi.fn(),
  crearMisionVerificacionRepo: vi.fn(),
  aceptarMisionPatrullaRepo: vi.fn(),
  asignarCuadrillaIncidenteRepo: vi.fn(),
  cerrarMisionCuadrillaRepo: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarMisionRechazada: vi.fn(),
  notificarIncidenteActualizado: vi.fn(),
  emitirCuadrillaActualizada: vi.fn(),
  emitirRecursoActualizado: vi.fn(),
  notificarMisionAsignada: vi.fn(),
  notificarPatrullaActualizada: vi.fn(),
  notificarMisionActualizada: vi.fn(),
  notificarTrazabilidadActualizada: vi.fn(),
  tieneConexionEnSala: vi.fn(),
  notificarPatrullaLiberada: vi.fn(),
}));

describe("HU-41: Servicio de Negocio rechazarMisionService", () => {
  const misionId = "70000000-0000-4000-8000-000000000001";
  const usuarioId = "d0000000-0000-4000-8000-000000000001";
  const cuadrillaId = "50000000-0000-4000-8000-000000000001";
  const incidenteId = "30000000-0000-4000-8000-000000000001";
  const delegacionId = "30000000-0000-4000-8000-000000000002";

  const repoResultMock: misionRepository.RechazarMisionCuadrillaResult = {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe orquestar la transacción y emitir alerta mision:rechazada junto a incidente y cuadrilla actualizados", async () => {
    vi.mocked(misionRepository.rechazarMisionCuadrillaRepo).mockResolvedValueOnce(
      repoResultMock
    );

    const input = {
      justificacionRechazo: "Falla hidráulica en camión tolva",
      latitud: -39.81422,
      longitud: -73.24589,
    };

    const respuesta = await rechazarMisionService(misionId, usuarioId, false, input);

    expect(misionRepository.rechazarMisionCuadrillaRepo).toHaveBeenCalledWith(
      misionId,
      usuarioId,
      input.justificacionRechazo,
      false,
      { latitud: input.latitud, longitud: input.longitud }
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
    expect(respuesta.data.cuadrilla.estado).toBe("DISPONIBLE");
    expect(respuesta.data.incidente?.estado).toBe("VERIFICANDO");
  });

  it("no debe revertir ni fallar la respuesta HTTP si ocurre un error al emitir eventos WebSocket", async () => {
    vi.mocked(misionRepository.rechazarMisionCuadrillaRepo).mockResolvedValueOnce(
      repoResultMock
    );
    vi.mocked(socketModule.notificarMisionRechazada).mockImplementationOnce(() => {
      throw new Error("Redis offline");
    });

    const respuesta = await rechazarMisionService(misionId, usuarioId, true, {
      justificacionRechazo: "Falla hidráulica en camión tolva",
    });

    expect(respuesta.data.mision.estado).toBe("RECHAZADA");
  });
});
