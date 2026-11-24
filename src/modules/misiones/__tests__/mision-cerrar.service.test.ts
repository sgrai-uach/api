import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  cerrarMisionCuadrillaService,
  obtenerDetalleMisionService,
} from "../mision.service";
import * as misionRepo from "../mision.repository";
import * as socketLib from "@/lib/socket";

vi.mock("../mision.repository", () => ({
  obtenerMisionDetallePorIdRepo: vi.fn(),
  aceptarMisionPatrullaRepo: vi.fn(),
  crearMisionVerificacionRepo: vi.fn(),
  asignarCuadrillaIncidenteRepo: vi.fn(),
  rechazarMisionCuadrillaRepo: vi.fn(),
  crearReporteVerificacionYCerrarMisionRepo: vi.fn(),
  cerrarMisionCuadrillaRepo: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarMisionActualizada: vi.fn(),
  notificarMisionAsignada: vi.fn(),
  notificarIncidenteActualizado: vi.fn(),
  notificarPatrullaActualizada: vi.fn(),
  notificarPatrullaLiberada: vi.fn(),
  emitirCuadrillaActualizada: vi.fn(),
  emitirRecursoActualizado: vi.fn(),
  notificarMisionRechazada: vi.fn(),
}));

describe("Mision Service - cerrarMisionCuadrillaService (HU-68)", () => {
  const misionId = "70000000-0000-4000-8000-000000000001";
  const usuarioId = "d0000000-0000-4000-8000-000000000001";
  const cuadrillaId = "50000000-0000-4000-8000-000000000001";
  const incidenteId = "30000000-0000-4000-8000-000000000001";
  const recursoId = "b0000000-0000-4000-8000-000000000010";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe emitir mision:actualizada, incidente:actualizado, cuadrilla:actualizada y recurso:actualizado y normalizar URLs", async () => {
    const fechaCierre = "2026-11-18T19:00:00.000Z";

    vi.mocked(misionRepo.cerrarMisionCuadrillaRepo).mockResolvedValueOnce({
      reporteTerreno: {
        id: "rep-001",
        misionId,
        tipoReporte: "REPORTE_CUADRILLA",
        dictamen: null,
        motivoNoAbordable: null,
        requiereAsistenciaSocial: false,
        versionReporte: 1,
        esRectificacion: false,
        etiquetaReporte: "Informe Técnico Final de Cuadrilla (Cierre de Misión)",
        prioridadSugerida: "ALTA",
        prioridadAsignada: "ALTA",
        justificacionPrioridad: null,
        detallesEvaluacion: {
          tipoReporte: "REPORTE_CUADRILLA",
          horasHombre: 6.5,
          estadoTerreno: "CONTROLADO",
        },
        evaluador: {
          id: usuarioId,
          nombre: "Carlos Gómez",
          email: "carlos@valdivia.cl",
          rut: "12345678-9",
        },
        resumenTecnico:
          "Despeje integral de sumidero y contención con sacos de arena.",
        accionesRealizadas:
          "Despeje integral de sumidero y contención con sacos de arena.",
        requiereApoyoAdicional: false,
        danosEstimados: null,
        observaciones: null,
        personasAfectadas: 0,
        estadoTerreno: "CONTROLADO",
        horasHombre: 6.5,
        materialesConsumidos: [
          {
            recursoId,
            nombre: "Sacos de arena 25kg",
            cantidad: 12,
            unidad: "sacos",
            stockAnterior: 100,
            stockPosterior: 88,
          },
        ],
        adjuntos: [
          {
            id: "adj-001",
            nombreArchivo: "faena.webp",
            url: "uploads/evidencia/faena.webp",
            tipoMime: "image/webp",
            tamanoBytes: 42000,
            creadoEn: fechaCierre,
          },
        ],
        creadoEn: fechaCierre,
        actualizadoEn: fechaCierre,
      },
      mision: {
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: "Atención táctica Las Ánimas",
        tipoMision: "ATENCION_CUADRILLA",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        incidenteId,
        cuadrillaId,
        fechaInicio: "2026-11-18T14:00:00.000Z",
        fechaCierre,
        actualizadoEn: fechaCierre,
      },
      cuadrilla: {
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacionId: "30000000-0000-4000-8000-000000000002",
      },
      incidente: {
        id: incidenteId,
        codigo: "INC-2026-0042",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiereAsistenciaSocial: false,
      },
      recursosActualizados: [
        {
          id: recursoId,
          nombre: "Sacos de arena 25kg",
          cantidadConsumida: 12,
          cantidadInventarioAnterior: 100,
          cantidadInventarioActual: 88,
          cantidadEnUsoActual: 18,
          estado: "DISPONIBLE",
        },
      ],
      hito: {
        id: "hito-001",
        misionId,
        hito: "MISION_COMPLETADA",
        descripcion: "Informe técnico final enviado por cuadrilla y misión cerrada.",
        registradoPorId: usuarioId,
        latitud: -39.819,
        longitud: -73.245,
        metadatos: { tipoReporte: "REPORTE_CUADRILLA" },
        creadoEn: fechaCierre,
      },
    });

    const respuesta = await cerrarMisionCuadrillaService(misionId, usuarioId, false, {
      resumenFaenas: "Despeje integral de sumidero y contención con sacos de arena.",
      materialesConsumidos: [{ recursoId, cantidad: 12 }],
      horasHombre: 6.5,
      estadoTerreno: "CONTROLADO",
      observaciones: null,
      danosEstimados: null,
      requiereApoyoAdicional: false,
      requiereAsistenciaSocial: false,
      adjuntoIds: [],
      adjuntos: [],
    });

    expect(respuesta.data.reporteTerreno.adjuntos[0].url).toBe(
      "/uploads/evidencia/faena.webp"
    );
    expect(respuesta.data.incidente?.estado).toBe("EN_ATENCION");

    expect(socketLib.notificarMisionActualizada).toHaveBeenCalledWith(
      expect.objectContaining({
        misionId,
        estado: "COMPLETADA",
        cuadrillaId,
        fechaCierre,
      })
    );
    expect(socketLib.notificarIncidenteActualizado).toHaveBeenCalledWith(
      expect.objectContaining({
        id: incidenteId,
        nuevoEstado: "EN_ATENCION",
      })
    );
    expect(socketLib.emitirCuadrillaActualizada).toHaveBeenCalledWith({
      id: cuadrillaId,
      nombre: "Cuadrilla Vías y Canales 1",
      estado: "DISPONIBLE",
      delegacionId: "30000000-0000-4000-8000-000000000002",
    });
    expect(socketLib.emitirRecursoActualizado).toHaveBeenCalledWith(
      expect.objectContaining({
        id: recursoId,
        cantidadInventario: 88,
        cantidadEnUso: 18,
      })
    );
  });

  it("debe tolerar fallos en Socket.io sin abortar la respuesta exitosa", async () => {
    const fechaCierre = "2026-11-18T19:05:00.000Z";
    vi.mocked(socketLib.notificarMisionActualizada).mockImplementationOnce(() => {
      throw new Error("Redis desconectado");
    });

    vi.mocked(misionRepo.cerrarMisionCuadrillaRepo).mockResolvedValueOnce({
      reporteTerreno: {
        id: "rep-002",
        misionId,
        tipoReporte: "REPORTE_CUADRILLA",
        dictamen: null,
        motivoNoAbordable: null,
        requiereAsistenciaSocial: false,
        versionReporte: 1,
        esRectificacion: false,
        etiquetaReporte: "Informe Técnico Final de Cuadrilla (Cierre de Misión)",
        prioridadSugerida: null,
        prioridadAsignada: "MEDIA",
        justificacionPrioridad: null,
        detallesEvaluacion: {},
        evaluador: {
          id: usuarioId,
          nombre: "Carlos Gómez",
          email: "carlos@valdivia.cl",
          rut: null,
        },
        resumenTecnico: "Faena de despeje completada satisfactoriamente.",
        accionesRealizadas: "Faena de despeje completada satisfactoriamente.",
        requiereApoyoAdicional: false,
        danosEstimados: null,
        observaciones: null,
        personasAfectadas: 0,
        estadoTerreno: "FINALIZADO",
        horasHombre: 3,
        materialesConsumidos: [],
        adjuntos: [],
        creadoEn: fechaCierre,
        actualizadoEn: fechaCierre,
      },
      mision: {
        id: misionId,
        codigo: "MIS-2026-0006",
        titulo: "Prevención punto crítico",
        tipoMision: "PREVENCION",
        estado: "COMPLETADA",
        prioridad: "MEDIA",
        incidenteId: null,
        cuadrillaId,
        fechaInicio: "2026-11-18T15:00:00.000Z",
        fechaCierre,
        actualizadoEn: fechaCierre,
      },
      cuadrilla: {
        id: cuadrillaId,
        nombre: "Cuadrilla Sur",
        estado: "DISPONIBLE",
        delegacionId: null,
      },
      incidente: null,
      recursosActualizados: [],
      hito: {
        id: "hito-002",
        misionId,
        hito: "MISION_COMPLETADA",
        descripcion: "Cierre completo.",
        registradoPorId: usuarioId,
        latitud: null,
        longitud: null,
        metadatos: null,
        creadoEn: fechaCierre,
      },
    });

    const respuesta = await cerrarMisionCuadrillaService(misionId, usuarioId, false, {
      resumenFaenas: "Faena de despeje completada satisfactoriamente.",
      materialesConsumidos: [],
      horasHombre: 3,
      estadoTerreno: "FINALIZADO",
      observaciones: null,
      danosEstimados: null,
      requiereApoyoAdicional: false,
      requiereAsistenciaSocial: false,
      adjuntoIds: [],
      adjuntos: [],
    });

    expect(respuesta.data.mision.estado).toBe("COMPLETADA");
    expect(socketLib.notificarIncidenteActualizado).not.toHaveBeenCalled();
  });

  it("debe mapear reporteCuadrillaEnviado, horasHombre y materialesConsumidos en obtenerDetalleMisionService", async () => {
    vi.mocked(misionRepo.obtenerMisionDetallePorIdRepo).mockResolvedValueOnce({
      mision: {
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: "Atención táctica Las Ánimas",
        descripcion: null,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        justificacion_rechazo: null,
        incidente_id: incidenteId,
        prevencion_id: null,
        cuadrilla_id: cuadrillaId,
        patrulla_id: null,
        encargado_id: null,
        creado_por_id: usuarioId,
        fecha_inicio: new Date("2026-11-18T14:00:00.000Z"),
        fecha_cierre: new Date("2026-11-18T19:00:00.000Z"),
        creado_en: new Date("2026-11-18T13:30:00.000Z"),
        actualizado_en: new Date("2026-11-18T19:00:00.000Z"),
      },
      recursosCuadrilla: [
        {
          id: recursoId,
          nombre: "Sacos de arena 25kg",
          tipo: "GRUPAL",
          cantidadAsignada: 18,
          esIndividual: false,
          unidad: "sacos",
        },
      ],
      reportesTerreno: [
        {
          id: "rep-001",
          mision_id: misionId,
          evaluador_id: usuarioId,
          tipo_reporte: "REPORTE_CUADRILLA",
          dictamen: null,
          motivo_no_abordable: null,
          requiere_asistencia_social: false,
          resumen_tecnico: "Despeje integral ejecutado.",
          acciones_realizadas: "Despeje integral ejecutado.",
          requiere_apoyo_adicional: false,
          danos_estimados: null,
          observaciones: null,
          personas_afectadas: 0,
          estado_terreno: "CONTROLADO",
          version_reporte: 1,
          es_rectificacion: false,
          horas_hombre: "6.50",
          materiales_consumidos: JSON.stringify([
            {
              recursoId,
              nombre: "Sacos de arena 25kg",
              cantidad: 12,
              unidad: "sacos",
            },
          ]),
          creado_en: new Date("2026-11-18T19:00:00.000Z"),
          actualizado_en: new Date("2026-11-18T19:00:00.000Z"),
          evaluador_nombre: "Carlos Gómez",
          evaluador_email: "carlos@valdivia.cl",
          evaluador_rut: null,
          adjuntos: [],
        },
      ],
      hitos: [],
    });

    const detalle = await obtenerDetalleMisionService(misionId);

    expect(detalle?.reportesTerreno[0].etiquetaReporte).toBe(
      "Informe Técnico Final de Cuadrilla (Cierre de Misión)"
    );
    expect(detalle?.reportesTerreno[0].horasHombre).toBe(6.5);
    expect(detalle?.reportesTerreno[0].materialesConsumidos).toEqual([
      {
        recursoId,
        nombre: "Sacos de arena 25kg",
        cantidad: 12,
        unidad: "sacos",
      },
    ]);
    expect(detalle?.evaluaciones?.reporteCuadrillaEnviado).toBe(true);
    expect(detalle?.evaluaciones?.reporteCuadrillaEnviadoEn).toBe(
      "2026-11-18T19:00:00.000Z"
    );
  });

  it("debe emitir estado multi-cuadrilla real cuando otra cuadrilla sigue activa en el incidente", async () => {
    const fechaCierre = "2026-11-18T19:30:00.000Z";
    vi.mocked(misionRepo.cerrarMisionCuadrillaRepo).mockResolvedValueOnce({
      reporteTerreno: {
        id: "rep-003",
        misionId,
        tipoReporte: "REPORTE_CUADRILLA",
        dictamen: null,
        motivoNoAbordable: null,
        requiereAsistenciaSocial: false,
        versionReporte: 1,
        esRectificacion: false,
        etiquetaReporte: "Informe Técnico Final de Cuadrilla (Cierre de Misión)",
        prioridadSugerida: null,
        prioridadAsignada: "ALTA",
        justificacionPrioridad: null,
        detallesEvaluacion: {},
        evaluador: {
          id: usuarioId,
          nombre: "Carlos Gómez",
          email: "carlos@valdivia.cl",
          rut: null,
        },
        resumenTecnico: "Faena de apoyo finalizada.",
        accionesRealizadas: "Faena de apoyo finalizada.",
        requiereApoyoAdicional: false,
        danosEstimados: null,
        observaciones: null,
        personasAfectadas: 0,
        estadoTerreno: "CONTROLADO",
        horasHombre: 4,
        materialesConsumidos: [],
        adjuntos: [],
        creadoEn: fechaCierre,
        actualizadoEn: fechaCierre,
      },
      mision: {
        id: misionId,
        codigo: "MIS-2026-0007",
        titulo: "Apoyo táctico",
        tipoMision: "ATENCION_CUADRILLA",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        incidenteId,
        cuadrillaId,
        fechaInicio: "2026-11-18T15:00:00.000Z",
        fechaCierre,
        actualizadoEn: fechaCierre,
      },
      cuadrilla: {
        id: cuadrillaId,
        nombre: "Cuadrilla Norte",
        estado: "DISPONIBLE",
        delegacionId: null,
      },
      incidente: {
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiereAsistenciaSocial: false,
      },
      estadoOperativoIncidente: {
        cuadrillaAceptada: true,
        tieneMisionEnCurso: true,
        faenasCuadrillaCompletadas: false,
        apoyoSolicitado: false,
        requiereCuadrillaAdicional: false,
        detalleApoyoRequerido: null,
      },
      recursosActualizados: [],
      hito: {
        id: "hito-003",
        misionId,
        hito: "MISION_COMPLETADA",
        descripcion: "Cierre de apoyo.",
        registradoPorId: usuarioId,
        latitud: null,
        longitud: null,
        metadatos: null,
        creadoEn: fechaCierre,
      },
    });

    await cerrarMisionCuadrillaService(misionId, usuarioId, false, {
      resumenFaenas: "Faena de apoyo finalizada.",
      materialesConsumidos: [],
      horasHombre: 4,
      estadoTerreno: "CONTROLADO",
      observaciones: null,
      danosEstimados: null,
      requiereApoyoAdicional: false,
      requiereAsistenciaSocial: false,
      adjuntoIds: [],
      adjuntos: [],
    });

    expect(socketLib.notificarIncidenteActualizado).toHaveBeenCalledWith(
      expect.objectContaining({
        id: incidenteId,
        nuevoEstado: "EN_ATENCION",
        cuadrillaAceptada: true,
        tieneMisionEnCurso: true,
        faenasCuadrillaCompletadas: false,
      })
    );
  });
});
