import {
  obtenerMisionDetallePorIdRepo,
  crearMisionVerificacionRepo,
  aceptarMisionPatrullaRepo,
  asignarCuadrillaIncidenteRepo,
  rechazarMisionCuadrillaRepo,
  crearReporteVerificacionYCerrarMisionRepo,
  cerrarMisionCuadrillaRepo,
} from "./mision.repository";
import type {
  MisionDetalleCompleto,
  MisionBitacoraHito,
  ReporteTerrenoDetalle,
  AdjuntoEvidencia,
  MaterialConsumidoDetalle,
  CrearMisionVerificacionInput,
  CrearMisionResponse,
  AceptarMisionInput,
  AceptarMisionResponse,
  AsignarCuadrillaMisionInput,
  AsignarCuadrillaMisionResponse,
  RechazarMisionInput,
  RechazarMisionResponse,
  CrearReporteVerificacionInput,
  EnviarReporteVerificacionResponse,
  CerrarMisionCuadrillaInput,
  CerrarMisionCuadrillaResponse,
} from "./mision.schema";
import {
  notificarMisionAsignada,
  notificarIncidenteActualizado,
  notificarPatrullaActualizada,
  notificarMisionActualizada,
  notificarTrazabilidadActualizada,
  tieneConexionEnSala,
  notificarPatrullaLiberada,
  emitirCuadrillaActualizada,
  emitirRecursoActualizado,
  notificarMisionRechazada,
} from "@/lib/socket";
import { marcarNotificacionEnviadaRepo } from "./notificacion-mision.repository";

function formatearFechaIso(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  return typeof fecha === "string" ? new Date(fecha).toISOString() : fecha.toISOString();
}

function parsearMaterialesConsumidos(raw: unknown): MaterialConsumidoDetalle[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed as MaterialConsumidoDetalle[];
}

function desglosarHitoTiempo(
  fecha: Date | string,
  hito: string,
  descripcion: string,
  id?: string,
  metadatosRaw?: Record<string, unknown> | string | null,
  registradoPor?: { id: string; nombre: string; email?: string } | null
): MisionBitacoraHito {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const iso = d.toISOString();
  const [fechaStr, resto] = iso.split("T");
  const horaStr = resto.split(".")[0];

  let metadatos: Record<string, unknown> | null | undefined = undefined;
  if (typeof metadatosRaw === "string") {
    try {
      metadatos = JSON.parse(metadatosRaw);
    } catch {
      metadatos = null;
    }
  } else if (metadatosRaw && typeof metadatosRaw === "object") {
    metadatos = metadatosRaw;
  } else if (metadatosRaw === null) {
    metadatos = null;
  }

  if (registradoPor && metadatos && !metadatos.evaluador) {
    metadatos = { ...metadatos, evaluador: registradoPor };
  }

  return {
    ...(id ? { id } : {}),
    hito,
    fecha: fechaStr,
    hora: horaStr,
    timestamp: iso,
    descripcion,
    ...(registradoPor ? { registradoPor } : {}),
    ...(metadatos !== undefined ? { metadatos } : {}),
  };
}

/**
 * Servicio de negocio para consultar el detalle exhaustivo de una misión por su ID.
 * Transforma los registros de persistencia al contrato DTO unificado, estructurando
 * el incidente asociado, equipo a cargo, bitácora de tiempos y reportes de terreno con adjuntos.
 */
export async function obtenerDetalleMisionService(
  id: string
): Promise<MisionDetalleCompleto | null> {
  const resultado = await obtenerMisionDetallePorIdRepo(id);
  if (!resultado) {
    return null;
  }

  const {
    mision,
    recursosCuadrilla,
    reportesTerreno: reportesRaw,
    hitos = [],
    adjuntosMision,
  } = resultado;

  // 1. Bitácora de tiempos (incorporando hitos reales de mision_hito o fallback a timestamps)
  const bitacoraTiempos: MisionBitacoraHito[] = [];

  if (resultado.hitos && resultado.hitos.length > 0) {
    for (const h of resultado.hitos) {
      const registradoPor =
        h.registrado_por_id && h.registrador_nombre
          ? {
              id: h.registrado_por_id,
              nombre: h.registrador_nombre,
              ...(h.registrador_email ? { email: h.registrador_email } : {}),
            }
          : undefined;
      bitacoraTiempos.push(
        desglosarHitoTiempo(
          h.creado_en,
          h.hito,
          h.descripcion,
          h.id,
          h.metadatos,
          registradoPor
        )
      );
    }
  } else {
    if (mision.creado_en) {
      bitacoraTiempos.push(
        desglosarHitoTiempo(
          mision.creado_en,
          "CREACION",
          "Misión planificada y registrada en el sistema"
        )
      );
    }

    if (mision.fecha_inicio) {
      bitacoraTiempos.push(
        desglosarHitoTiempo(
          mision.fecha_inicio,
          "DESPLIEGUE_INICIO",
          "Inicio formal de operaciones y traslado a terreno"
        )
      );
    }

    if (mision.fecha_cierre) {
      bitacoraTiempos.push(
        desglosarHitoTiempo(
          mision.fecha_cierre,
          "CIERRE_MISION",
          "Cierre operacional de la misión tras repliegue"
        )
      );
    } else if (
      mision.actualizado_en &&
      new Date(mision.actualizado_en).getTime() !== new Date(mision.creado_en).getTime()
    ) {
      const estadoLegible =
        mision.estado === "EN_CURSO"
          ? "En curso"
          : mision.estado === "DESPACHADA"
          ? "Despachada"
          : mision.estado === "COMPLETADA"
          ? "Completada"
          : mision.estado === "RECHAZADA"
          ? "Rechazada"
          : mision.estado === "PLANIFICADA"
          ? "Planificada"
          : mision.estado;

      bitacoraTiempos.push(
        desglosarHitoTiempo(
          mision.actualizado_en,
          "ACTUALIZACION_ESTADO",
          `Última actualización de estado registrada: ${estadoLegible}`
        )
      );
    }
  }

  // Ordenar cronológicamente por timestamp
  bitacoraTiempos.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // 2. Mapeo de Reportes de Terreno y Evidencias Multimedia
  const reportesMapeados: ReporteTerrenoDetalle[] = reportesRaw.map((rep) => {
    const adjuntosMapeados: AdjuntoEvidencia[] = (rep.adjuntos || []).map((adj) => {
      // Normalizar URL asegurando ruta relativa canónica bajo Caddy
      let urlNormalizada = adj.url;
      if (!urlNormalizada.startsWith("http://") && !urlNormalizada.startsWith("https://") && !urlNormalizada.startsWith("/")) {
        urlNormalizada = `/${urlNormalizada}`;
      }

      return {
        id: adj.id,
        nombreArchivo: adj.nombre_archivo,
        url: urlNormalizada,
        tipoMime: adj.tipo_mime,
        tamanoBytes: Number(adj.tamano_bytes),
        creadoEn: formatearFechaIso(adj.creado_en) || new Date().toISOString(),
      };
    });

    const tipoReporte = rep.tipo_reporte ?? undefined;
    const dictamen =
      (rep.dictamen as ReporteTerrenoDetalle["dictamen"]) ?? null;
    const versionReporte = Number(rep.version_reporte ?? 1);
    const esRectificacion = Boolean(rep.es_rectificacion ?? versionReporte > 1);
    let detallesEvaluacionObj: Record<string, unknown> = {};
    if (typeof rep.detalles_evaluacion === "string") {
      try {
        detallesEvaluacionObj = JSON.parse(rep.detalles_evaluacion);
      } catch {
        detallesEvaluacionObj = {};
      }
    } else if (rep.detalles_evaluacion && typeof rep.detalles_evaluacion === "object") {
      detallesEvaluacionObj = rep.detalles_evaluacion;
    }

    const etiquetaReporte =
      tipoReporte === "VERIFICACION_CIERRE"
        ? dictamen === "NO_ABORDABLE"
          ? "Informe Técnico de Verificación (Cierre — No Abordable)"
          : "Informe Técnico de Verificación (Cierre — Requiere Cuadrilla)"
        : tipoReporte === "REPORTE_CUADRILLA"
          ? "Informe Técnico Final de Cuadrilla (Cierre de Misión)"
          : esRectificacion
            ? `Reporte de Evaluación #${versionReporte} (Rectificación)`
            : `Reporte de Evaluación #1 (Inicial)`;

    return {
      id: rep.id,
      misionId: rep.mision_id,
      ...(tipoReporte ? { tipoReporte } : {}),
      ...(rep.dictamen !== undefined ? { dictamen } : {}),
      ...(rep.motivo_no_abordable !== undefined
        ? { motivoNoAbordable: rep.motivo_no_abordable ?? null }
        : {}),
      ...(rep.requiere_asistencia_social !== undefined
        ? { requiereAsistenciaSocial: Boolean(rep.requiere_asistencia_social) }
        : {}),
      versionReporte,
      esRectificacion,
      etiquetaReporte,
      prioridadSugerida:
        (rep.prioridad_sugerida as ReporteTerrenoDetalle["prioridadSugerida"]) ?? null,
      prioridadAsignada:
        (rep.prioridad_asignada as ReporteTerrenoDetalle["prioridadAsignada"]) ?? null,
      justificacionPrioridad: rep.justificacion_prioridad ?? null,
      detallesEvaluacion: detallesEvaluacionObj,
      resumenTecnico: rep.resumen_tecnico,
      accionesRealizadas: rep.acciones_realizadas ?? null,
      requiereApoyoAdicional: Boolean(rep.requiere_apoyo_adicional),
      danosEstimados: rep.danos_estimados ?? null,
      observaciones: rep.observaciones ?? null,
      personasAfectadas: Number(rep.personas_afectadas ?? 0),
      estadoTerreno: rep.estado_terreno || "FINALIZADO",
      ...(rep.horas_hombre !== undefined
        ? {
            horasHombre:
              rep.horas_hombre !== null ? Number(rep.horas_hombre) : null,
          }
        : {}),
      ...(rep.materiales_consumidos !== undefined
        ? {
            materialesConsumidos: parsearMaterialesConsumidos(
              rep.materiales_consumidos
            ),
          }
        : {}),
      evaluador: {
        id: rep.evaluador_id,
        nombre: rep.evaluador_nombre || "Funcionario en Terreno",
        email: rep.evaluador_email || "funcionario@valdivia.cl",
        rut: rep.evaluador_rut ?? null,
      },
      adjuntos: adjuntosMapeados,
      creadoEn: formatearFechaIso(rep.creado_en) || new Date().toISOString(),
      actualizadoEn: formatearFechaIso(rep.actualizado_en) || new Date().toISOString(),
    };
  });

  // 3. Mapeo de Incidente formal asociado (si aplica)
  const incidente = mision.incidente_id
    ? {
        id: mision.incidente_id,
        codigo: mision.incidente_codigo ?? "",
        codigoSeguimiento: mision.incidente_codigo_seguimiento ?? "",
        tipoAfectacion: mision.incidente_tipo_afectacion ?? "Emergencia General",
        descripcion: mision.incidente_descripcion ?? null,
        direccion: mision.incidente_direccion ?? "Valdivia, Región de Los Ríos",
        latitud: Number(mision.incidente_latitud ?? -39.819588),
        longitud: Number(mision.incidente_longitud ?? -73.245209),
        estado: mision.incidente_estado ?? "EN_ATENCION",
        prioridad: mision.incidente_prioridad ?? "MEDIA",
        prioridadSugerida: mision.incidente_prioridad_sugerida ?? null,
        justificacionPrioridad: mision.incidente_justificacion_prioridad ?? null,
        requiereAsistenciaSocial: Boolean(mision.incidente_requiere_asistencia_social),
        fechaCierre: formatearFechaIso(mision.incidente_fecha_cierre),
        motivoNoAbordable: mision.incidente_motivo_no_abordable ?? null,
        delegacionNombre: mision.incidente_delegacion_nombre ?? null,
      }
    : null;

  // 4. Mapeo de Punto Crítico Preventivo (si aplica para misiones sin incidente formal)
  const prevencion = mision.prevencion_id
    ? {
        id: mision.prevencion_id,
        codigo: mision.prevencion_codigo ?? "",
        nombre: mision.prevencion_nombre ?? "",
        descripcion: mision.prevencion_descripcion ?? null,
        latitud: Number(mision.prevencion_latitud ?? -39.819588),
        longitud: Number(mision.prevencion_longitud ?? -73.245209),
        delegacionNombre: mision.prevencion_delegacion_nombre ?? null,
      }
    : null;

  // 5. Mapeo de Cuadrilla Asignada
  const cuadrilla = mision.cuadrilla_id
    ? {
        id: mision.cuadrilla_id,
        nombre: mision.cuadrilla_nombre ?? "Cuadrilla Operativa",
        estado: mision.cuadrilla_estado ?? "DISPONIBLE",
        delegacionNombre: mision.cuadrilla_delegacion_nombre ?? null,
        delegado: mision.delegado_id
          ? {
              id: mision.delegado_id,
              nombre: mision.delegado_nombre ?? "Delegado de Cuadrilla",
              email: mision.delegado_email ?? "",
            }
          : null,
        recursos: recursosCuadrilla,
      }
    : null;

  // 6. Mapeo de Patrulla Asignada
  const patrulla = mision.patrulla_id
    ? {
        id: mision.patrulla_id,
        nombre: mision.patrulla_nombre ?? "Patrulla Verificadora",
        estado: mision.patrulla_estado ?? "DISPONIBLE",
        delegacionNombre: mision.patrulla_delegacion_nombre ?? null,
        lider: mision.lider_id
          ? {
              id: mision.lider_id,
              nombre: mision.lider_nombre ?? "Líder de Patrulla",
              email: mision.lider_email ?? "",
            }
          : null,
      }
    : null;

  // 7. Mapeo de Creador y Encargado
  const creadoPor = mision.creador_id
    ? {
        id: mision.creador_id,
        nombre: mision.creador_nombre ?? "Operador",
        email: mision.creador_email ?? "",
      }
    : null;

  const encargado = mision.encargado_id_res
    ? {
        id: mision.encargado_id_res,
        nombre: mision.encargado_nombre ?? "Encargado de Operaciones",
        email: mision.encargado_email ?? "",
      }
    : null;

  const hitosTipologia = (hitos || []).filter(
    (h) => h.hito === "TIPOLOGIA_RECLASIFICADA" || h.hito === "TIPOLOGIA_CONFIRMADA"
  );
  const ultimoHitoTipologia =
    hitosTipologia.length > 0 ? hitosTipologia[hitosTipologia.length - 1] : null;

  const reportesPrioridad = reportesMapeados.filter(
    (r) => !r.tipoReporte || r.tipoReporte === "EVALUACION_PRIORIDAD"
  );
  const reportesPorVersion = [...reportesPrioridad].sort((a, b) => {
    const vA = Number(a.versionReporte ?? 0);
    const vB = Number(b.versionReporte ?? 0);
    if (vA !== vB) return vB - vA;
    return new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime();
  });
  const ultimoReportePrioridad = reportesPorVersion[0] ?? null;

  const reportesCierre = reportesMapeados
    .filter((r) => r.tipoReporte === "VERIFICACION_CIERRE")
    .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
  const reporteVerificacion = reportesCierre[0] ?? null;

  const reportesCuadrilla = reportesMapeados
    .filter((r) => r.tipoReporte === "REPORTE_CUADRILLA")
    .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
  const ultimoReporteCuadrilla = reportesCuadrilla[0] ?? null;

  const adjuntosMisionMapeados: AdjuntoEvidencia[] | undefined = Array.isArray(adjuntosMision)
    ? adjuntosMision.map((adj) => {
        let urlNormalizada = adj.url;
        if (
          !urlNormalizada.startsWith("http://") &&
          !urlNormalizada.startsWith("https://") &&
          !urlNormalizada.startsWith("/")
        ) {
          urlNormalizada = `/${urlNormalizada}`;
        }
        return {
          id: adj.id,
          nombreArchivo: adj.nombre_archivo,
          url: urlNormalizada,
          tipoMime: adj.tipo_mime,
          tamanoBytes: Number(adj.tamano_bytes),
          creadoEn: formatearFechaIso(adj.creado_en) || new Date().toISOString(),
        };
      })
    : undefined;

  return {
    id: mision.id,
    codigo: mision.codigo,
    titulo:
      mision.tipo_mision === "VERIFICACION" && mision.incidente_tipo_afectacion && mision.incidente_codigo
        ? `Verificación: ${mision.incidente_tipo_afectacion} - ${mision.incidente_codigo}`
        : mision.titulo,
    descripcion: mision.descripcion,
    tipoMision: mision.tipo_mision as MisionDetalleCompleto["tipoMision"],
    estado: mision.estado as MisionDetalleCompleto["estado"],
    prioridad: mision.prioridad as MisionDetalleCompleto["prioridad"],
    justificacionRechazo: mision.justificacion_rechazo,
    ...(mision.trazabilidad_notificacion
      ? {
          trazabilidadNotificacion:
            mision.trazabilidad_notificacion as MisionDetalleCompleto["trazabilidadNotificacion"],
        }
      : {}),
    fechaInicio: formatearFechaIso(mision.fecha_inicio),
    fechaCierre: formatearFechaIso(mision.fecha_cierre),
    creadoEn: formatearFechaIso(mision.creado_en) || new Date().toISOString(),
    actualizadoEn: formatearFechaIso(mision.actualizado_en) || new Date().toISOString(),
    creadoPor,
    encargado,
    incidente,
    prevencion,
    cuadrilla,
    patrulla,
    bitacoraTiempos,
    reportesTerreno: reportesMapeados,
    ...(adjuntosMisionMapeados ? { adjuntos: adjuntosMisionMapeados } : {}),
    evaluaciones: {
      tipologiaEvaluada: hitosTipologia.length > 0,
      tipologiaEvaluadaEn: ultimoHitoTipologia
        ? formatearFechaIso(ultimoHitoTipologia.creado_en)
        : null,
      prioridadEvaluada: reportesPrioridad.length > 0,
      prioridadEvaluadaEn: ultimoReportePrioridad?.creadoEn ?? null,
      versionReportePrioridad: ultimoReportePrioridad?.versionReporte ?? null,
      personasAfectadasPrevias: ultimoReportePrioridad
        ? Number(ultimoReportePrioridad.personasAfectadas ?? 0)
        : 0,
      reporteVerificacionEnviado: Boolean(reporteVerificacion),
      reporteVerificacionEnviadoEn: reporteVerificacion?.creadoEn ?? null,
      dictamenVerificacion: reporteVerificacion?.dictamen ?? null,
      reporteCuadrillaEnviado: Boolean(ultimoReporteCuadrilla),
      reporteCuadrillaEnviadoEn: ultimoReporteCuadrilla?.creadoEn ?? null,
    },
  };
}

// ========================================================
// HU-21: Asignar Cuadrilla a Incidente y Liberar Patrulla
// ========================================================

export async function asignarCuadrillaMisionService(
  input: AsignarCuadrillaMisionInput,
  usuarioId: string
): Promise<AsignarCuadrillaMisionResponse> {
  // 1. Ejecutar transacción atómica en repositorio
  const resultado = await asignarCuadrillaIncidenteRepo(input, usuarioId);

  // 2. Notificaciones WebSocket reactivas
  try {
    // a) Misión asignada a la cuadrilla y al Centro de Mando
    notificarMisionAsignada({
      misionId: resultado.mision.id,
      codigo: resultado.mision.codigo,
      tipoMision: resultado.mision.tipoMision,
      cuadrillaId: resultado.cuadrilla.id,
      incidenteId: resultado.incidente.id,
      asignadoEn: resultado.mision.creadoEn,
    });

    // BUG-H21-API-05: Emisión de cuadrilla actualizada a estado EN_MISION
    emitirCuadrillaActualizada({
      id: resultado.cuadrilla.id,
      nombre: resultado.cuadrilla.nombre,
      estado: "EN_MISION",
      delegacionId: resultado.cuadrilla.delegacionId,
    });

    // b) Si existía patrulla verificadora previa, notificar su liberación
    if (resultado.patrullaLiberada) {
      notificarPatrullaLiberada({
        patrullaId: resultado.patrullaLiberada.id,
        nombre: resultado.patrullaLiberada.nombre,
        misionPreviaId: resultado.patrullaLiberada.misionPreviaId,
        incidenteId: resultado.incidente.id,
        estado: "DISPONIBLE",
        liberadaEn: new Date().toISOString(),
      });

      notificarPatrullaActualizada({
        patrullaId: resultado.patrullaLiberada.id,
        nombre: resultado.patrullaLiberada.nombre,
        estado: "DISPONIBLE",
        delegacionId: null,
        usuarioLiderId: null,
        misionActivaId: null,
        incidenteId: null,
        actualizadoEn: new Date().toISOString(),
      });
    }

    // c) Notificar actualización de estado del incidente al Centro de Mando
    notificarIncidenteActualizado({
      id: resultado.incidente.id,
      codigo: resultado.incidente.codigo,
      nuevoEstado: "EN_ATENCION",
      prioridad: resultado.incidente.prioridad,
      actualizadoEn: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error al emitir eventos WebSocket tras asignar cuadrilla:", error);
  }

  // 3. Estructurar respuesta DTO
  const mensaje = resultado.patrullaLiberada
    ? `Cuadrilla '${resultado.cuadrilla.nombre}' asignada exitosamente al incidente ${resultado.incidente.codigo}. La patrulla verificadora previa ha sido liberada a estado DISPONIBLE.`
    : `Cuadrilla '${resultado.cuadrilla.nombre}' asignada exitosamente al incidente ${resultado.incidente.codigo}.`;

  return {
    message: mensaje,
    data: {
      mision: resultado.mision,
      cuadrilla: resultado.cuadrilla,
      incidente: resultado.incidente,
      patrullaLiberada: resultado.patrullaLiberada,
      hitoCuadrilla: resultado.hitoCuadrilla,
      hitoPatrulla: resultado.hitoPatrulla,
    },
  };
}

/**
 * HU-20 - Servicio de negocio para asignar y despachar una patrulla verificadora disponible
 * a un incidente en estado REPORTADO.
 *
 * 1. Ejecuta la transacción atómica en persistencia.
 * 2. Emite eventos reactivos Socket.io a través del broker Redis:
 *    - 'mision:asignada' a la sala de la patrulla ('patrulla:{id}') y 'encargado'.
 *    - 'incidente:actualizado' a las salas 'encargado' y 'mapa' (mueve Kanban a 'VERIFICANDO').
 *    - 'patrulla:actualizada' para actualizar la disponibilidad en el mapa y listados.
 */
export async function asignarPatrullaVerificacionService(
  input: CrearMisionVerificacionInput,
  operadorId: string
): Promise<CrearMisionResponse> {
  const resultado = await crearMisionVerificacionRepo(input, operadorId);

  const patrullaRoom = `patrulla:${resultado.patrulla.id}`;
  const patrullaConectada = await tieneConexionEnSala(patrullaRoom);

  let notificacionActualizada = resultado.notificacion;
  if (patrullaConectada) {
    const enviada = await marcarNotificacionEnviadaRepo(resultado.notificacion.id);
    if (enviada) {
      notificacionActualizada = enviada;
    }
  }

  // Emitir eventos WebSocket en segundo plano
  try {
    notificarMisionAsignada({
      notificacionId: notificacionActualizada.id,
      misionId: resultado.mision.id,
      codigo: resultado.mision.codigo,
      tipoMision: resultado.mision.tipoMision,
      patrullaId: resultado.patrulla.id,
      incidenteId: resultado.incidente.id,
      incidenteCodigo: resultado.incidente.codigo,
      incidenteFolio: resultado.incidente.folio ?? null,
      tipoAfectacion: resultado.incidente.tipoAfectacion ?? null,
      direccion: resultado.incidente.direccion ?? null,
      prioridad: resultado.mision.prioridad,
      asignadoEn: resultado.mision.creadoEn,
    });

    if (patrullaConectada) {
      notificarTrazabilidadActualizada({
        notificacionId: notificacionActualizada.id,
        misionId: resultado.mision.id,
        patrullaId: resultado.patrulla.id,
        estado: notificacionActualizada.estado,
        intentosEnvio: notificacionActualizada.intentosEnvio,
        creadaAt: notificacionActualizada.creadaAt,
        enviadaAt: notificacionActualizada.enviadaAt,
        recibidaAt: notificacionActualizada.recibidaAt,
        leidaAt: notificacionActualizada.leidaAt,
        actualizadoEn: new Date().toISOString(),
      });
    }

    notificarIncidenteActualizado({
      id: resultado.incidente.id,
      codigo: resultado.incidente.codigo,
      nuevoEstado: resultado.incidente.estado,
      prioridad: resultado.incidente.prioridad,
      actualizadoEn: new Date().toISOString(),
    });

    notificarPatrullaActualizada({
      patrullaId: resultado.patrulla.id,
      nombre: resultado.patrulla.nombre,
      estado: resultado.patrulla.estado,
      delegacionId: resultado.patrulla.delegacionId,
      usuarioLiderId: resultado.patrulla.usuarioLiderId,
      misionActivaId: resultado.mision.id,
      incidenteId: resultado.incidente.id,
      actualizadoEn: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error al emitir eventos WebSocket tras asignar patrulla:", error);
  }

  return {
    message: "Misión de verificación creada y patrulla despachada exitosamente.",
    data: {
      mision: resultado.mision,
      incidente: {
        id: resultado.incidente.id,
        codigo: resultado.incidente.codigo,
        estado: resultado.incidente.estado,
      },
      patrulla: {
        id: resultado.patrulla.id,
        nombre: resultado.patrulla.nombre,
        estado: resultado.patrulla.estado,
      },
      hitoInicial: resultado.hitoInicial,
      notificacion: notificacionActualizada,
    },
  };
}
/**
 * HU-36 - Servicio de negocio para confirmar y aceptar una misión asignada a una patrulla verificadora.
 *
 * 1. Ejecuta la transición atómica en base de datos (`DESPACHADA` -> `EN_CURSO`, `fecha_inicio = CURRENT_TIMESTAMP`,
 *    registro de hito `'MISION_ACEPTADA'` en `mision_hito`).
 * 2. Mantiene la patrulla en `EN_VERIFICACION` y el incidente en `VERIFICANDO`.
 * 3. Emite en tiempo real el evento WebSocket `mision:actualizada` hacia la sala `encargado` del Centro de Mando.
 */
export async function aceptarMisionService(
  misionId: string,
  usuarioId: string,
  esAdmin = false,
  input?: AceptarMisionInput
): Promise<AceptarMisionResponse> {
  const resultado = await aceptarMisionPatrullaRepo(misionId, usuarioId, esAdmin, input);

  try {
    notificarMisionActualizada({
      misionId: resultado.mision.id,
      codigo: resultado.mision.codigo,
      estado: resultado.mision.estado,
      tipoMision: resultado.mision.tipoMision,
      patrullaId: resultado.mision.patrullaId,
      incidenteId: resultado.mision.incidenteId,
      fechaInicio: resultado.mision.fechaInicio,
      hito: {
        id: resultado.hito.id,
        hito: resultado.hito.hito,
        descripcion: resultado.hito.descripcion,
        registradoPorId: resultado.hito.registradoPorId,
        creadoEn: resultado.hito.creadoEn,
      },
      actualizadoEn: resultado.mision.actualizadoEn,
    });
  } catch (error) {
    console.error("Error al emitir evento WebSocket mision:actualizada:", error);
  }

  return {
    message:
      "Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.",
    data: {
      mision: resultado.mision,
      patrulla: resultado.patrulla,
      incidente: resultado.incidente,
      hito: resultado.hito,
    },
  };
}

/**
 * HU-41 - Servicio de negocio para rechazar una misión asignada a una cuadrilla operativa.
 *
 * 1. Invoca la transacción atómica en repositorio (`mision.estado = 'RECHAZADA'`,
 *    `justificacion_rechazo`, `cuadrilla.estado = 'DISPONIBLE'`, retorno de incidente
 *    a `'VERIFICANDO'` o `'REPORTADO'`, registro del hito `'RECHAZADA'` en `mision_hito`).
 * 2. Emite en tiempo real vía Socket.io / Redis:
 *    - `'mision:rechazada'` hacia la sala `'encargado'` (y `'sala:encargados'`, `'supervisor'`, `'cuadrilla:{id}'`).
 *    - `'incidente:actualizado'` para habilitar la reasignación inmediata en el Kanban.
 *    - `'cuadrilla:actualizada'` para reflejar disponibilidad `'DISPONIBLE'`.
 */
export async function rechazarMisionService(
  misionId: string,
  usuarioId: string,
  esAdmin: boolean,
  input: RechazarMisionInput
): Promise<RechazarMisionResponse> {
  const resultado = await rechazarMisionCuadrillaRepo(
    misionId,
    usuarioId,
    input.justificacionRechazo,
    esAdmin,
    {
      latitud: input.latitud,
      longitud: input.longitud,
    }
  );

  try {
    notificarMisionRechazada({
      misionId: resultado.mision.id,
      codigo: resultado.mision.codigo,
      tipoMision: resultado.mision.tipoMision,
      motivo: resultado.mision.justificacionRechazo,
      justificacionRechazo: resultado.mision.justificacionRechazo,
      cuadrillaId: resultado.cuadrilla.id,
      cuadrillaNombre: resultado.cuadrilla.nombre,
      patrullaId: null,
      patrullaNombre: null,
      incidenteId: resultado.incidente?.id ?? null,
      incidenteCodigo: resultado.incidente?.codigo ?? null,
      rechazadoPorId: usuarioId,
      rechazadoEn: resultado.mision.actualizadoEn,
    });

    if (resultado.incidente) {
      notificarIncidenteActualizado({
        id: resultado.incidente.id,
        codigo: resultado.incidente.codigo,
        nuevoEstado: resultado.incidente.estado,
        prioridad: resultado.incidente.prioridad,
        actualizadoEn: resultado.mision.actualizadoEn,
      });
    }

    emitirCuadrillaActualizada({
      id: resultado.cuadrilla.id,
      nombre: resultado.cuadrilla.nombre,
      estado: resultado.cuadrilla.estado,
      delegacionId: resultado.cuadrilla.delegacionId ?? null,
    });
  } catch (error) {
    console.error("Error al emitir eventos WebSocket tras rechazar misión:", error);
  }

  const estadoIncidente = resultado.incidente?.estado ?? "REPORTADO";

  return {
    message: `Misión rechazada exitosamente. La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a ${estadoIncidente} para su reasignación.`,
    data: {
      mision: resultado.mision,
      cuadrilla: resultado.cuadrilla,
      incidente: resultado.incidente,
      hito: resultado.hito,
    },
  };
}

/**
 * HU-39 - Servicio de negocio para enviar el informe técnico de verificación en terreno
 * y cerrar la misión inicial de patrullaje.
 *
 * 1. Ejecuta la transacción atómica (`reporte_terreno`, `mision = COMPLETADA`,
 *    `patrulla_verificadora = DISPONIBLE`, actualización de `incidente` a `VERIFICANDO` o `NO_ABORDABLE`,
 *    derivación FIBE si corresponde y registro de hito `VERIFICACION_COMPLETADA`).
 * 2. Emite los eventos WebSocket `mision:actualizada`, `incidente:actualizado` y
 *    `patrulla:actualizada` / `patrulla:liberada` hacia la sala `encargado` vía Redis.
 */
export async function enviarReporteVerificacionService(
  misionId: string,
  usuarioId: string,
  esAdmin = false,
  input: CrearReporteVerificacionInput
): Promise<EnviarReporteVerificacionResponse> {
  const resultado = await crearReporteVerificacionYCerrarMisionRepo(
    misionId,
    usuarioId,
    esAdmin,
    input
  );

  // Normalizar URLs de adjuntos (compatibilidad Caddy /uploads/...)
  const adjuntosNormalizados: AdjuntoEvidencia[] =
    resultado.reporteTerreno.adjuntos.map((adj) => {
      let urlNorm = adj.url;
      if (
        !urlNorm.startsWith("http://") &&
        !urlNorm.startsWith("https://") &&
        !urlNorm.startsWith("/")
      ) {
        urlNorm = `/${urlNorm}`;
      }
      return { ...adj, url: urlNorm };
    });

  const reporteTerrenoDto: ReporteTerrenoDetalle = {
    ...resultado.reporteTerreno,
    adjuntos: adjuntosNormalizados,
  };

  try {
    notificarMisionActualizada({
      misionId: resultado.mision.id,
      codigo: resultado.mision.codigo,
      estado: resultado.mision.estado,
      tipoMision: resultado.mision.tipoMision,
      patrullaId: resultado.mision.patrullaId,
      incidenteId: resultado.mision.incidenteId,
      fechaInicio: resultado.mision.fechaInicio,
      fechaCierre: resultado.mision.fechaCierre,
      hito: {
        id: resultado.hito.id,
        hito: resultado.hito.hito,
        descripcion: resultado.hito.descripcion,
        registradoPorId: resultado.hito.registradoPorId,
        creadoEn: resultado.hito.creadoEn,
      },
      reporteTerreno: reporteTerrenoDto as unknown as Record<string, unknown>,
      actualizadoEn: resultado.mision.actualizadoEn,
    });

    if (resultado.incidente) {
      notificarIncidenteActualizado({
        id: resultado.incidente.id,
        codigo: resultado.incidente.codigo,
        nuevoEstado: resultado.incidente.estado,
        prioridad: resultado.incidente.prioridad,
        requiereAsistenciaSocial: resultado.incidente.requiereAsistenciaSocial,
        verificado: true,
        motivoNoAbordable: resultado.incidente.motivoNoAbordable,
        fechaCierre: resultado.incidente.fechaCierre,
        dictamen: reporteTerrenoDto.dictamen ?? null,
        justificacion: resultado.incidente.motivoNoAbordable,
        reporteTerreno: reporteTerrenoDto as unknown as Record<string, unknown>,
        actualizadoEn: resultado.mision.actualizadoEn,
      });
    }

    if (resultado.patrulla && resultado.patrulla.estado === "DISPONIBLE") {
      notificarPatrullaActualizada({
        patrullaId: resultado.patrulla.id,
        nombre: resultado.patrulla.nombre,
        estado: resultado.patrulla.estado,
        delegacionId: resultado.patrulla.delegacionId,
        usuarioLiderId: resultado.patrulla.usuarioLiderId,
        misionActivaId: null,
        incidenteId: null,
        actualizadoEn: resultado.mision.actualizadoEn,
      });

      if (resultado.incidente) {
        notificarPatrullaLiberada({
          patrullaId: resultado.patrulla.id,
          nombre: resultado.patrulla.nombre,
          misionPreviaId: resultado.mision.id,
          incidenteId: resultado.incidente.id,
          estado: "DISPONIBLE",
          liberadaEn: resultado.mision.actualizadoEn,
        });
      }
    }
  } catch (error) {
    console.error(
      "Error no bloqueante al emitir eventos WebSocket tras enviar reporte de verificación:",
      error
    );
  }

  const mensaje =
    reporteTerrenoDto.dictamen === "NO_ABORDABLE"
      ? "Informe técnico registrado, misión cerrada e incidente marcado como NO_ABORDABLE exitosamente."
      : "Informe técnico de verificación registrado y misión cerrada exitosamente.";

  return {
    message: mensaje,
    data: {
      reporteTerreno: reporteTerrenoDto,
      mision: resultado.mision,
      patrulla: resultado.patrulla
        ? {
            id: resultado.patrulla.id,
            nombre: resultado.patrulla.nombre,
            estado: resultado.patrulla.estado,
          }
        : null,
      incidente: resultado.incidente,
      hito: resultado.hito,
    },
  };
}

/**
 * HU-68 - Servicio de negocio para enviar el informe técnico final de resolución de la emergencia
 * y cerrar la misión operativa de cuadrilla.
 *
 * 1. Ejecuta la transacción atómica (`cerrarMisionCuadrillaRepo`): descuenta materiales consumidos,
 *    crea `reporte_terreno` (`REPORTE_CUADRILLA`), actualiza `mision.estado = 'COMPLETADA'`,
 *    transiciona `cuadrilla.estado = 'DISPONIBLE'` (si no posee otra misión activa) y registra
 *    el hito `MISION_COMPLETADA` en `mision_hito`. El incidente permanece abierto hasta H86.
 * 2. Emite eventos WebSocket `mision:actualizada`, `incidente:actualizado` (salas `encargado` y `mapa`),
 *    `cuadrilla:actualizada` y `recurso:actualizado`.
 */
export async function cerrarMisionCuadrillaService(
  misionId: string,
  usuarioId: string,
  esAdmin = false,
  input: CerrarMisionCuadrillaInput
): Promise<CerrarMisionCuadrillaResponse> {
  const resultado = await cerrarMisionCuadrillaRepo(
    misionId,
    usuarioId,
    esAdmin,
    input
  );

  // Normalizar URLs de adjuntos para compatibilidad con Caddy (/uploads/...)
  const adjuntosNormalizados: AdjuntoEvidencia[] =
    resultado.reporteTerreno.adjuntos.map((adj) => {
      let urlNorm = adj.url;
      if (
        !urlNorm.startsWith("http://") &&
        !urlNorm.startsWith("https://") &&
        !urlNorm.startsWith("/")
      ) {
        urlNorm = `/${urlNorm}`;
      }
      return { ...adj, url: urlNorm };
    });

  const reporteTerrenoDto: ReporteTerrenoDetalle = {
    ...resultado.reporteTerreno,
    adjuntos: adjuntosNormalizados,
  };

  try {
    notificarMisionActualizada({
      misionId: resultado.mision.id,
      codigo: resultado.mision.codigo,
      estado: resultado.mision.estado,
      tipoMision: resultado.mision.tipoMision,
      cuadrillaId: resultado.mision.cuadrillaId,
      incidenteId: resultado.mision.incidenteId,
      fechaInicio: resultado.mision.fechaInicio,
      fechaCierre: resultado.mision.fechaCierre,
      hito: {
        id: resultado.hito.id,
        hito: resultado.hito.hito,
        descripcion: resultado.hito.descripcion,
        registradoPorId: resultado.hito.registradoPorId,
        creadoEn: resultado.hito.creadoEn,
      },
      reporteTerreno: reporteTerrenoDto as unknown as Record<string, unknown>,
      actualizadoEn: resultado.mision.actualizadoEn,
    });

    if (resultado.incidente) {
      notificarIncidenteActualizado({
        id: resultado.incidente.id,
        codigo: resultado.incidente.codigo,
        nuevoEstado: resultado.incidente.estado,
        prioridad: resultado.incidente.prioridad,
        requiereAsistenciaSocial: resultado.incidente.requiereAsistenciaSocial,
        reporteTerreno: reporteTerrenoDto as unknown as Record<string, unknown>,
        actualizadoEn: resultado.mision.actualizadoEn,
      });
    }

    if (resultado.cuadrilla.estado === "DISPONIBLE") {
      emitirCuadrillaActualizada({
        id: resultado.cuadrilla.id,
        nombre: resultado.cuadrilla.nombre,
        estado: resultado.cuadrilla.estado,
        delegacionId: resultado.cuadrilla.delegacionId,
      });
    }

    for (const rec of resultado.recursosActualizados) {
      emitirRecursoActualizado({
        id: rec.id,
        nombre: rec.nombre,
        cantidadInventario: rec.cantidadInventarioActual,
        cantidadEnUso: rec.cantidadEnUsoActual,
        estado: rec.estado,
        actualizadoEn: resultado.mision.actualizadoEn,
      });
    }
  } catch (error) {
    console.error(
      "Error no bloqueante al emitir eventos WebSocket tras cerrar misión de cuadrilla:",
      error
    );
  }

  const mensaje =
    resultado.cuadrilla.estado === "DISPONIBLE"
      ? "Informe técnico final registrado, misión cerrada y cuadrilla disponible exitosamente."
      : "Informe técnico final registrado y misión cerrada exitosamente. La cuadrilla mantiene misiones activas pendientes.";

  return {
    message: mensaje,
    data: {
      reporteTerreno: reporteTerrenoDto,
      mision: resultado.mision,
      cuadrilla: {
        id: resultado.cuadrilla.id,
        nombre: resultado.cuadrilla.nombre,
        estado: resultado.cuadrilla.estado,
        delegacionId: resultado.cuadrilla.delegacionId,
      },
      incidente: resultado.incidente,
      recursosActualizados: resultado.recursosActualizados,
      hito: resultado.hito,
    },
  };
}
