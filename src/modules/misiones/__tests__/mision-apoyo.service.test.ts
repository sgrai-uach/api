import { describe, it, expect, vi, beforeEach } from "vitest";
import { solicitarApoyoMisionService } from "../mision.service";
import * as misionRepo from "../mision.repository";
import * as socketModule from "@/lib/socket";

vi.mock("../mision.repository", async () => {
  const actual = await vi.importActual<typeof import("../mision.repository")>(
    "../mision.repository"
  );
  return {
    ...actual,
    registrarSolicitudApoyoMisionRepo: vi.fn(),
  };
});

vi.mock("@/lib/socket", async () => {
  const actual = await vi.importActual<typeof import("@/lib/socket")>(
    "@/lib/socket"
  );
  return {
    ...actual,
    notificarApoyoSolicitado: vi.fn(),
    notificarIncidenteActualizado: vi.fn(),
  };
});

describe("Mision Service - solicitarApoyoMisionService (HU-44)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe emitir alerta prioritaria WebSocket hacia sala encargado y actualizar Kanban cuando requiereApoyoAdicional es true", async () => {
    vi.mocked(misionRepo.registrarSolicitudApoyoMisionRepo).mockResolvedValueOnce({
      reporteId: "70000000-0000-4000-8000-000000000001",
      misionId: "60000000-0000-4000-8000-000000000001",
      misionCodigo: "MIS-2026-0044",
      cuadrillaId: "c1000000-0000-4000-8000-000000000001",
      cuadrillaNombre: "Cuadrilla Aguas Lluvias Alfa",
      evaluadorId: "00000000-0000-4000-8000-000000000005",
      evaluadorNombre: "Carlos Delegado",
      incidente: {
        id: "50000000-0000-4000-8000-000000000001",
        codigo: "INC-2026-0010",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
      },
      requiereApoyoAdicional: true,
      detalleApoyoRequerido: "Se solicita motoniveladora y cuadrilla adicional de despeje",
      hito: {
        id: "80000000-0000-4000-8000-000000000001",
        misionId: "60000000-0000-4000-8000-000000000001",
        hito: "APOYO_SOLICITADO",
        descripcion: "Se solicita motoniveladora y cuadrilla adicional de despeje",
        registradoPorId: "00000000-0000-4000-8000-000000000005",
        latitud: null,
        longitud: null,
        creadoEn: "2026-11-23T20:30:00.000Z",
      },
      creadoEn: "2026-11-23T20:30:00.000Z",
    });

    const respuesta = await solicitarApoyoMisionService(
      "60000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000005",
      false,
      {
        requiereApoyoAdicional: true,
        detalleApoyoRequerido: "Se solicita motoniveladora y cuadrilla adicional de despeje",
        observaciones: null,
      }
    );

    expect(socketModule.notificarApoyoSolicitado).toHaveBeenCalledTimes(1);
    expect(socketModule.notificarApoyoSolicitado).toHaveBeenCalledWith(
      expect.objectContaining({
        misionId: "60000000-0000-4000-8000-000000000001",
        requiereApoyoAdicional: true,
        detalleApoyoRequerido:
          "Se solicita motoniveladora y cuadrilla adicional de despeje",
        prioridadAlerta: "ALTA",
      })
    );
    expect(socketModule.notificarIncidenteActualizado).toHaveBeenCalledTimes(1);
    expect(respuesta.data.alertaEmitida).toBe(true);
  });

  it("no debe emitir alerta de apoyo cuando requiereApoyoAdicional es false", async () => {
    vi.mocked(misionRepo.registrarSolicitudApoyoMisionRepo).mockResolvedValueOnce({
      reporteId: "70000000-0000-4000-8000-000000000002",
      misionId: "60000000-0000-4000-8000-000000000001",
      misionCodigo: "MIS-2026-0044",
      cuadrillaId: "c1000000-0000-4000-8000-000000000001",
      cuadrillaNombre: "Cuadrilla Aguas Lluvias Alfa",
      evaluadorId: "00000000-0000-4000-8000-000000000005",
      evaluadorNombre: "Carlos Delegado",
      incidente: null,
      requiereApoyoAdicional: false,
      detalleApoyoRequerido: null,
      hito: null,
      creadoEn: "2026-11-23T20:30:00.000Z",
    });

    const respuesta = await solicitarApoyoMisionService(
      "60000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000005",
      false,
      {
        requiereApoyoAdicional: false,
        detalleApoyoRequerido: null,
        observaciones: null,
      }
    );

    expect(socketModule.notificarApoyoSolicitado).not.toHaveBeenCalled();
    expect(socketModule.notificarIncidenteActualizado).not.toHaveBeenCalled();
    expect(respuesta.data.alertaEmitida).toBe(false);
    expect(respuesta.data.detalleApoyoRequerido).toBeNull();
  });
});
