import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enviarReporteVerificacionService,
  obtenerDetalleMisionService,
} from "../mision.service";
import * as misionRepo from "../mision.repository";
import * as socketLib from "@/lib/socket";

vi.mock("../mision.repository", () => ({
  obtenerMisionDetallePorIdRepo: vi.fn(),
  aceptarMisionPatrullaRepo: vi.fn(),
  crearMisionVerificacionRepo: vi.fn(),
  asignarCuadrillaIncidenteRepo: vi.fn(),
  crearReporteVerificacionYCerrarMisionRepo: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarMisionActualizada: vi.fn(),
  notificarMisionAsignada: vi.fn(),
  notificarIncidenteActualizado: vi.fn(),
  notificarPatrullaActualizada: vi.fn(),
  notificarPatrullaLiberada: vi.fn(),
  emitirCuadrillaActualizada: vi.fn(),
}));

describe("Mision Service - enviarReporteVerificacionService y detalle de evaluaciones (HU-39 / HU-86)", () => {
  const misionId = "60000000-0000-4000-8000-000000000001";
  const usuarioId = "00000000-0000-4000-8000-000000000004";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";
  const incidenteId = "a0000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe emitir mision:actualizada, incidente:actualizado, patrulla:actualizada y patrulla:liberada al cerrar con dictamen NO_ABORDABLE", async () => {
    const fechaCierre = "2026-11-16T00:25:00.000Z";
    const motivo =
      "Emergencia en predio privado cerrado sin permiso de ingreso ni riesgo vial.";

    vi.mocked(
      misionRepo.crearReporteVerificacionYCerrarMisionRepo
    ).mockResolvedValueOnce({
      reporteTerreno: {
        id: "e0000000-0000-4000-8000-000000000010",
        misionId,
        tipoReporte: "VERIFICACION_CIERRE",
        dictamen: "NO_ABORDABLE",
        motivoNoAbordable: motivo,
        requiereAsistenciaSocial: false,
        versionReporte: 2,
        esRectificacion: false,
        etiquetaReporte:
          "Informe Técnico de Verificación (Cierre — No Abordable)",
        prioridadSugerida: "MEDIA",
        prioridadAsignada: "MEDIA",
        justificacionPrioridad: null,
        detallesEvaluacion: {
          dictamen: "NO_ABORDABLE",
          personasAfectadasPrevias: 2,
          personasAfectadas: 0,
        },
        evaluador: {
          id: usuarioId,
          nombre: "Patrullero Jefe",
          email: "patrulla@valdivia.cl",
          rut: "15.111.222-3",
        },
        resumenTecnico:
          "Verificación visual exterior confirma terreno privado inaccesible.",
        accionesRealizadas: null,
        requiereApoyoAdicional: false,
        danosEstimados: null,
        observaciones: "Sin peligro para vía pública.",
        personasAfectadas: 0,
        estadoTerreno: "INACCESIBLE",
        adjuntos: [
          {
            id: "f0000000-0000-4000-8000-000000000001",
            nombreArchivo: "cierre.jpg",
            url: "uploads/evidencia/cierre.jpg",
            tipoMime: "image/jpeg",
            tamanoBytes: 120000,
            creadoEn: fechaCierre,
          },
        ],
        creadoEn: fechaCierre,
        actualizadoEn: fechaCierre,
      },
      mision: {
        id: misionId,
        codigo: "MIS-2026-0001",
        titulo: "Verificación de Incidente INC-2026-0001",
        tipoMision: "VERIFICACION",
        estado: "COMPLETADA",
        prioridad: "MEDIA",
        incidenteId,
        patrullaId,
        fechaInicio: "2026-11-15T23:50:00.000Z",
        fechaCierre,
        actualizadoEn: fechaCierre,
      },
      patrulla: {
        id: patrullaId,
        nombre: "Patrulla Costa-1",
        estado: "DISPONIBLE",
        delegacionId: "30000000-0000-4000-8000-000000000003",
        usuarioLiderId: usuarioId,
      },
      incidente: {
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "NO_ABORDABLE",
        prioridad: "MEDIA",
        requiereAsistenciaSocial: false,
        fechaCierre,
        motivoNoAbordable: motivo,
      },
      hito: {
        id: "70000000-0000-4000-8000-000000000010",
        misionId,
        hito: "VERIFICACION_COMPLETADA",
        descripcion: `Informe técnico enviado y misión cerrada. Dictamen: NO_ABORDABLE. Motivo: ${motivo}`,
        registradoPorId: usuarioId,
        latitud: null,
        longitud: null,
        metadatos: { dictamen: "NO_ABORDABLE" },
        creadoEn: fechaCierre,
      },
    });

    const respuesta = await enviarReporteVerificacionService(
      misionId,
      usuarioId,
      false,
      {
        dictamen: "NO_ABORDABLE",
        motivoNoAbordable: motivo,
        resumenTecnico:
          "Verificación visual exterior confirma terreno privado inaccesible.",
        personasAfectadas: 0,
      }
    );

    expect(respuesta.message).toContain("NO_ABORDABLE");
    expect(respuesta.data.reporteTerreno.adjuntos[0].url).toBe(
      "/uploads/evidencia/cierre.jpg"
    );
    expect(socketLib.notificarMisionActualizada).toHaveBeenCalledWith(
      expect.objectContaining({
        misionId,
        estado: "COMPLETADA",
        fechaCierre,
      })
    );
    expect(socketLib.notificarIncidenteActualizado).toHaveBeenCalledWith(
      expect.objectContaining({
        id: incidenteId,
        nuevoEstado: "NO_ABORDABLE",
        motivoNoAbordable: motivo,
        fechaCierre,
        dictamen: "NO_ABORDABLE",
        verificado: true,
      })
    );
    expect(socketLib.notificarPatrullaActualizada).toHaveBeenCalledWith(
      expect.objectContaining({
        patrullaId,
        estado: "DISPONIBLE",
      })
    );
    expect(socketLib.notificarPatrullaLiberada).toHaveBeenCalledWith(
      expect.objectContaining({
        patrullaId,
        estado: "DISPONIBLE",
      })
    );
  });

  it("debe exponer personasAfectadasPrevias y estado de cierre en obtenerDetalleMisionService para precargar el formulario de la PWA", async () => {
    vi.mocked(misionRepo.obtenerMisionDetallePorIdRepo).mockResolvedValueOnce({
      mision: {
        id: misionId,
        codigo: "MIS-2026-0001",
        titulo: "Verificación: Inundación - INC-2026-0001",
        descripcion: null,
        tipo_mision: "VERIFICACION",
        estado: "EN_CURSO",
        prioridad: "ALTA",
        justificacion_rechazo: null,
        incidente_id: incidenteId,
        prevencion_id: null,
        cuadrilla_id: null,
        patrulla_id: patrullaId,
        encargado_id: null,
        creado_por_id: "00000000-0000-4000-8000-000000000003",
        fecha_inicio: new Date("2026-11-15T23:00:00.000Z"),
        fecha_cierre: null,
        creado_en: new Date("2026-11-15T22:50:00.000Z"),
        actualizado_en: new Date("2026-11-15T23:40:00.000Z"),
        incidente_codigo: "INC-2026-0001",
        incidente_codigo_seguimiento: "12345678",
        incidente_tipo_afectacion: "Inundación",
        incidente_estado: "VERIFICANDO",
        incidente_prioridad: "ALTA",
        incidente_requiere_asistencia_social: false,
      },
      recursosCuadrilla: [],
      reportesTerreno: [
        {
          id: "e0000000-0000-4000-8000-000000000001",
          mision_id: misionId,
          evaluador_id: usuarioId,
          tipo_reporte: "EVALUACION_PRIORIDAD",
          version_reporte: 1,
          es_rectificacion: false,
          prioridad_sugerida: "ALTA",
          prioridad_asignada: "ALTA",
          justificacion_prioridad: null,
          resumen_tecnico: "Evaluación de prioridad #1",
          acciones_realizadas: null,
          requiere_apoyo_adicional: false,
          danos_estimados: null,
          observaciones: null,
          personas_afectadas: 7,
          estado_terreno: "EN_VERIFICACION",
          detalles_evaluacion: { nucleoFamiliarTotal: 7 },
          creado_en: new Date("2026-11-15T23:40:00.000Z"),
          actualizado_en: new Date("2026-11-15T23:40:00.000Z"),
          evaluador_nombre: "Patrullero Jefe",
          evaluador_email: "patrulla@valdivia.cl",
          evaluador_rut: "15.111.222-3",
          adjuntos: [],
        },
      ],
      hitos: [],
    });

    const detalle = await obtenerDetalleMisionService(misionId);
    expect(detalle?.evaluaciones?.prioridadEvaluada).toBe(true);
    expect(detalle?.evaluaciones?.personasAfectadasPrevias).toBe(7);
    expect(detalle?.evaluaciones?.reporteVerificacionEnviado).toBe(false);
    expect(detalle?.evaluaciones?.dictamenVerificacion).toBeNull();
  });
});
