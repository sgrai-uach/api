import { describe, it, expect, vi, beforeEach } from "vitest";
import { rechazarMisionService } from "../mision.service";
import * as misionRepository from "../mision.repository";
import * as socketModule from "@/lib/socket";

vi.mock("../mision.repository", () => ({
  rechazarMisionPatrullaRepo: vi.fn(),
  obtenerMisionDetallePorIdRepo: vi.fn(),
  crearMisionVerificacionRepo: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarMisionRechazada: vi.fn(),
  notificarIncidenteActualizado: vi.fn(),
  notificarPatrullaActualizada: vi.fn(),
  notificarMisionAsignada: vi.fn(),
}));

describe("HU-69: Servicio de Negocio rechazarMisionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const misionId = "60000000-0000-4000-8000-000000000050";
  const usuarioId = "00000000-0000-4000-8000-000000000004";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";
  const incidenteId = "50000000-0000-4000-8000-000000000001";

  const repoResultMock: misionRepository.RechazarMisionPatrullaResult = {
    mision: {
      id: misionId,
      codigo: "MIS-2026-8341",
      estado: "RECHAZADA",
      justificacionRechazo: "Falla eléctrica grave en el vehículo de la patrulla",
      actualizadoEn: "2026-11-03T18:45:00.000Z",
    },
    patrulla: {
      id: patrullaId,
      nombre: "Patrulla Ánimas Norte 1",
      estado: "DISPONIBLE",
    },
    incidente: {
      id: incidenteId,
      codigo: "INC-2026-1042",
      estado: "REPORTADO",
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
    vi.mocked(misionRepository.rechazarMisionPatrullaRepo).mockResolvedValueOnce(
      repoResultMock
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
      input
    );

    expect(misionRepository.rechazarMisionPatrullaRepo).toHaveBeenCalledWith(
      misionId,
      usuarioId,
      input.justificacionRechazo,
      false,
      { latitud: input.latitud, longitud: input.longitud }
    );

    // Verificación de eventos en tiempo real hacia las salas requeridas
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
      })
    );

    expect(socketModule.notificarPatrullaActualizada).toHaveBeenCalledWith(
      expect.objectContaining({
        patrullaId,
        estado: "DISPONIBLE",
      })
    );

    expect(respuesta.data.mision.estado).toBe("RECHAZADA");
    expect(respuesta.data.patrulla.estado).toBe("DISPONIBLE");
    expect(respuesta.data.incidente.estado).toBe("REPORTADO");
  });

  it("no debe interrumpir la respuesta si falla la emisión de websockets", async () => {
    vi.mocked(misionRepository.rechazarMisionPatrullaRepo).mockResolvedValueOnce(
      repoResultMock
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

