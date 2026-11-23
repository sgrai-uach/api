import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportarLlegadaCuadrillaService } from "../mision.service";
import * as misionRepo from "../mision.repository";
import * as socketModule from "@/lib/socket";

vi.mock("../mision.repository", async () => {
  const actual = await vi.importActual<typeof import("../mision.repository")>("../mision.repository");
  return {
    ...actual,
    reportarLlegadaCuadrillaRepo: vi.fn(),
  };
});

vi.mock("@/lib/socket", async () => {
  const actual = await vi.importActual<typeof import("@/lib/socket")>("@/lib/socket");
  return {
    ...actual,
    notificarHitoMisionRegistrado: vi.fn(),
    notificarMisionActualizada: vi.fn(),
  };
});

describe("Mision Service - reportarLlegadaCuadrillaService (HU-42)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe orquestar el reporte de llegada, emitir eventos WebSocket y retornar el DTO unificado", async () => {
    const mockResultadoRepo: misionRepo.ReportarLlegadaResultado = {
      hito: {
        id: "80000000-0000-4000-8000-000000000001",
        hitoId: "80000000-0000-4000-8000-000000000001",
        misionId: "60000000-0000-4000-8000-000000000001",
        codigoMision: "MIS-2026-001",
        hito: "LLEGADA_TERRENO",
        descripcion: "Llegada a terreno reportada por la brigada operativa.",
        latitud: -39.81422,
        longitud: -73.24591,
        registradoEn: "2026-11-08T19:30:00.000Z",
        registradoPor: {
          id: "00000000-0000-4000-8000-000000000005",
          nombre: "Pedro Delegado",
        },
        estadoMision: "EN_CURSO",
        miembrosActualizados: 4,
      },
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-001",
        estado: "EN_CURSO",
        cuadrillaId: "50000000-0000-4000-8000-000000000001",
      },
    };

    vi.mocked(misionRepo.reportarLlegadaCuadrillaRepo).mockResolvedValueOnce(mockResultadoRepo);

    const respuesta = await reportarLlegadaCuadrillaService(
      "60000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000005",
      false,
      {
        latitud: -39.81422,
        longitud: -73.24591,
      }
    );

    expect(misionRepo.reportarLlegadaCuadrillaRepo).toHaveBeenCalledWith(
      "60000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000005",
      false,
      {
        latitud: -39.81422,
        longitud: -73.24591,
      }
    );

    expect(socketModule.notificarHitoMisionRegistrado).toHaveBeenCalledTimes(1);
    expect(socketModule.notificarHitoMisionRegistrado).toHaveBeenCalledWith(
      expect.objectContaining({
        misionId: "60000000-0000-4000-8000-000000000001",
        codigoMision: "MIS-2026-001",
        hito: "LLEGADA_TERRENO",
        nuevoEstadoMision: "EN_CURSO",
      })
    );

    expect(socketModule.notificarMisionActualizada).toHaveBeenCalledTimes(1);

    expect(respuesta.message).toBe("Llegada a terreno reportada exitosamente.");
    expect(respuesta.data.hito).toBe("LLEGADA_TERRENO");
    expect(respuesta.data.miembrosActualizados).toBe(4);
    expect(respuesta.data.estadoMision).toBe("EN_CURSO");
  });
});

