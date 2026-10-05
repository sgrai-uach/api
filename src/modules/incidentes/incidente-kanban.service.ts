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
    requiereAsistenciaSocial: Boolean(fila.requiere_asistencia_social),
    fuenteOrigen: fila.fuente_origen,
    informanteNombre: fila.informante_nombre,
    delegacionNombre: fila.delegacion_nombre,
    totalMisiones: Number(fila.total_misiones ?? 0),
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

  const { incidente, misiones, recursosAsociados } = resultado;

  const misionesMapeadas: MisionDetalle[] = misiones.map((m) => ({
    id: m.id,
    codigo: m.codigo,
    titulo: m.titulo,
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
