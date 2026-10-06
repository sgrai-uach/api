import { buildPaginationMeta } from "@/lib/shared/pagination.schema";
import { listarPersonalPaginadoRepo } from "./personal-listado.repository";
import type {
  ListarPersonalQuery,
  ListarPersonalResponse,
  PersonalItem,
} from "./personal-listado.schema";

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
    es_personal: e.personal_id !== null,
  }));

  return {
    data,
    meta,
  };
}
