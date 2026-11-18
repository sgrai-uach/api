import { describe, it, expect, vi, beforeEach } from "vitest";
import { TipologiaService } from "../tipologia.service";
import type { TipologiaRepository } from "../tipologia.repository";
import * as socketModule from "@/lib/socket";

vi.mock("@/lib/socket", () => ({
  notificarIncidenteActualizado: vi.fn(),
}));

describe("TipologiaService (HU-37)", () => {
  let service: TipologiaService;
  let mockRepo: Partial<TipologiaRepository>;

  const usuarioId = "00000000-0000-4000-8000-000000000004";
  const incidenteId = "50000000-0000-4000-8000-000000000001";
  const tipoIncidenteId = "40000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      listarTiposIncidente: vi.fn().mockResolvedValue([
        {
          id: tipoIncidenteId,
          nombre: "Inundación",
          descripcion: "Desborde de cauces",
          activo: true,
        },
        {
          id: "40000000-0000-4000-8000-000000000003",
          nombre: "Caída de árbol",
          descripcion: "Árboles en la calzada",
          activo: true,
        },
      ]),
      reclasificarTipologia: vi.fn().mockResolvedValue({
        incidente: {
          id: incidenteId,
          codigo: "INC-2026-001",
          tipoIncidenteId,
          tipoAfectacion: "Inundación",
          estado: "VERIFICANDO",
          prioridad: "ALTA",
          actualizadoEn: "2026-11-10T03:00:00.000Z",
        },
        hito: {
          id: "70000000-0000-4000-8000-000000000001",
          misionId: "60000000-0000-4000-8000-000000000001",
          hito: "TIPOLOGIA_RECLASIFICADA",
          descripcion:
            "Tipología reclasificada en terreno a: Inundación. Justificación: Desborde masivo.",
          registradoPorId: usuarioId,
          creadoEn: "2026-11-10T03:00:00.000Z",
        },
        mision: {
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-001",
          estado: "EN_CURSO",
          patrullaId: "80000000-0000-4000-8000-000000000001",
        },
      }),
    };

    service = new TipologiaService(mockRepo as TipologiaRepository);
  });

  it("debe listar el catálogo de tipos de incidentes a través del repositorio", async () => {
    const tipos = await service.listarTipos();
    expect(mockRepo.listarTiposIncidente).toHaveBeenCalledOnce();
    expect(tipos).toHaveLength(2);
    expect(tipos[0].nombre).toBe("Inundación");
  });

  it("debe ejecutar la reclasificación tipológica y emitir notificación WebSocket incidente:actualizado", async () => {
    const input = {
      tipoIncidenteId,
      justificacion: "Desborde masivo constatado en terreno.",
    };

    const resultado = await service.reclasificarTipologia(
      incidenteId,
      usuarioId,
      false,
      input
    );

    expect(mockRepo.reclasificarTipologia).toHaveBeenCalledWith(
      incidenteId,
      usuarioId,
      false,
      input
    );

    expect(socketModule.notificarIncidenteActualizado).toHaveBeenCalledOnce();
    expect(socketModule.notificarIncidenteActualizado).toHaveBeenCalledWith(
      expect.objectContaining({
        id: incidenteId,
        codigo: "INC-2026-001",
        nuevoEstado: "VERIFICANDO",
        prioridad: "ALTA",
        tipoIncidenteId,
        tipoAfectacion: "Inundación",
        justificacion: "Desborde masivo constatado en terreno.",
      })
    );

    expect(resultado.message).toContain("reclasificada exitosamente");
    expect(resultado.data.incidente.tipoAfectacion).toBe("Inundación");
    expect(resultado.data.hito.hito).toBe("TIPOLOGIA_RECLASIFICADA");
  });

  it("no debe interrumpir el flujo si la emisión del WebSocket falla", async () => {
    vi.mocked(socketModule.notificarIncidenteActualizado).mockImplementationOnce(() => {
      throw new Error("Redis connection dropped");
    });

    const input = {
      tipoIncidenteId,
      justificacion: "Desborde masivo constatado en terreno.",
    };

    const resultado = await service.reclasificarTipologia(
      incidenteId,
      usuarioId,
      false,
      input
    );

    expect(resultado).toBeDefined();
    expect(resultado.data.incidente.id).toBe(incidenteId);
  });
});

