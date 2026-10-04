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
  const meta = buildPaginationMeta(total, filtros.page, filtros.limit);

  const data: PersonalItem[] = filas.map((e) => ({
    ...e,
    es_personal: e.personal_id !== null,
  }));

  return {
    data,
    meta,
  };
}
