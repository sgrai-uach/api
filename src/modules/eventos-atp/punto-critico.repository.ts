import { sql } from "kysely";
import { db } from "@/lib/db";
import type { PrioridadPuntoCritico } from "./punto-critico.schema";

export interface FiltrosListarPuntosCriticos {
  delegacionId?: string;
  activo?: boolean;
  prioridad?: PrioridadPuntoCritico;
  busqueda?: string;
}

export interface OpcionesPaginacion {
  pagina: number;
  limite: number;
}

export interface FilaPuntoCriticoConDelegacion {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo_riesgo: string | null;
  prioridad: PrioridadPuntoCritico;
  activo: boolean;
  latitud: number | string;
  longitud: number | string;
  creado_en: Date;
  delegacion_id: string | null;
  delegacion_codigo: string | null;
  delegacion_nombre: string | null;
}

/**
 * Consulta la colección paginada de puntos críticos almacenados en la tabla prevencion,
 * vinculando información de delegación territorial y filtrando según criterios del Administrador.
 */
export async function listarPuntosCriticosPaginados(
  filtros: FiltrosListarPuntosCriticos,
  paginacion: OpcionesPaginacion
): Promise<FilaPuntoCriticoConDelegacion[]> {
  const { pagina, limite } = paginacion;
  const offset = (pagina - 1) * limite;

  let query = db
    .selectFrom("prevencion")
    .leftJoin("delegacion", "delegacion.id", "prevencion.delegacion_id")
    .select([
      "prevencion.id",
      "prevencion.codigo",
      "prevencion.nombre",
      "prevencion.descripcion",
      "prevencion.tipo_riesgo",
      "prevencion.prioridad",
      "prevencion.activo",
      "prevencion.latitud",
      "prevencion.longitud",
      "prevencion.creado_en",
      "delegacion.id as delegacion_id",
      "delegacion.codigo_delegacion as delegacion_codigo",
      "delegacion.nombre_delegacion as delegacion_nombre",
    ]);

  if (filtros.delegacionId) {
    query = query.where("prevencion.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.activo !== undefined) {
    query = query.where("prevencion.activo", "=", filtros.activo);
  }

  if (filtros.prioridad) {
    query = query.where("prevencion.prioridad", "=", filtros.prioridad);
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    query = query.where((eb) =>
      eb.or([
        eb("prevencion.nombre", "ilike", patron),
        eb("prevencion.codigo", "ilike", patron),
        eb("prevencion.descripcion", "ilike", patron),
        eb("prevencion.tipo_riesgo", "ilike", patron),
      ])
    );
  }

  const filas = await query
    .orderBy("prevencion.creado_en", "desc")
    .limit(limite)
    .offset(offset)
    .execute();

  return filas as unknown as FilaPuntoCriticoConDelegacion[];
}

/**
 * Cuenta la cantidad total de registros en prevencion que cumplen los filtros aplicados.
 */
export async function contarPuntosCriticos(
  filtros: FiltrosListarPuntosCriticos
): Promise<number> {
  let query = db.selectFrom("prevencion");

  if (filtros.delegacionId) {
    query = query.where("prevencion.delegacion_id", "=", filtros.delegacionId);
  }

  if (filtros.activo !== undefined) {
    query = query.where("prevencion.activo", "=", filtros.activo);
  }

  if (filtros.prioridad) {
    query = query.where("prevencion.prioridad", "=", filtros.prioridad);
  }

  if (filtros.busqueda && filtros.busqueda.trim() !== "") {
    const patron = `%${filtros.busqueda.trim()}%`;
    query = query.where((eb) =>
      eb.or([
        eb("prevencion.nombre", "ilike", patron),
        eb("prevencion.codigo", "ilike", patron),
        eb("prevencion.descripcion", "ilike", patron),
        eb("prevencion.tipo_riesgo", "ilike", patron),
      ])
    );
  }

  const resultado = await query
    .select((eb) => eb.fn.count("prevencion.id").as("total"))
    .executeTakeFirst();

  return Number(resultado?.total ?? 0);
}

/**
 * Obtiene un punto crítico por su identificador único (UUID).
 */
export async function obtenerPuntoCriticoPorId(id: string) {
  return await db
    .selectFrom("prevencion")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

/**
 * Verifica si existen misiones activas (PLANIFICADA, DESPACHADA, EN_CURSO) asociadas al punto crítico.
 */
export async function verificarMisionesActivasPuntoCritico(
  prevencionId: string
): Promise<{
  tieneMisionesActivas: boolean;
  totalMisiones: number;
  codigos: string[];
}> {
  const misiones = await db
    .selectFrom("mision")
    .select(["id", "codigo", "estado"])
    .where("prevencion_id", "=", prevencionId)
    .where("estado", "in", ["PLANIFICADA", "DESPACHADA", "EN_CURSO"])
    .execute();

  return {
    tieneMisionesActivas: misiones.length > 0,
    totalMisiones: misiones.length,
    codigos: misiones.map((m) => m.codigo),
  };
}

/**
 * Aplica el borrado lógico (soft delete) sobre un punto crítico, registrando
 * la fecha/hora y el identificador del usuario administrador responsable.
 */
export async function marcarPuntoCriticoEliminado(
  id: string,
  usuarioId: string
) {
  return await db
    .updateTable("prevencion")
    .set({
      activo: false,
      eliminado_en: sql`CURRENT_TIMESTAMP`,
      eliminado_por_id: usuarioId,
    })
    .where("id", "=", id)
    .returning([
      "id",
      "codigo",
      "nombre",
      "activo",
      "eliminado_en",
      "eliminado_por_id",
    ])
    .executeTakeFirst();
}
