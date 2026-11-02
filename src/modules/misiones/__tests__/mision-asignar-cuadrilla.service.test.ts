import { describe, it, expect, vi, beforeEach } from "vitest";
import { asignarCuadrillaMisionService } from "../mision.service";
import * as misionRepository from "../mision.repository";
import * as socketModule from "@/lib/socket";
import { ConflictError, NotFoundError } from "@/modules/seguridad/errors";

vi.mock("../mision.repository", async (importOriginal) => {
  const original = await importOriginal<typeof import("../mision.repository")>();
  return {
    ...original,
    asignarCuadrillaIncidenteRepo: vi.fn(),
  };
});

vi.mock("@/lib/socket", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/socket")>();
  return {
    ...original,
    notificarMisionAsignada: vi.fn(),
    notificarPatrullaLiberada: vi.fn(),
    notificarPatrullaActualizada: vi.fn(),
    notificarIncidenteActualizado: vi.fn(),
  };
});

describe("Servicio: asignarCuadrillaMisionService (HU-21 / Regla ICS §3.2)", () => {
  const usuarioId = "10000000-0000-4000-8000-000000000002";
  const incidenteId = "30000000-0000-4000-8000-000000000001";
  const cuadrillaId = "50000000-0000-4000-8000-000000000001";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";
  const misionPreviaId = "60000000-0000-4000-8000-000000000001";
  const nuevaMisionId = "70000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe asignar cuadrilla, liberar patrulla y emitir eventos socket correspondientes (Regla §3.2)", async () => {
    const inputMock = {
      tipoMision: "ATENCION_CUADRILLA" as const,
      incidenteId,
      cuadrillaId,
      titulo: "Despeje táctico de calzada",
      descripcion: "Intervención pesada",
    };

    const repoResultMock: misionRepository.AsignarCuadrillaResult = {
      mision: {
        id: nuevaMisionId,
        codigo: "MIS-2026-0005",
        titulo: "Despeje táctico de calzada",
        descripcion: "Intervención pesada",
        tipoMision: "ATENCION_CUADRILLA",
        estado: "DESPACHADA",
        prioridad: "CRITICA",
        incidenteId,
        cuadrillaId,
        encargadoId: usuarioId,
        creadoPorId: usuarioId,
        fechaInicio: null,
        creadoEn: "2026-10-04T12:30:00.000Z",
      },
      cuadrilla: {
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "EN_MISION",
      },
      incidente: {
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "CRITICA",
      },
      patrullaLiberada: {
        id: patrullaId,
        nombre: "Patrulla Rápida Costa-1",
        estado: "DISPONIBLE",
        misionPreviaId,
      },
      hitoCuadrilla: {
        id: "80000000-0000-4000-8000-000000000001",
        misionId: nuevaMisionId,
        hito: "CUADRILLA_DESPACHADA",
        descripcion: "Cuadrilla despachada a terreno para resolución táctica del incidente",
        creadoEn: "2026-10-04T12:30:00.000Z",
      },
      hitoPatrulla: {
        id: "80000000-0000-4000-8000-000000000002",
        misionId: misionPreviaId,
        hito: "VERIFICACION_FINALIZADA",
        descripcion: "Misión de verificación concluida automáticamente por asignación y relevo de cuadrilla operativa",
        creadoEn: "2026-10-04T12:30:00.000Z",
      },
    };

    vi.mocked(misionRepository.asignarCuadrillaIncidenteRepo).mockResolvedValueOnce(repoResultMock);

    const respuesta = await asignarCuadrillaMisionService(inputMock, usuarioId);

    // Verificaciones de retorno
    expect(respuesta.data.mision.estado).toBe("DESPACHADA");
    expect(respuesta.data.mision.fechaInicio).toBeNull();
    expect(respuesta.data.cuadrilla.estado).toBe("EN_MISION");
    expect(respuesta.data.incidente.estado).toBe("EN_ATENCION");
    expect(respuesta.data.patrullaLiberada?.estado).toBe("DISPONIBLE");
    expect(respuesta.data.hitoCuadrilla.hito).toBe("CUADRILLA_DESPACHADA");
    expect(respuesta.data.hitoPatrulla?.hito).toBe("VERIFICACION_FINALIZADA");
    expect(respuesta.message).toContain("La patrulla verificadora previa ha sido liberada a estado DISPONIBLE");

    // Verificación de llamadas WebSocket
    expect(socketModule.notificarMisionAsignada).toHaveBeenCalledWith({
      misionId: nuevaMisionId,
      codigo: "MIS-2026-0005",
      tipoMision: "ATENCION_CUADRILLA",
      cuadrillaId,
      incidenteId,
      asignadoEn: "2026-10-04T12:30:00.000Z",
    });

    expect(socketModule.notificarPatrullaLiberada).toHaveBeenCalledWith(
      expect.objectContaining({
        patrullaId,
        nombre: "Patrulla Rápida Costa-1",
        misionPreviaId,
        incidenteId,
        estado: "DISPONIBLE",
      })
    );

    expect(socketModule.notificarPatrullaActualizada).toHaveBeenCalledWith(
      expect.objectContaining({
        patrullaId,
        estado: "DISPONIBLE",
      })
    );

    expect(socketModule.notificarIncidenteActualizado).toHaveBeenCalledWith(
      expect.objectContaining({
        id: incidenteId,
        codigo: "INC-2026-0001",
        nuevoEstado: "EN_ATENCION",
      })
    );
  });

  it("debe asignar cuadrilla correctamente a un incidente directo sin patrulla previa", async () => {
    const inputMock = {
      tipoMision: "ATENCION_CUADRILLA" as const,
      incidenteId,
      cuadrillaId,
    };

    const repoResultMock: misionRepository.AsignarCuadrillaResult = {
      mision: {
        id: nuevaMisionId,
        codigo: "MIS-2026-0006",
        titulo: "Atención táctica - Incidente INC-2026-0001",
        descripcion: null,
        tipoMision: "ATENCION_CUADRILLA",
        estado: "DESPACHADA",
        prioridad: "MEDIA",
        incidenteId,
        cuadrillaId,
        encargadoId: usuarioId,
        creadoPorId: usuarioId,
        fechaInicio: null,
        creadoEn: "2026-10-04T12:35:00.000Z",
      },
      cuadrilla: {
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "EN_MISION",
      },
      incidente: {
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "MEDIA",
      },
      patrullaLiberada: null,
      hitoCuadrilla: {
        id: "80000000-0000-4000-8000-000000000003",
        misionId: nuevaMisionId,
        hito: "CUADRILLA_DESPACHADA",
        descripcion: "Cuadrilla despachada a terreno para resolución táctica del incidente",
        creadoEn: "2026-10-04T12:35:00.000Z",
      },
      hitoPatrulla: null,
    };

    vi.mocked(misionRepository.asignarCuadrillaIncidenteRepo).mockResolvedValueOnce(repoResultMock);

    const respuesta = await asignarCuadrillaMisionService(inputMock, usuarioId);

    expect(respuesta.data.patrullaLiberada).toBeNull();
    expect(respuesta.data.hitoPatrulla).toBeNull();
    expect(socketModule.notificarPatrullaLiberada).not.toHaveBeenCalled();
    expect(socketModule.notificarMisionAsignada).toHaveBeenCalled();
    expect(socketModule.notificarIncidenteActualizado).toHaveBeenCalled();
  });

  it("debe propagar NotFoundError si el repositorio no encuentra la cuadrilla o incidente", async () => {
    vi.mocked(misionRepository.asignarCuadrillaIncidenteRepo).mockRejectedValueOnce(
      new NotFoundError("No se encontró ningún incidente con el identificador proporcionado.")
    );

    await expect(
      asignarCuadrillaMisionService(
        {
          tipoMision: "ATENCION_CUADRILLA",
          incidenteId,
          cuadrillaId,
        },
        usuarioId
      )
    ).rejects.toThrow(NotFoundError);
  });

  it("debe propagar ConflictError si la cuadrilla no está disponible", async () => {
    vi.mocked(misionRepository.asignarCuadrillaIncidenteRepo).mockRejectedValueOnce(
      new ConflictError("La cuadrilla no está disponible para asignación (estado actual: 'EN_MISION').")
    );

    await expect(
      asignarCuadrillaMisionService(
        {
          tipoMision: "ATENCION_CUADRILLA",
          incidenteId,
          cuadrillaId,
        },
        usuarioId
      )
    ).rejects.toThrow(ConflictError);
  });
});
