import { db } from "@/lib/db";
import { sql } from "kysely";
import type { EstadoRecurso } from "./recurso.schema";

export interface DatosInsertarRecurso {
  nombre: string;
  es_individual: boolean;
  estado: EstadoRecurso;
  cantidad_inventario: number;
  cantidad_en_uso: number;
  cantidad_minima: number;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  detalles: Record<string, unknown>;
  delegacion_id?: string | null;
  creado_por_id: string;
}

export interface FiltrosListarRecursos {
  delegacionId?: string;
  estado?: EstadoRecurso;
  esIndividual?: boolean;
  busqueda?: string;
}

export interface OpcionesPaginacion {
  pagina: number;
  limite: number;
}

export async function insertarRecurso(datos: DatosInsertarRecurso) {
  const fila = await db
    .insertInto("recurso")
    .values({
      nombre: datos.nombre,
      es_individual: datos.es_individual,
      estado: datos.estado,
      cantidad_inventario: datos.cantidad_inventario,
      cantidad_en_uso: datos.cantidad_en_uso,
      cantidad_minima: datos.cantidad_minima,
      latitud: datos.latitud,
      longitud: datos.longitud,
      ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
      descripcion: datos.descripcion,
      detalles: datos.detalles,
      delegacion_id: datos.delegacion_id ?? null,
      creado_por_id: datos.creado_por_id,
    })
    .returning([
      "id",
      "nombre",
      "es_individual",
      "estado",
      "cantidad_inventario",
      "cantidad_en_uso",
      "cantidad_minima",
      "latitud",
      "longitud",
      "descripcion",
      "detalles",
      "delegacion_id",
      "creado_por_id",
      "creado_en",
      "actualizado_en",
    ])
    .executeTakeFirstOrThrow();

  return fila;
}

export async function listarRecursosPaginados(
  filtros: FiltrosListarRecursos,
  paginacion: OpcionesPaginacion
) {
  const { pagina, limite } = paginacion;
  const offset = (pagina - 1) * limite;

  let query = db
    .selectFrom("recurso")
    .leftJoin("delegacion", "delegacion.id", "recurso.delegacion_id")
    .select([
      "recurso.id",
      "recurso.nombre",
      "recurso.es_individual",
      "recurso.estado",
      "recurso.cantidad_inventario",
      "recurso.cantidad_en_uso",
      "recurso.cantidad_minima",
      "recurso.latitud",
      "recurso.longitud",
      "recurso.descripcion",
      "recurso.detalles",
      "recurso.creado_por_id",
      "recurso.creado_en",
      "recurso.actualizado_en",
      "delegacion.id as delegacion_id",
      "delegacion.codigo_delegacion as delegacion_codigo",
      "delegacion.nombre_delegacion as delegacion_nombre",
    ]);

  if (filtros.delegacionId) {
    query = query.where("recurso.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.estado) {
    query = query.where("recurso.estado", "=", filtros.estado);
  }

  if (filtros.esIndividual !== undefined) {
    query = query.where("recurso.es_individual", "=", filtros.esIndividual);
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    query = query.where((eb) =>
      eb.or([
        eb("recurso.nombre", "ilike", patron),
        eb("recurso.descripcion", "ilike", patron),
      ])
    );
  }

  return await query
    .orderBy("recurso.creado_en", "desc")
    .limit(limite)
    .offset(offset)
    .execute();
}

export async function contarRecursos(filtros: FiltrosListarRecursos): Promise<number> {
  let query = db.selectFrom("recurso");

  if (filtros.delegacionId) {
    query = query.where("recurso.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.estado) {
    query = query.where("recurso.estado", "=", filtros.estado);
  }

  if (filtros.esIndividual !== undefined) {
    query = query.where("recurso.es_individual", "=", filtros.esIndividual);
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    query = query.where((eb) =>
      eb.or([
        eb("recurso.nombre", "ilike", patron),
        eb("recurso.descripcion", "ilike", patron),
      ])
    );
  }

  const resultado = await query
    .select((eb) => eb.fn.count("recurso.id").as("total"))
    .executeTakeFirst();

  return Number(resultado?.total ?? 0);
}
