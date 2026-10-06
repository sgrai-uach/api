import { db } from "@/lib/db";
import { sql } from "kysely";
import type { ListarIncidentesQuery } from "./incidente-kanban.schema";

export interface FilaIncidenteResumen {
  id: string;
  codigo: string;
  codigo_seguimiento: string;
  tipo_afectacion: string;
  descripcion: string | null;
  direccion_texto: string;
  latitud: number | string;
  longitud: number | string;
  estado: string;
  prioridad: string;
  requiere_asistencia_social: boolean;
  fuente_origen: string;
  informante_nombre: string | null;
  delegacion_nombre: string | null;
  total_misiones: number | string;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

/**
 * Consulta la lista paginada de incidentes con filtros opcionales para el tablero Kanban.
 */
export async function listarIncidentesPaginadosRepo(filtros: ListarIncidentesQuery) {
  let consultaBase = db
    .selectFrom("incidente")
    .leftJoin("informante", "informante.id", "incidente.informante_id")
    .leftJoin("delegacion", "delegacion.id", "incidente.delegacion_id");

  // Filtro por Estado (case-insensitive para tolerar variantes históricas)
  if (filtros.estado) {
    consultaBase = consultaBase.where(
      sql`upper(incidente.estado)`,
      "=",
      filtros.estado.toUpperCase()
    );
  }

  // Filtro por Prioridad
  if (filtros.prioridad) {
    consultaBase = consultaBase.where("incidente.prioridad", "=", filtros.prioridad);
  }

  // Filtro por Tipo de Afectación
  if (filtros.tipoAfectacion && filtros.tipoAfectacion.trim() !== "") {
    consultaBase = consultaBase.where(
      "incidente.tipo_afectacion",
      "=",
      filtros.tipoAfectacion.trim()
    );
  }

  // Filtro por Búsqueda de Texto
  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    consultaBase = consultaBase.where((eb) =>
      eb.or([
        eb("incidente.codigo", "ilike", patron),
        eb("incidente.codigo_seguimiento", "ilike", patron),
        eb("incidente.direccion_texto", "ilike", patron),
        eb("incidente.descripcion", "ilike", patron),
      ])
    );
  }

  // Filtro por Delegación Territorial
  if (filtros.delegacionId) {
    consultaBase = consultaBase.where("incidente.delegacion_id", "=", filtros.delegacionId);
  }

  // Filtro por Fuente de Origen
  if (filtros.fuenteOrigen) {
    consultaBase = consultaBase.where("incidente.fuente_origen", "=", filtros.fuenteOrigen);
  }

  // Filtro Temporal por Fecha o soloHoy (Zona horaria Chile)
  if (filtros.fecha) {
    consultaBase = consultaBase
      .where(
        "incidente.creado_en",
        ">=",
        sql<Date>`(${sql.val(filtros.fecha)}::date AT TIME ZONE 'America/Santiago')`
      )
      .where(
        "incidente.creado_en",
        "<",
        sql<Date>`((${sql.val(filtros.fecha)}::date + INTERVAL '1 day') AT TIME ZONE 'America/Santiago')`
      );
  } else if (filtros.soloHoy) {
    consultaBase = consultaBase
      .where(
        "incidente.creado_en",
        ">=",
        sql<Date>`(CURRENT_DATE AT TIME ZONE 'America/Santiago')`
      )
      .where(
        "incidente.creado_en",
        "<",
        sql<Date>`((CURRENT_DATE + INTERVAL '1 day') AT TIME ZONE 'America/Santiago')`
      );
  }

  // Conteo total para metadatos de paginación
  const resultadoConteo = await consultaBase
    .select(sql<number>`count(incidente.id)::int`.as("total"))
    .executeTakeFirst();

  const total = Number(resultadoConteo?.total ?? 0);

  // Obtener filas paginadas
  const filas = await consultaBase
    .select([
      "incidente.id",
      "incidente.codigo",
      "incidente.codigo_seguimiento",
      "incidente.tipo_afectacion",
      "incidente.descripcion",
      "incidente.direccion_texto",
      "incidente.latitud",
      "incidente.longitud",
      "incidente.estado",
      "incidente.prioridad",
      "incidente.requiere_asistencia_social",
      "incidente.fuente_origen",
      "informante.nombre as informante_nombre",
      "delegacion.nombre as delegacion_nombre",
      "incidente.creado_en",
      "incidente.actualizado_en",
      (eb) =>
        eb
          .selectFrom("mision")
          .select(sql<number>`count(mision.id)::int`.as("count"))
          .whereRef("mision.incidente_id", "=", "incidente.id")
          .as("total_misiones"),
    ])
    .orderBy("incidente.creado_en", "desc")
    .limit(filtros.limit)
    .offset((filtros.page - 1) * filtros.limit)
    .execute();

  return {
    filas: filas as unknown as FilaIncidenteResumen[],
    total,
  };
}

/**
 * Consulta los datos detallados de un incidente junto a sus misiones y recursos asociados.
 */
export async function obtenerIncidenteDetallePorIdRepo(id: string) {
  const incidente = await db
    .selectFrom("incidente")
    .leftJoin("informante", "informante.id", "incidente.informante_id")
    .leftJoin("delegacion", "delegacion.id", "incidente.delegacion_id")
    .leftJoin("usuario as creador", "creador.id", "incidente.creado_por_id")
    .leftJoin("usuario as encargado", "encargado.id", "incidente.encargado_id")
    .select([
      "incidente.id",
      "incidente.codigo",
      "incidente.codigo_seguimiento",
      "incidente.tipo_afectacion",
      "incidente.descripcion",
      "incidente.direccion_texto",
      "incidente.latitud",
      "incidente.longitud",
      "incidente.estado",
      "incidente.prioridad",
      "incidente.requiere_asistencia_social",
      "incidente.fuente_origen",
      "incidente.asterisk_call_id",
      "incidente.asterisk_caller_phone",
      "incidente.creado_en",
      "incidente.actualizado_en",
      "informante.id as informante_id",
      "informante.rut as informante_rut",
      "informante.nombre as informante_nombre",
      "informante.telefono as informante_telefono",
      "delegacion.id as delegacion_id",
      "delegacion.nombre as delegacion_nombre",
      "delegacion.descripcion as delegacion_descripcion",
      "creador.id as creador_id",
      "creador.nombre as creador_nombre",
      "creador.email as creador_email",
      "encargado.id as encargado_id",
      "encargado.nombre as encargado_nombre",
      "encargado.email as encargado_email",
    ])
    .where("incidente.id", "=", id)
    .executeTakeFirst();

  if (!incidente) {
    return null;
  }

  // Consultar misiones asignadas a este incidente
  const misiones = await db
    .selectFrom("mision")
    .leftJoin("patrulla_verificadora", "patrulla_verificadora.id", "mision.patrulla_id")
    .leftJoin("cuadrilla", "cuadrilla.id", "mision.cuadrilla_id")
    .select([
      "mision.id",
      "mision.codigo",
      "mision.titulo",
      "mision.descripcion",
      "mision.tipo_mision",
      "mision.estado",
      "mision.prioridad",
      "mision.justificacion_rechazo",
      "mision.fecha_inicio",
      "mision.fecha_cierre",
      "mision.creado_en",
      "patrulla_verificadora.id as patrulla_id",
      "patrulla_verificadora.nombre as patrulla_nombre",
      "patrulla_verificadora.estado as patrulla_estado",
      "cuadrilla.id as cuadrilla_id",
      "cuadrilla.nombre as cuadrilla_nombre",
      "cuadrilla.estado as cuadrilla_estado",
    ])
    .where("mision.incidente_id", "=", id)
    .orderBy("mision.creado_en", "asc")
    .execute();

  // Consultar recursos asignados a las cuadrillas de dichas misiones
  const cuadrillaIds = misiones
    .map((m) => m.cuadrilla_id)
    .filter((cId): cId is string => Boolean(cId));

  let recursosAsociados: Array<{
    recursoId: string;
    nombre: string;
    esIndividual: boolean;
    cantidadAsignadaTotal: number;
    estadoRecurso: string;
    cuadrillaNombre: string | null;
  }> = [];

  if (cuadrillaIds.length > 0) {
    const filasRecursos = await db
      .selectFrom("cuadrilla_recurso")
      .innerJoin("recurso", "recurso.id", "cuadrilla_recurso.recurso_id")
      .leftJoin("cuadrilla", "cuadrilla.id", "cuadrilla_recurso.cuadrilla_id")
      .select([
        "recurso.id as recurso_id",
        "recurso.nombre as recurso_nombre",
        "recurso.es_individual",
        "recurso.estado as recurso_estado",
        "cuadrilla_recurso.cantidad_asignada",
        "cuadrilla.nombre as cuadrilla_nombre",
      ])
      .where("cuadrilla_recurso.cuadrilla_id", "in", cuadrillaIds)
      .execute();

    recursosAsociados = filasRecursos.map((r) => ({
      recursoId: r.recurso_id,
      nombre: r.recurso_nombre,
      esIndividual: Boolean(r.es_individual),
      cantidadAsignadaTotal: Number(r.cantidad_asignada),
      estadoRecurso: r.recurso_estado,
      cuadrillaNombre: r.cuadrilla_nombre ?? null,
    }));
  }

  return {
    incidente,
    misiones,
    recursosAsociados,
  };
}
