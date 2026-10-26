import { db } from "@/lib/db";
import { sql } from "kysely";
import type { ListarPersonalQuery } from "./personal-listado.schema";

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
    .selectFrom("usuarios")
    .leftJoin("roles", "roles.id", "usuarios.rol_id")
    .leftJoin("delegaciones", "delegaciones.id", "usuarios.delegacion_id")
    .leftJoin("personal", "personal.usuario_id", "usuarios.id");

  const estado = filtros.estado?.toLowerCase();
  const incluirInactivos =
    filtros.incluirInactivos ??
    filtros.incluir_inactivos ??
    (estado === "todos" || estado === "inactivo");

  if (estado === "inactivo") {
    query = query.where("usuarios.activo", "=", false);
  } else if (!incluirInactivos) {
    query = query.where("usuarios.activo", "=", true);
  }

  if (soloPersonal) {
    query = query.where("personal.id", "is not", null);
  }

  if (delegacionId) {
    query = query.where("usuarios.delegacion_id", "=", delegacionId);
  }

  if (rolId) {
    query = query.where("usuarios.rol_id", "=", rolId);
  }

  const rolCodigo = (filtros.rolCodigo ?? filtros.rol_codigo)?.trim();
  if (rolCodigo && rolCodigo !== "") {
    query = query.where("roles.codigo", "=", rolCodigo.toUpperCase());
  }

  if (estadoOperativo) {
    query = query.where("personal.estado_operativo", "=", estadoOperativo);
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
      sql<number>`COALESCE((
        SELECT count(*)::int
        FROM evento_asistencia_social
        WHERE evento_asistencia_social.asistente_social_id = usuarios.id
          AND evento_asistencia_social.estado IN ('ASIGNADO', 'EN_EVALUACION_FIBE')
          AND evento_asistencia_social.eliminado_en IS NULL
      ), 0)`.as("casos_fibe_asignados"),
    ])
    .limit(limit)
    .offset(offset)
    .execute();

  return { filas, total };
}

export type FilaPersonalPaginada = Awaited<
  ReturnType<typeof listarPersonalPaginadoRepo>
>["filas"][number];
