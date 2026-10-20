import { db } from "@/lib/db";
import { sql } from "kysely";
import type { ListarPersonalQuery } from "./personal-listado.schema";

/**
 * Repositorio del listado de personal (H11).
 *
 * La disponibilidad (estado operativo) reside en `usuario.estado_operativo`, por lo que
 * el filtro se aplica sobre la tabla canónica `usuario`. `personal` se une para exponer
 * la ficha opcional de terreno (cargo, especialidad, disponible_terreno).
 */
export async function listarPersonalPaginadoRepo(filtros: ListarPersonalQuery) {
  const delegacionId = filtros.delegacionId ?? filtros.delegacion_id;
  const rolId = filtros.rolId ?? filtros.rol_id;
  const estadoOperativo = filtros.estadoOperativo ?? filtros.estado_operativo;
  const soloPersonal = filtros.soloPersonal ?? filtros.solo_personal;
  const busqueda = (filtros.busqueda ?? filtros.q)?.trim();
  const ordenarPor = filtros.ordenar_por ?? filtros.ordenarPor ?? "apellidos";
  const orden = filtros.orden ?? "asc";
  const page = filtros.page || filtros.pagina || 1;
  const limit = filtros.limit || filtros.limite || 20;
  const offset = (page - 1) * limit;

  let query = db
    .selectFrom("usuario")
    .leftJoin("rol", "rol.id", "usuario.rol_id")
    .leftJoin("delegacion", "delegacion.id", "usuario.delegacion_id")
    .leftJoin("personal", "personal.usuario_id", "usuario.id");

  const estado = filtros.estado?.toLowerCase();
  const incluirInactivos =
    filtros.incluirInactivos ??
    filtros.incluir_inactivos ??
    (estado === "todos" || estado === "inactivo");

  if (estado === "inactivo") {
    query = query.where("usuario.activo", "=", false);
  } else if (!incluirInactivos) {
    query = query.where("usuario.activo", "=", true);
  }

  // `soloPersonal` conserva su semántica original: usuarios que poseen ficha de terreno
  if (soloPersonal) {
    query = query.where("personal.id", "is not", null);
  }

  if (delegacionId) {
    query = query.where("usuario.delegacion_id", "=", delegacionId);
  }

  if (rolId) {
    query = query.where("usuario.rol_id", "=", rolId);
  }

  if (estadoOperativo) {
    query = query.where("usuario.estado_operativo", "=", estadoOperativo);
  }

  if (filtros.cargo && filtros.cargo.trim() !== "") {
    query = query.where("personal.cargo", "ilike", `%${filtros.cargo.trim()}%`);
  }

  if (filtros.especialidad && filtros.especialidad.trim() !== "") {
    query = query.where("personal.especialidad", "ilike", `%${filtros.especialidad.trim()}%`);
  }

  if (busqueda && busqueda !== "") {
    const term = `%${busqueda}%`;
    query = query.where((eb) =>
      eb.or([
        eb("usuario.rut", "ilike", term),
        eb("usuario.nombres", "ilike", term),
        eb("usuario.apellidos", "ilike", term),
        eb("usuario.email", "ilike", term),
      ])
    );
  }

  // Conteo total para metadatos de paginación
  const countResult = await query
    .select(sql<number>`count(usuario.id)::int`.as("total"))
    .executeTakeFirst();
  const total = Number(countResult?.total ?? 0);

  // Ordenamiento
  if (ordenarPor === "rut") {
    query = query.orderBy("usuario.rut", orden);
  } else if (ordenarPor === "nombres") {
    query = query.orderBy("usuario.nombres", orden).orderBy("usuario.apellidos", orden);
  } else {
    query = query.orderBy("usuario.apellidos", orden).orderBy("usuario.nombres", orden);
  }

  // Filas paginadas
  const filas = await query
    .select([
      "usuario.id as usuario_id",
      "usuario.rut",
      "usuario.nombres",
      "usuario.apellidos",
      "usuario.email",
      "usuario.telefono",
      "usuario.activo as usuario_activo",
      "usuario.estado_operativo",
      "usuario.fecha_ingreso",
      "usuario.fecha_salida",
      "rol.id as rol_id",
      "rol.codigo as rol_codigo",
      "rol.nombre as rol_nombre",
      "delegacion.id as delegacion_id",
      "delegacion.codigo as delegacion_codigo",
      "delegacion.nombre as delegacion_nombre",
      "personal.id as personal_id",
      "personal.especialidad",
      "personal.cargo",
      "personal.disponible_terreno",
      "personal.observaciones",
      "personal.updated_at as personal_updated_at",
    ])
    .limit(limit)
    .offset(offset)
    .execute();

  return { filas, total };
}

export type FilaPersonalPaginada = Awaited<
  ReturnType<typeof listarPersonalPaginadoRepo>
>["filas"][number];
