import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import { listarPersonalPaginadoRepo } from "./personal-listado.repository";
import type {
  ListarPersonalQuery,
  ListarPersonalResponse,
  PersonalItem,
} from "./personal-listado.schema";
import type { EstadoOperativo } from "@/lib/db/types";

const ESTADO_OPERATIVO_POR_DEFECTO: EstadoOperativo = "disponible";

/**
 * Servicio de listado de personal (H11).
 *
 * Garantiza que `estado_operativo` nunca sea nulo (la disponibilidad reside en
 * `usuario.estado_operativo`) y que `disponible_terreno` conserve `null` para
 * los usuarios que no poseen ficha de terreno (no aplica).
 */
export async function listarPersonalService(
  filtros: ListarPersonalQuery
): Promise<ListarPersonalResponse> {
  const { filas, total } = await listarPersonalPaginadoRepo(filtros);
  const page = filtros.page || filtros.pagina || 1;
  const limit = filtros.limit || filtros.limite || 20;
  const meta = buildPaginationMeta(total, page, limit);

  const data: PersonalItem[] = filas.map((e) => ({
    ...e,
    nombres: e.nombres ?? "",
    apellidos: e.apellidos ?? "",
    telefono: e.telefono ?? null,
    rol_codigo: e.rol_codigo ?? null,
    rol_nombre: e.rol_nombre ?? null,
    delegacion_codigo: e.delegacion_codigo ?? null,
    delegacion_nombre: e.delegacion_nombre ?? null,
    observaciones: e.observaciones ?? null,
    // La disponibilidad siempre está presente en `usuario.estado_operativo`
    estado_operativo: (e.estado_operativo ??
      ESTADO_OPERATIVO_POR_DEFECTO) as EstadoOperativo,
    // `null` significa "no es personal de terreno / no aplica"
    disponible_terreno: e.personal_id ? (e.disponible_terreno ?? null) : null,
    es_personal: e.personal_id !== null,
  }));

  return {
    data,
    meta,
  };
}
