import { obtenerMisionDetallePorIdRepo } from "./mision.repository";
import type {
  MisionDetalleCompleto,
  MisionBitacoraHito,
  ReporteTerrenoDetalle,
  AdjuntoEvidencia,
} from "./mision.schema";

function formatearFechaIso(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  return typeof fecha === "string" ? new Date(fecha).toISOString() : fecha.toISOString();
}

function desglosarHitoTiempo(
  fecha: Date | string,
  hito: string,
  descripcion: string
): MisionBitacoraHito {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  const iso = d.toISOString();
  const [fechaStr, resto] = iso.split("T");
  const horaStr = resto.split(".")[0];

  return {
    hito,
    fecha: fechaStr,
    hora: horaStr,
    timestamp: iso,
    descripcion,
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

  const { mision, recursosCuadrilla, reportesTerreno: reportesRaw } = resultado;

  // 1. Bitácora de tiempos simplificada (Opción 1 - hitos basados en timestamps de misión)
  const bitacoraTiempos: MisionBitacoraHito[] = [];

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
    bitacoraTiempos.push(
      desglosarHitoTiempo(
        mision.actualizado_en,
        "ACTUALIZACION_ESTADO",
        `Última actualización de estado registrada (${mision.estado})`
      )
    );
  }

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

    return {
      id: rep.id,
      misionId: rep.mision_id,
      resumenTecnico: rep.resumen_tecnico,
      accionesRealizadas: rep.acciones_realizadas ?? null,
      requiereApoyoAdicional: Boolean(rep.requiere_apoyo_adicional),
      danosEstimados: rep.danos_estimados ?? null,
      observaciones: rep.observaciones ?? null,
      personasAfectadas: Number(rep.personas_afectadas ?? 0),
      estadoTerreno: rep.estado_terreno || "FINALIZADO",
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
        requiereAsistenciaSocial: Boolean(mision.incidente_requiere_asistencia_social),
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

  return {
    id: mision.id,
    codigo: mision.codigo,
    titulo: mision.titulo,
    descripcion: mision.descripcion,
    tipoMision: mision.tipo_mision as MisionDetalleCompleto["tipoMision"],
    estado: mision.estado as MisionDetalleCompleto["estado"],
    prioridad: mision.prioridad as MisionDetalleCompleto["prioridad"],
    justificacionRechazo: mision.justificacion_rechazo,
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
  };
}
