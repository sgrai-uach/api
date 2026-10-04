import { db } from "@/lib/db";
import { sql } from "kysely";
import type { ListarPersonalQuery } from "./personal-listado.schema";

export async function listarPersonalPaginadoRepo(filtros: ListarPersonalQuery) {
  const delegacionId = filtros.delegacionId ?? filtros.delegacion_id;
  const rolId = filtros.rolId ?? filtros.rol_id;
  const soloPersonal = filtros.soloPersonal ?? filtros.solo_personal;
  const busqueda = (filtros.busqueda ?? filtros.q)?.trim();
  const ordenarPor = filtros.ordenar_por ?? filtros.ordenarPor ?? "apellidos";
  const orden = filtros.orden ?? "asc";
  const page = filtros.page || 1;
  const limit = filtros.limit || 20;
  const offset = (page - 1) * limit;

  let query = db
    .selectFrom("usuarios")
    .leftJoin("roles", "roles.id", "usuarios.rol_id")
    .leftJoin("delegaciones", "delegaciones.id", "usuarios.delegacion_id")
    .leftJoin("personal", "personal.usuario_id", "usuarios.id");

  if (soloPersonal) {
    query = query.where("personal.id", "is not", null);
  }

  if (delegacionId) {
    query = query.where("usuarios.delegacion_id", "=", delegacionId);
  }

  if (rolId) {
    query = query.where("usuarios.rol_id", "=", rolId);
  }

  if (busqueda && busqueda !== "") {
    const term = `%${busqueda}%`;
    query = query.where((eb) =>
      eb.or([
        eb("usuarios.rut", "ilike", term),
        eb("usuarios.nombres", "ilike", term),
        eb("usuarios.apellidos", "ilike", term),
        eb("usuarios.email", "ilike", term),
      ])
    );
  }

  // Conteo total para metadatos de paginación
  const countResult = await query
    .select(sql<number>`count(usuarios.id)::int`.as("total"))
    .executeTakeFirst();
  const total = Number(countResult?.total ?? 0);

  // Ordenamiento
  if (ordenarPor === "rut") {
    query = query.orderBy("usuarios.rut", orden);
  } else if (ordenarPor === "nombres") {
    query = query.orderBy("usuarios.nombres", orden).orderBy("usuarios.apellidos", orden);
  } else {
    query = query.orderBy("usuarios.apellidos", orden).orderBy("usuarios.nombres", orden);
  }

  // Filas paginadas
  const filas = await query
    .select([
      "usuarios.id as usuario_id",
      "usuarios.rut",
      "usuarios.nombres",
      "usuarios.apellidos",
      "usuarios.email",
      "usuarios.telefono",
      "usuarios.activo as usuario_activo",
      "usuarios.fecha_ingreso",
      "usuarios.fecha_salida",
      "roles.id as rol_id",
      "roles.codigo as rol_codigo",
      "roles.nombre as rol_nombre",
      "delegaciones.id as delegacion_id",
      "delegaciones.codigo as delegacion_codigo",
      "delegaciones.nombre as delegacion_nombre",
      "personal.id as personal_id",
      "personal.especialidad",
      "personal.cargo",
      "personal.estado_operativo",
      "personal.disponible_terreno",
      "personal.observaciones",
      "personal.updated_at as personal_updated_at",
    ])
    .limit(limit)
    .offset(offset)
    .execute();

  return { filas, total };
}
