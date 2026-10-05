import { sql } from "kysely";
import { db } from "@/lib/db";
import type { PrioridadEventoAsistenciaSocial, EstadoEventoAsistenciaSocial } from "./asistencia-social.schema";

export interface DatosInsertarEventoAsistenciaSocialRepo {
  codigo: string;
  descripcion: string;
  tipoAfectacion: string;
  personasAfectadas: number;
  familiasAfectadas: number;
  direccionTexto: string;
  latitud: number;
  longitud: number;
  prioridad: PrioridadEventoAsistenciaSocial;
  contactoNombre?: string | null;
  contactoTelefono?: string | null;
  contactoRut?: string | null;
  delegacionId?: string | null;
  incidenteId?: string | null;
  creadoPorId: string;
}

export interface FilaEventoAsistenciaSocialConRelaciones {
  id: string;
  codigo: string;
  descripcion: string;
  tipo_afectacion: string;
  personas_afectadas: number;
  familias_afectadas: number;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  prioridad: string;
  estado: string;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_rut: string | null;
  delegacion_id: string | null;
  delegacion_nombre: string | null;
  incidente_id: string | null;
  asistente_social_id: string | null;
  asistente_social_nombre: string | null;
  creado_por_id: string;
  creado_por_nombre: string | null;
  creado_en: Date;
  actualizado_en: Date;
}

export interface FiltrosListarEventosAsistenciaSocial {
  estado?: EstadoEventoAsistenciaSocial;
  delegacionId?: string;
  prioridad?: PrioridadEventoAsistenciaSocial;
  busqueda?: string;
}

export interface OpcionesPaginacion {
  pagina: number;
  limite: number;
}

/**
 * Genera el siguiente código correlativo anual institucional con formato AS-YYYY-0001 (H28).
 */
export async function generarSiguienteCodigoAsistenciaSocial(): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `AS-${anio}-`;

  const conteo = await db
    .selectFrom("evento_asistencia_social")
    .where("codigo", "like", `${prefijo}%`)
    .select(sql<number>`count(*)::int`.as("total"))
    .executeTakeFirst();

  const secuencia = (conteo?.total ?? 0) + 1;
  return `${prefijo}${String(secuencia).padStart(4, "0")}`;
}

/**
 * Inserta un nuevo evento de asistencia social en PostgreSQL con geometría PostGIS.
 */
export async function insertarEventoAsistenciaSocial(
  datos: DatosInsertarEventoAsistenciaSocialRepo
): Promise<FilaEventoAsistenciaSocialConRelaciones> {
  const [insertado] = await db
    .insertInto("evento_asistencia_social")
    .values({
      codigo: datos.codigo,
      descripcion: datos.descripcion,
      tipo_afectacion: datos.tipoAfectacion,
      personas_afectadas: datos.personasAfectadas,
      familias_afectadas: datos.familiasAfectadas,
      direccion_texto: datos.direccionTexto,
      latitud: datos.latitud,
      longitud: datos.longitud,
      ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
      prioridad: datos.prioridad,
      estado: "PENDIENTE",
      contacto_nombre: datos.contactoNombre ?? null,
      contacto_telefono: datos.contactoTelefono ?? null,
      contacto_rut: datos.contactoRut ?? null,
      delegacion_id: datos.delegacionId ?? null,
      incidente_id: datos.incidenteId ?? null,
      creado_por_id: datos.creadoPorId,
    })
    .returning("id")
    .execute();

  const eventoDetalle = await buscarEventoAsistenciaSocialPorId(insertado.id);
  if (!eventoDetalle) {
    throw new Error("No se pudo recuperar el evento de asistencia social recién creado.");
  }

  return eventoDetalle;
}

/**
 * Busca un evento de asistencia social por su UUID con los nombres de delegación, creador y asistente social.
 */
export async function buscarEventoAsistenciaSocialPorId(
  id: string
): Promise<FilaEventoAsistenciaSocialConRelaciones | null> {
  const fila = await db
    .selectFrom("evento_asistencia_social")
    .leftJoin("delegacion", "delegacion.id", "evento_asistencia_social.delegacion_id")
    .innerJoin("usuario as creador", "creador.id", "evento_asistencia_social.creado_por_id")
    .leftJoin("usuario as asistente", "asistente.id", "evento_asistencia_social.asistente_social_id")
    .select([
      "evento_asistencia_social.id",
      "evento_asistencia_social.codigo",
      "evento_asistencia_social.descripcion",
      "evento_asistencia_social.tipo_afectacion",
      "evento_asistencia_social.personas_afectadas",
      "evento_asistencia_social.familias_afectadas",
      "evento_asistencia_social.direccion_texto",
      "evento_asistencia_social.latitud",
      "evento_asistencia_social.longitud",
      "evento_asistencia_social.prioridad",
      "evento_asistencia_social.estado",
      "evento_asistencia_social.contacto_nombre",
      "evento_asistencia_social.contacto_telefono",
      "evento_asistencia_social.contacto_rut",
      "evento_asistencia_social.delegacion_id",
      sql<string | null>`COALESCE(delegacion.nombre, delegacion.nombre_delegacion)`.as("delegacion_nombre"),
      "evento_asistencia_social.incidente_id",
      "evento_asistencia_social.asistente_social_id",
      "asistente.nombre as asistente_social_nombre",
      "evento_asistencia_social.creado_por_id",
      "creador.nombre as creado_por_nombre",
      "evento_asistencia_social.creado_en",
      "evento_asistencia_social.actualizado_en",
    ])
    .where("evento_asistencia_social.id", "=", id)
    .where("evento_asistencia_social.eliminado_en", "is", null)
    .executeTakeFirst();

  return (fila as unknown as FilaEventoAsistenciaSocialConRelaciones) ?? null;
}

/**
 * Consulta paginada de eventos de asistencia social para el panel de pendientes y monitoreo.
 */
export async function listarEventosAsistenciaSocialPaginados(
  filtros: FiltrosListarEventosAsistenciaSocial,
  paginacion: OpcionesPaginacion
): Promise<FilaEventoAsistenciaSocialConRelaciones[]> {
  const { pagina, limite } = paginacion;
  const offset = (pagina - 1) * limite;

  let query = db
    .selectFrom("evento_asistencia_social")
    .leftJoin("delegacion", "delegacion.id", "evento_asistencia_social.delegacion_id")
    .innerJoin("usuario as creador", "creador.id", "evento_asistencia_social.creado_por_id")
    .leftJoin("usuario as asistente", "asistente.id", "evento_asistencia_social.asistente_social_id")
    .select([
      "evento_asistencia_social.id",
      "evento_asistencia_social.codigo",
      "evento_asistencia_social.descripcion",
      "evento_asistencia_social.tipo_afectacion",
      "evento_asistencia_social.personas_afectadas",
      "evento_asistencia_social.familias_afectadas",
      "evento_asistencia_social.direccion_texto",
      "evento_asistencia_social.latitud",
      "evento_asistencia_social.longitud",
      "evento_asistencia_social.prioridad",
      "evento_asistencia_social.estado",
      "evento_asistencia_social.contacto_nombre",
      "evento_asistencia_social.contacto_telefono",
      "evento_asistencia_social.contacto_rut",
      "evento_asistencia_social.delegacion_id",
      sql<string | null>`COALESCE(delegacion.nombre, delegacion.nombre_delegacion)`.as("delegacion_nombre"),
      "evento_asistencia_social.incidente_id",
      "evento_asistencia_social.asistente_social_id",
      "asistente.nombre as asistente_social_nombre",
      "evento_asistencia_social.creado_por_id",
      "creador.nombre as creado_por_nombre",
      "evento_asistencia_social.creado_en",
      "evento_asistencia_social.actualizado_en",
    ])
    .where("evento_asistencia_social.eliminado_en", "is", null);

  if (filtros.estado) {
    query = query.where("evento_asistencia_social.estado", "=", filtros.estado);
  }

  if (filtros.delegacionId) {
    query = query.where("evento_asistencia_social.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.prioridad) {
    query = query.where("evento_asistencia_social.prioridad", "=", filtros.prioridad);
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    query = query.where((eb) =>
      eb.or([
        eb("evento_asistencia_social.codigo", "ilike", patron),
        eb("evento_asistencia_social.descripcion", "ilike", patron),
        eb("evento_asistencia_social.direccion_texto", "ilike", patron),
        eb("evento_asistencia_social.contacto_nombre", "ilike", patron),
        eb("evento_asistencia_social.tipo_afectacion", "ilike", patron),
      ])
    );
  }

  const filas = await query
    .orderBy("evento_asistencia_social.creado_en", "desc")
    .limit(limite)
    .offset(offset)
    .execute();

  return filas as unknown as FilaEventoAsistenciaSocialConRelaciones[];
}

/**
 * Cuenta la cantidad total de eventos de asistencia social que coinciden con los filtros.
 */
export async function contarEventosAsistenciaSocial(
  filtros: FiltrosListarEventosAsistenciaSocial
): Promise<number> {
  let query = db
    .selectFrom("evento_asistencia_social")
    .where("evento_asistencia_social.eliminado_en", "is", null);

  if (filtros.estado) {
    query = query.where("evento_asistencia_social.estado", "=", filtros.estado);
  }

  if (filtros.delegacionId) {
    query = query.where("evento_asistencia_social.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.prioridad) {
    query = query.where("evento_asistencia_social.prioridad", "=", filtros.prioridad);
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    query = query.where((eb) =>
      eb.or([
        eb("evento_asistencia_social.codigo", "ilike", patron),
        eb("evento_asistencia_social.descripcion", "ilike", patron),
        eb("evento_asistencia_social.direccion_texto", "ilike", patron),
        eb("evento_asistencia_social.contacto_nombre", "ilike", patron),
        eb("evento_asistencia_social.tipo_afectacion", "ilike", patron),
      ])
    );
  }

  const resultado = await query
    .select(sql<number>`count(*)::int`.as("total"))
    .executeTakeFirst();

  return Number(resultado?.total ?? 0);
}
