import { describe, it, expect, vi, beforeEach } from "vitest";
import { aceptarMisionService } from "../mision.service";
import * as misionRepo from "../mision.repository";
import * as socketLib from "@/lib/socket";
import { ConflictError, ForbiddenError, NotFoundError } from "@/modules/seguridad/errors";

vi.mock("../mision.repository", () => ({
  obtenerMisionDetallePorIdRepo: vi.fn(),
  aceptarMisionPatrullaRepo: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarMisionActualizada: vi.fn(),
  notificarIncidenteActualizado: vi.fn(),
}));

describe("Mision Service - aceptarMisionService (HU-36)", () => {
  const misionId = "60000000-0000-4000-8000-000000000001";
  const usuarioPatrullaId = "00000000-0000-4000-8000-000000000004";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";
  const incidenteId = "a0000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe aceptar la misión transicionando a EN_CURSO, manteniendo patrulla EN_VERIFICACION e incidente VERIFICANDO, registrando el hito y emitiendo mision:actualizada", async () => {
    const fechaInicio = "2026-11-01T21:00:00.000Z";
    vi.mocked(misionRepo.aceptarMisionPatrullaRepo).mockResolvedValueOnce({
      mision: {
        id: misionId,
        codigo: "MIS-2026-0001",
        titulo: "Verificación de Incidente INC-2026-0001",
        descripcion: "Evaluar anegamiento de calzada",
        tipoMision: "VERIFICACION",
        estado: "EN_CURSO",
        prioridad: "ALTA",
        incidenteId,
        patrullaId,
        fechaInicio,
        actualizadoEn: fechaInicio,
      },
      patrulla: {
        id: patrullaId,
        nombre: "Patrulla Rápida Costa-1",
        estado: "EN_VERIFICACION",
      },
      incidente: {
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "VERIFICANDO",
      },
      hito: {
        id: "70000000-0000-4000-8000-000000000001",
        misionId,
        hito: "MISION_ACEPTADA",
        descripcion: "Misión Aceptada por Patrulla",
        registradoPorId: usuarioPatrullaId,
        latitud: -39.819588,
        longitud: -73.245209,
        creadoEn: fechaInicio,
      },
    });

    const resultado = await aceptarMisionService(misionId, usuarioPatrullaId, false, {
      latitud: -39.819588,
      longitud: -73.245209,
    });

    expect(misionRepo.aceptarMisionPatrullaRepo).toHaveBeenCalledWith(
      misionId,
      usuarioPatrullaId,
      false,
      { latitud: -39.819588, longitud: -73.245209 }
    );

    // Verificar invariantes ICS de HU-36
    expect(resultado.data.mision.estado).toBe("EN_CURSO");
    expect(resultado.data.mision.fechaInicio).toBe(fechaInicio);
    expect(resultado.data.patrulla?.estado).toBe("EN_VERIFICACION");
    expect(resultado.data.incidente?.estado).toBe("VERIFICANDO");
    expect(resultado.data.incidente?.estado).not.toBe("En camino");

    // Verificar registro de hito en bitácora
    expect(resultado.data.hito.hito).toBe("MISION_ACEPTADA");
    expect(resultado.data.hito.descripcion).toBe("Misión Aceptada por Patrulla");
    expect(resultado.data.hito.registradoPorId).toBe(usuarioPatrullaId);

    // Verificar emisión de evento WebSocket mision:actualizada
    expect(socketLib.notificarMisionActualizada).toHaveBeenCalledTimes(1);
    expect(socketLib.notificarMisionActualizada).toHaveBeenCalledWith({
      misionId,
      codigo: "MIS-2026-0001",
      estado: "EN_CURSO",
      tipoMision: "VERIFICACION",
      patrullaId,
      incidenteId,
      fechaInicio,
      hito: {
        id: "70000000-0000-4000-8000-000000000001",
        hito: "MISION_ACEPTADA",
        descripcion: "Misión Aceptada por Patrulla",
        registradoPorId: usuarioPatrullaId,
        creadoEn: fechaInicio,
      },
      actualizadoEn: fechaInicio,
    });
  });

  it("debe propagar ConflictError (409) si la misión ya fue aceptada o no está en estado DESPACHADA (control de concurrencia)", async () => {
    vi.mocked(misionRepo.aceptarMisionPatrullaRepo).mockRejectedValueOnce(
      new ConflictError(
        "La misión no puede ser aceptada porque su estado actual es 'EN_CURSO'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."
      )
    );

    await expect(aceptarMisionService(misionId, usuarioPatrullaId, false)).rejects.toThrow(
      ConflictError
    );
    expect(socketLib.notificarMisionActualizada).not.toHaveBeenCalled();
  });

  it("debe propagar ForbiddenError (403) si el usuario pertenece a otra patrulla distinta a la asignada", async () => {
    vi.mocked(misionRepo.aceptarMisionPatrullaRepo).mockRejectedValueOnce(
      new ForbiddenError(
        "No está autorizado para aceptar una misión asignada a otra patrulla verificadora."
      )
    );

    await expect(aceptarMisionService(misionId, usuarioPatrullaId, false)).rejects.toThrow(
      ForbiddenError
    );
    expect(socketLib.notificarMisionActualizada).not.toHaveBeenCalled();
  });

  it("debe propagar NotFoundError (404) si la misión no existe", async () => {
    vi.mocked(misionRepo.aceptarMisionPatrullaRepo).mockRejectedValueOnce(
      new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.")
    );

    await expect(aceptarMisionService(misionId, usuarioPatrullaId, false)).rejects.toThrow(
      NotFoundError
    );
    expect(socketLib.notificarMisionActualizada).not.toHaveBeenCalled();
  });
});

