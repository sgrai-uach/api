import { db } from "@/lib/db";
import { sql } from "kysely";
import type { ListarMisionesQuery } from "./mision-listado.schema";

export interface FilaMisionListado {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  tipo_mision: string;
  estado: string;
  prioridad: string;
  justificacion_rechazo: string | null;
  incidente_id: string | null;
  incidente_codigo: string | null;
  cuadrilla_id: string | null;
  cuadrilla_nombre: string | null;
  patrulla_id: string | null;
  patrulla_nombre: string | null;
  delegacion_id: string | null;
  delegacion_nombre: string | null;
  fecha_inicio: Date | string | null;
  fecha_cierre: Date | string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

export async function listarMisionesPaginadoRepo(filtros: ListarMisionesQuery) {
  const page = filtros.page || 1;
  const limit = filtros.limit || 20;
  const offset = (page - 1) * limit;
  const orden = filtros.orden ?? "desc";

  let baseQuery = db
    .selectFrom("mision")
    .leftJoin("incidente", "incidente.id", "mision.incidente_id")
    .leftJoin("cuadrilla", "cuadrilla.id", "mision.cuadrilla_id")
    .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
    .leftJoin("delegacion", (join) =>
      join.on(
        "delegacion.id",
        "=",
        sql`COALESCE(incidente.delegacion_id, cuadrilla.delegacion_id, patrulla_verificadora.delegacion_id)`
      )
    );

  // Filtros
  if (filtros.estado) {
    baseQuery = baseQuery.where("mision.estado", "=", filtros.estado);
  }

  if (filtros.tipoMision) {
    baseQuery = baseQuery.where("mision.tipo_mision", "=", filtros.tipoMision);
  }

  if (filtros.prioridad) {
    baseQuery = baseQuery.where("mision.prioridad", "=", filtros.prioridad);
  }

  if (filtros.delegacionId) {
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb("incidente.delegacion_id", "=", filtros.delegacionId!),
        eb("cuadrilla.delegacion_id", "=", filtros.delegacionId!),
        eb("patrulla_verificadora.delegacion_id", "=", filtros.delegacionId!),
      ])
    );
  }

  if (filtros.incidenteId) {
    baseQuery = baseQuery.where("mision.incidente_id", "=", filtros.incidenteId);
  }

  if (filtros.cuadrillaId) {
    baseQuery = baseQuery.where("mision.cuadrilla_id", "=", filtros.cuadrillaId);
  }

  if (filtros.patrullaId) {
    baseQuery = baseQuery.where("mision.patrulla_id", "=", filtros.patrullaId);
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb("mision.codigo", "ilike", patron),
        eb("mision.titulo", "ilike", patron),
        eb("mision.descripcion", "ilike", patron),
      ])
    );
  }

  // Conteo total para paginación
  const countResult = await baseQuery
    .select(sql<number>`count(mision.id)::int`.as("total"))
    .executeTakeFirst();
  const total = Number(countResult?.total ?? 0);

  // Ordenamiento
  if (filtros.ordenarPor === "codigo") {
    baseQuery = baseQuery.orderBy("mision.codigo", orden);
  } else if (filtros.ordenarPor === "prioridad") {
    baseQuery = baseQuery.orderBy("mision.prioridad", orden);
  } else {
    baseQuery = baseQuery.orderBy("mision.creado_en", orden);
  }

  // Filas paginadas
  const filas = await baseQuery
    .select([
      "mision.id",
      "mision.codigo",
      "mision.titulo",
      "mision.descripcion",
      "mision.tipo_mision",
      "mision.estado",
      "mision.prioridad",
      "mision.justificacion_rechazo",
      "mision.incidente_id",
      "incidente.codigo as incidente_codigo",
      "mision.cuadrilla_id",
      "cuadrilla.nombre as cuadrilla_nombre",
      "mision.patrulla_id",
      "patrulla_verificadora.nombre as patrulla_nombre",
      sql<string | null>`COALESCE(incidente.delegacion_id, cuadrilla.delegacion_id, patrulla_verificadora.delegacion_id)`.as("delegacion_id"),
      "delegacion.nombre as delegacion_nombre",
      "mision.fecha_inicio",
      "mision.fecha_cierre",
      "mision.creado_en",
      "mision.actualizado_en",
    ])
    .limit(limit)
    .offset(offset)
    .execute();

  return {
    filas: filas as unknown as FilaMisionListado[],
    total,
  };
}
