import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import { listarMisionesPaginadoRepo } from "./mision-listado.repository";
import type {
  ListarMisionesQuery,
  ListarMisionesResponse,
  MisionItem,
} from "./mision-listado.schema";

export async function listarMisionesService(
  filtros: ListarMisionesQuery
): Promise<ListarMisionesResponse> {
  const { filas, total } = await listarMisionesPaginadoRepo(filtros);
  const meta = buildPaginationMeta(total, filtros.page, filtros.limit);

  const data: MisionItem[] = filas.map((fila) => ({
    id: fila.id,
    codigo: fila.codigo,
    titulo: fila.titulo,
    descripcion: fila.descripcion,
    tipoMision: fila.tipo_mision as MisionItem["tipoMision"],
    estado: fila.estado as MisionItem["estado"],
    prioridad: fila.prioridad as MisionItem["prioridad"],
    justificacionRechazo: fila.justificacion_rechazo,
    incidenteId: fila.incidente_id,
    incidenteCodigo: fila.incidente_codigo,
    cuadrillaId: fila.cuadrilla_id,
    cuadrillaNombre: fila.cuadrilla_nombre,
    patrullaId: fila.patrulla_id,
    patrullaNombre: fila.patrulla_nombre,
    delegacionId: fila.delegacion_id,
    delegacionNombre: fila.delegacion_nombre,
    fechaInicio: fila.fecha_inicio
      ? new Date(fila.fecha_inicio).toISOString()
      : null,
    fechaCierre: fila.fecha_cierre
      ? new Date(fila.fecha_cierre).toISOString()
      : null,
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
    message: "Listado de misiones obtenido exitosamente",
    data,
    meta,
  };
}
