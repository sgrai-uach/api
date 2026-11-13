import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrioridadService } from "../prioridad.service";
import type { PrioridadRepository } from "../prioridad.repository";
import * as socketModule from "@/lib/socket";

vi.mock("@/lib/socket", () => ({
  notificarIncidenteActualizado: vi.fn(),
  notificarMisionActualizada: vi.fn(),
}));

describe("PrioridadService (HU-38)", () => {
  let service: PrioridadService;
  let mockRepo: {
    calcularPrioridadPreliminar: ReturnType<typeof vi.fn>;
    actualizarPrioridadIncidente: ReturnType<typeof vi.fn>;
  };

  const incidenteId = "50000000-0000-4000-8000-000000000001";
  const usuarioId = "00000000-0000-4000-8000-000000000004";
  const misionId = "60000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      calcularPrioridadPreliminar: vi.fn(),
      actualizarPrioridadIncidente: vi.fn(),
    };
    service = new PrioridadService(mockRepo as unknown as PrioridadRepository);
  });

  it("debe actualizar la prioridad y emitir la notificación WebSocket incidente:actualizado al Centro de Mando", async () => {
    mockRepo.actualizarPrioridadIncidente.mockResolvedValueOnce({
      incidente: {
        id: incidenteId,
        codigo: "INC-2026-001",
        estado: "VERIFICANDO",
        prioridad: "CRITICA",
        prioridadSugerida: "ALTA",
        modificoPrioridadSugerida: true,
        justificacionPrioridad:
          "Riesgo inminente por colapso de muro contiguo a habitación de adulto mayor.",
        requiereAsistenciaSocial: true,
        tipoIncidenteId: "40000000-0000-4000-8000-000000000001",
        tipoAfectacion: "Inundación",
        actualizadoEn: "2026-11-11T22:15:00.000Z",
      },
      reporteTerreno: {
        id: "e0000000-0000-4000-8000-000000000001",
        misionId,
        versionReporte: 1,
        esRectificacion: false,
        etiquetaReporte: "Reporte de Evaluación #1 (Inicial)",
        prioridadSugerida: "ALTA",
        prioridadAsignada: "CRITICA",
        justificacionPrioridad:
          "Riesgo inminente por colapso de muro contiguo a habitación de adulto mayor.",
        resumenTecnico: "Evaluación en Terreno #1 (Inicial)...",
        personasAfectadas: 4,
        requiereApoyoAdicional: true,
        detallesAdicionales: "Se solicita cuadrilla pesada.",
        accionesRealizadas: "Acordonamiento perimetral.",
        danosEstimados: "Muro perimetral socavado.",
        evaluacion: { nucleoFamiliarTotal: 4, cantidadAdultosMayores: 1 },
        evaluador: { id: usuarioId, nombre: "Patrullero Terreno" },
        creadoEn: "2026-11-11T22:15:00.000Z",
      },
      hito: {
        id: "70000000-0000-4000-8000-000000000001",
        misionId,
        hito: "PRIORIDAD_ASIGNADA",
        descripcion:
          "Reporte de evaluación #1: Prioridad asignada en terreno a CRITICA (Sugerida: ALTA).",
        registradoPorId: usuarioId,
        creadoEn: "2026-11-11T22:15:00.000Z",
      },
      mision: {
        id: misionId,
        codigo: "MIS-2026-001",
        estado: "EN_CURSO",
        tipoMision: "VERIFICACION",
        patrullaId: "80000000-0000-4000-8000-000000000001",
        fechaInicio: "2026-11-11T22:00:00.000Z",
      },
    });

    const respuesta = await service.actualizarPrioridadIncidente(
      incidenteId,
      usuarioId,
      false,
      {
        prioridad: "CRITICA",
        prioridadSugerida: "ALTA",
        justificacionPrioridad:
          "Riesgo inminente por colapso de muro contiguo a habitación de adulto mayor.",
      }
    );

    expect(respuesta.data.incidente.prioridad).toBe("CRITICA");
    expect(respuesta.data.incidente.prioridadSugerida).toBe("ALTA");
    expect(respuesta.data.reporteTerreno.versionReporte).toBe(1);
    expect(socketModule.notificarIncidenteActualizado).toHaveBeenCalledWith(
      expect.objectContaining({
        id: incidenteId,
        codigo: "INC-2026-001",
        nuevoEstado: "VERIFICANDO",
        prioridad: "CRITICA",
        prioridadSugerida: "ALTA",
        justificacionPrioridad:
          "Riesgo inminente por colapso de muro contiguo a habitación de adulto mayor.",
        verificado: true,
      })
    );
    expect(socketModule.notificarMisionActualizada).toHaveBeenCalledTimes(1);
  });
});

