import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import {
  listarIncidentesPaginadosRepo,
  obtenerIncidenteDetallePorIdRepo,
} from "./incidente-kanban.repository";
import type {
  ListarIncidentesQuery,
  ListarIncidentesResponse,
  IncidenteDetalle,
  IncidenteResumen,
  MisionDetalle,
} from "./incidente-kanban.schema";

/**
 * Obtiene la lista paginada de incidentes para el tablero Kanban con sus metadatos de paginación.
 */
export async function listarIncidentesKanbanService(
  filtros: ListarIncidentesQuery
): Promise<ListarIncidentesResponse> {
  const { filas, total } = await listarIncidentesPaginadosRepo(filtros);
  const meta = buildPaginationMeta(total, filtros.page, filtros.limit);

  const data: IncidenteResumen[] = filas.map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    codigoSeguimiento: fila.codigo_seguimiento,
    tipoAfectacion: fila.tipo_afectacion,
    descripcion: fila.descripcion,
    direccion: fila.direccion_texto,
    latitud: Number(fila.latitud),
    longitud: Number(fila.longitud),
    estado: (fila.estado?.toUpperCase() || "REPORTADO") as IncidenteResumen["estado"],
    prioridad: fila.prioridad as IncidenteResumen["prioridad"],
    prioridadSugerida: (fila.prioridad_sugerida as IncidenteResumen["prioridadSugerida"]) ?? null,
    justificacionPrioridad: fila.justificacion_prioridad ?? null,
    totalReportesTerreno: Number(fila.total_reportes_terreno ?? 0),
    requiereAsistenciaSocial: Boolean(fila.requiere_asistencia_social),
    fuenteOrigen: fila.fuente_origen,
    informanteNombre: fila.informante_nombre,
    delegacionNombre: fila.delegacion_nombre,
    totalMisiones: Number(fila.total_misiones ?? 0),
    tieneMisionDespachada: Boolean(fila.tiene_mision_despachada),
    tieneMisionEnCurso: Boolean(fila.tiene_mision_en_curso),
    verificado: Boolean(fila.verificado),
    reclasificadoEnTerreno: Boolean(fila.verificado || fila.reclasificado_en_terreno),
    justificacionReclasificacion: fila.justificacion_reclasificacion ?? null,
    creadoEn:
      typeof fila.creado_en === "string"
        ? fila.creado_en
        : new Date(fila.creado_en).toISOString(),
    actualizadoEn:
      typeof fila.actualizado_en === "string"
        ? fila.actualizado_en
        : new Date(fila.actualizado_en).toISOString(),
  }));

  return {
    message: "Listado de incidentes obtenido exitosamente",
    data,
    meta,
    paginacion: {
      total,
      pagina: filtros.page,
      limite: filtros.limit,
      totalPaginas: meta.totalPages,
      tieneSiguiente: meta.hasNext,
      tieneAnterior: meta.hasPrev,
    },
  };
}

/**
 * Obtiene la información exhaustiva de un incidente incluyendo informante, misiones, patrulla, cuadrilla y recursos.
 */
export async function obtenerDetalleIncidenteService(
  id: string
): Promise<IncidenteDetalle | null> {
  const resultado = await obtenerIncidenteDetallePorIdRepo(id);
  if (!resultado) {
    return null;
  }

  const {
    incidente,
    misiones,
    recursosAsociados,
    reportesEvaluacionTerreno: reportesRaw = [],
    justificacionReclasificacion,
    reclasificacionTipologiaRaw = null,
  } = resultado;

  const tieneVerificacionCompletada = misiones.some(
    (m) => m.tipo_mision === "VERIFICACION" && m.estado === "COMPLETADA"
  );
  const esVerificado = Boolean(
    tieneVerificacionCompletada ||
      justificacionReclasificacion ||
      reportesRaw.length > 0 ||
      incidente.justificacion_prioridad
  );

  const reportesMapeados: NonNullable<IncidenteDetalle["reportesEvaluacionTerreno"]> =
    reportesRaw.map((rep) => {
      const versionReporte = Number(rep.version_reporte ?? 1);
      const esRectificacion = Boolean(rep.es_rectificacion ?? versionReporte > 1);
      let evaluacionObj: Record<string, unknown> = {};
      if (typeof rep.detalles_evaluacion === "string") {
        try {
          evaluacionObj = JSON.parse(rep.detalles_evaluacion);
        } catch {
          evaluacionObj = {};
        }
      } else if (rep.detalles_evaluacion && typeof rep.detalles_evaluacion === "object") {
        evaluacionObj = rep.detalles_evaluacion;
      }

      return {
        id: rep.id,
        misionId: rep.mision_id,
        versionReporte,
        esRectificacion,
        etiquetaReporte: esRectificacion
          ? `Reporte de Evaluación #${versionReporte} (Rectificación)`
          : `Reporte de Evaluación #1 (Inicial)`,
        prioridadSugerida:
          (rep.prioridad_sugerida as IncidenteDetalle["prioridadSugerida"]) ?? null,
        prioridadAsignada:
          (rep.prioridad_asignada as IncidenteDetalle["prioridadSugerida"]) ?? null,
        justificacionPrioridad: rep.justificacion_prioridad ?? null,
        resumenTecnico: rep.resumen_tecnico,
        accionesRealizadas: rep.acciones_realizadas ?? null,
        danosEstimados: rep.danos_estimados ?? null,
        observaciones: rep.observaciones ?? null,
        personasAfectadas: Number(rep.personas_afectadas ?? 0),
        requiereApoyoAdicional: Boolean(rep.requiere_apoyo_adicional),
        evaluacion: evaluacionObj,
        evaluador: {
          id: rep.evaluador_id,
          nombre: rep.evaluador_nombre ?? "Patrullero en Terreno",
          email: rep.evaluador_email ?? null,
          rut: rep.evaluador_rut ?? null,
        },
        creadoEn:
          typeof rep.creado_en === "string"
            ? rep.creado_en
            : new Date(rep.creado_en).toISOString(),
      };
    });

  const misionesMapeadas: MisionDetalle[] = misiones.map((m) => ({
    id: m.id,
    codigo: m.codigo,
    titulo:
      m.tipo_mision === "VERIFICACION" && incidente.tipo_afectacion && incidente.codigo
        ? `Verificación: ${incidente.tipo_afectacion} - ${incidente.codigo}`
        : m.titulo,
    descripcion: m.descripcion,
    tipoMision: m.tipo_mision,
    estado: m.estado,
    prioridad: m.prioridad,
    justificacionRechazo: m.justificacion_rechazo,
    patrulla: m.patrulla_id
      ? {
          id: m.patrulla_id,
          nombre: m.patrulla_nombre ?? "Patrulla Verificadora",
          estado: m.patrulla_estado ?? "DISPONIBLE",
        }
      : null,
    cuadrilla: m.cuadrilla_id
      ? {
          id: m.cuadrilla_id,
          nombre: m.cuadrilla_nombre ?? "Cuadrilla Operativa",
          estado: m.cuadrilla_estado ?? "DISPONIBLE",
        }
      : null,
    fechaInicio: m.fecha_inicio ? new Date(m.fecha_inicio).toISOString() : null,
    fechaCierre: m.fecha_cierre ? new Date(m.fecha_cierre).toISOString() : null,
    creadoEn:
      typeof m.creado_en === "string"
        ? m.creado_en
        : new Date(m.creado_en).toISOString(),
  }));

  let reclasificacionTipologia: IncidenteDetalle["reclasificacionTipologia"] = null;
  if (reclasificacionTipologiaRaw) {
    let metaObj: Record<string, unknown> = {};
    if (typeof reclasificacionTipologiaRaw.metadatos === "string") {
      try {
        metaObj = JSON.parse(reclasificacionTipologiaRaw.metadatos);
      } catch {
        metaObj = {};
      }
    } else if (
      reclasificacionTipologiaRaw.metadatos &&
      typeof reclasificacionTipologiaRaw.metadatos === "object"
    ) {
      metaObj = reclasificacionTipologiaRaw.metadatos;
    }

    const tipoAnterior =
      typeof metaObj.tipoAnterior === "string" && metaObj.tipoAnterior.trim().length > 0
        ? metaObj.tipoAnterior.trim()
        : null;

    const matchTipo = reclasificacionTipologiaRaw.descripcion.match(
      /reclasificada en terreno a:\s*([^.]+)\./i
    );
    const tipoNuevo =
      typeof metaObj.tipoNuevo === "string" && metaObj.tipoNuevo.trim().length > 0
        ? metaObj.tipoNuevo.trim()
        : matchTipo?.[1]?.trim() || incidente.tipo_afectacion;

    const matchJustif = reclasificacionTipologiaRaw.descripcion.match(
      /Justificación:\s*(.+)$/i
    );
    const justificacionExtraida =
      typeof metaObj.justificacion === "string" && metaObj.justificacion.trim().length > 0
        ? metaObj.justificacion.trim()
        : matchJustif?.[1]?.trim() || reclasificacionTipologiaRaw.descripcion;

    reclasificacionTipologia = {
      hitoId: reclasificacionTipologiaRaw.hito_id,
      misionId: reclasificacionTipologiaRaw.mision_id,
      misionCodigo: reclasificacionTipologiaRaw.mision_codigo,
      tipoAnterior,
      tipoNuevo,
      justificacion: justificacionExtraida,
      registradoPor: reclasificacionTipologiaRaw.registrador_nombre ?? null,
      creadoEn:
        typeof reclasificacionTipologiaRaw.creado_en === "string"
          ? reclasificacionTipologiaRaw.creado_en
          : new Date(reclasificacionTipologiaRaw.creado_en).toISOString(),
    };
  }

  const truncarResumen = (texto: string, max = 140): string => {
    const limpio = texto.replace(/\s+/g, " ").trim();
    return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio;
  };

  let ultimoReporte: IncidenteDetalle["ultimoReporte"] = null;
  const reportesOrdenadosFecha = [...reportesMapeados].sort(
    (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()
  );
  const topReporteTerreno = reportesOrdenadosFecha[0] ?? null;

  const tsReporte = topReporteTerreno ? new Date(topReporteTerreno.creadoEn).getTime() : -1;
  const tsReclasif = reclasificacionTipologia
    ? new Date(reclasificacionTipologia.creadoEn).getTime()
    : -1;

  if (topReporteTerreno && tsReporte >= tsReclasif) {
    const misionRef = misionesMapeadas.find((m) => m.id === topReporteTerreno.misionId);
    const textoBase =
      topReporteTerreno.observaciones ||
      topReporteTerreno.accionesRealizadas ||
      topReporteTerreno.resumenTecnico;
    ultimoReporte = {
      origen: "REPORTE_TERRENO",
      reporteId: topReporteTerreno.id,
      misionId: topReporteTerreno.misionId,
      misionCodigo: misionRef?.codigo ?? "",
      evaluadorNombre: topReporteTerreno.evaluador.nombre,
      creadoEn: topReporteTerreno.creadoEn,
      resumen: truncarResumen(textoBase),
      prioridadAsignada: topReporteTerreno.prioridadAsignada ?? null,
      versionReporte: topReporteTerreno.versionReporte,
      esRectificacion: topReporteTerreno.esRectificacion,
    };
  } else if (reclasificacionTipologia) {
    const misionRef = misionesMapeadas.find(
      (m) => m.id === reclasificacionTipologia.misionId
    );
    const glosaCambio = reclasificacionTipologia.tipoAnterior
      ? `Tipología cambiada de ${reclasificacionTipologia.tipoAnterior} a ${reclasificacionTipologia.tipoNuevo}.`
      : `Tipología constatada: ${reclasificacionTipologia.tipoNuevo}.`;
    ultimoReporte = {
      origen: "RECLASIFICACION",
      reporteId: `reclasificacion-${reclasificacionTipologia.hitoId}`,
      misionId: reclasificacionTipologia.misionId,
      misionCodigo: reclasificacionTipologia.misionCodigo,
      evaluadorNombre:
        reclasificacionTipologia.registradoPor ||
        (misionRef?.patrulla?.nombre ? `Patrulla ${misionRef.patrulla.nombre}` : "Patrulla Verificadora"),
      creadoEn: reclasificacionTipologia.creadoEn,
      resumen: truncarResumen(`${glosaCambio} ${reclasificacionTipologia.justificacion}`),
      prioridadAsignada: null,
      versionReporte: null,
      esRectificacion: false,
    };
  }

  return {
    id: incidente.id,
    codigo: incidente.codigo,
    codigoSeguimiento: incidente.codigo_seguimiento,
    tipoAfectacion: incidente.tipo_afectacion,
    descripcion: incidente.descripcion,
    direccion: incidente.direccion_texto,
    latitud: Number(incidente.latitud),
    longitud: Number(incidente.longitud),
    estado: (incidente.estado?.toUpperCase() || "REPORTADO") as IncidenteDetalle["estado"],
    prioridad: incidente.prioridad as IncidenteDetalle["prioridad"],
    prioridadSugerida:
      ((incidente as { prioridad_sugerida?: string | null }).prioridad_sugerida as IncidenteDetalle["prioridadSugerida"]) ??
      null,
    justificacionPrioridad:
      (incidente as { justificacion_prioridad?: string | null }).justificacion_prioridad ??
      null,
    requiereAsistenciaSocial: Boolean(incidente.requiere_asistencia_social),
    fuenteOrigen: incidente.fuente_origen,
    asteriskCallId: incidente.asterisk_call_id,
    asteriskCallerPhone: incidente.asterisk_caller_phone,
    informante: incidente.informante_id
      ? {
          id: incidente.informante_id,
          rut: incidente.informante_rut ?? "",
          nombre: incidente.informante_nombre ?? "",
          telefono: incidente.informante_telefono ?? null,
        }
      : null,
    delegacion: incidente.delegacion_id
      ? {
          id: incidente.delegacion_id,
          nombre: incidente.delegacion_nombre ?? "",
          descripcion: incidente.delegacion_descripcion ?? null,
        }
      : null,
    creadoPor: incidente.creador_id
      ? {
          id: incidente.creador_id,
          nombre: incidente.creador_nombre ?? "",
          email: incidente.creador_email ?? "",
        }
      : null,
    encargado: incidente.encargado_id
      ? {
          id: incidente.encargado_id,
          nombre: incidente.encargado_nombre ?? "",
          email: incidente.encargado_email ?? "",
        }
      : null,
    misiones: misionesMapeadas,
    recursosAsociados,
    reportesEvaluacionTerreno: reportesMapeados,
    verificado: esVerificado,
    reclasificadoEnTerreno: esVerificado,
    justificacionReclasificacion: justificacionReclasificacion ?? null,
    reclasificacionTipologia,
    ultimoReporte,
    creadoEn:
      typeof incidente.creado_en === "string"
        ? incidente.creado_en
        : new Date(incidente.creado_en).toISOString(),
    actualizadoEn:
      typeof incidente.actualizado_en === "string"
        ? incidente.actualizado_en
        : new Date(incidente.actualizado_en).toISOString(),
  };
}
