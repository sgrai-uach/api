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
  creado_por_id?: string | null;
  delegacion_id: string | null;
  delegacion_codigo: string | null;
  delegacion_nombre: string | null;
}

export interface DatosCrearPuntoCritico {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  tipoRiesgo?: string | null;
  prioridad: PrioridadPuntoCritico;
  delegacionId?: string | null;
  latitud: number;
  longitud: number;
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
      "prevencion.creado_por_id",
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
 * Obtiene el detalle completo de un punto crítico con los datos de su delegación territorial.
 */
export async function obtenerPuntoCriticoDetallePorId(
  id: string
): Promise<FilaPuntoCriticoConDelegacion | null> {
  const fila = await db
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
      "prevencion.creado_por_id",
      "delegacion.id as delegacion_id",
      "delegacion.codigo_delegacion as delegacion_codigo",
      "delegacion.nombre_delegacion as delegacion_nombre",
    ])
    .where("prevencion.id", "=", id)
    .executeTakeFirst();

  return (fila as unknown as FilaPuntoCriticoConDelegacion) ?? null;
}

/**
 * Verifica si un código institucional ya se encuentra registrado en la tabla prevencion.
 */
export async function verificarCodigoPuntoCriticoExiste(codigo: string): Promise<boolean> {
  const punto = await db
    .selectFrom("prevencion")
    .select("id")
    .where("codigo", "=", codigo)
    .executeTakeFirst();
  return Boolean(punto);
}

/**
 * Obtiene los datos básicos de una delegación territorial por su UUID.
 */
export async function obtenerDelegacionPorId(delegacionId: string) {
  const delegacion = await db
    .selectFrom("delegacion")
    .select(["id", "codigo", "nombre"])
    .where("id", "=", delegacionId)
    .executeTakeFirst();
  return delegacion ?? null;
}

/**
 * Determina el prefijo institucional para el código del punto crítico según la delegación.
 */
export function determinarPrefijoPuntoCritico(codigoDelegacion?: string | null): string {
  if (!codigoDelegacion) return "PC-VAL";
  const cod = codigoDelegacion.toUpperCase();
  if (cod.includes("NORTE")) return "PC-NOR";
  if (cod.includes("SUR")) return "PC-SUR";
  if (cod.includes("COSTA")) return "PC-COS";
  if (cod.includes("CALLE")) return "PC-CC";
  return "PC-VAL";
}

/**
 * Genera el siguiente código correlativo único para un punto crítico (ej. PC-SUR-001).
 */
export async function generarSiguienteCodigoPuntoCritico(prefijo: string = "PC-VAL"): Promise<string> {
  const patron = `${prefijo}-%`;
  const filas = await db
    .selectFrom("prevencion")
    .select("codigo")
    .where("codigo", "like", patron)
    .execute();

  let maxNum = 0;
  for (const fila of filas) {
    const partes = fila.codigo.split("-");
    const num = parseInt(partes[partes.length - 1], 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }

  const siguiente = maxNum + 1;
  let codigoCandidato = `${prefijo}-${String(siguiente).padStart(3, "0")}`;

  let offset = 0;
  while (await verificarCodigoPuntoCriticoExiste(codigoCandidato)) {
    offset++;
    codigoCandidato = `${prefijo}-${String(siguiente + offset).padStart(3, "0")}`;
  }

  return codigoCandidato;
}

/**
 * Inserta un nuevo punto crítico en la base de datos relacional con coordenadas PostGIS (Point EPSG:4326).
 */
export async function insertarPuntoCritico(
  datos: DatosCrearPuntoCritico,
  usuarioId: string
): Promise<FilaPuntoCriticoConDelegacion> {
  const insertado = await db
    .insertInto("prevencion")
    .values({
      codigo: datos.codigo,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      tipo_riesgo: datos.tipoRiesgo ?? null,
      prioridad: datos.prioridad,
      delegacion_id: datos.delegacionId ?? null,
      latitud: datos.latitud,
      longitud: datos.longitud,
      ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
      activo: true,
      creado_por_id: usuarioId,
      creado_en: sql`CURRENT_TIMESTAMP`,
    })
    .returning([
      "id",
      "codigo",
      "nombre",
      "descripcion",
      "tipo_riesgo",
      "prioridad",
      "activo",
      "latitud",
      "longitud",
      "delegacion_id",
      "creado_en",
      "creado_por_id",
    ])
    .executeTakeFirstOrThrow();

  const consolidado = await obtenerPuntoCriticoDetallePorId(insertado.id);
  if (consolidado) {
    return consolidado;
  }

  return {
    id: insertado.id,
    codigo: insertado.codigo,
    nombre: insertado.nombre,
    descripcion: insertado.descripcion ?? null,
    tipo_riesgo: insertado.tipo_riesgo ?? null,
    prioridad: insertado.prioridad,
    activo: insertado.activo,
    latitud: insertado.latitud,
    longitud: insertado.longitud,
    creado_en: insertado.creado_en,
    creado_por_id: insertado.creado_por_id ?? null,
    delegacion_id: insertado.delegacion_id ?? null,
    delegacion_codigo: null,
    delegacion_nombre: null,
  };
}
