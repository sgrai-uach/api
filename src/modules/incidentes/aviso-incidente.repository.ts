import { db } from "@/lib/db";
import { sql } from "kysely";
import type { EstadoAvisoIncidente } from "@/lib/db/types";

export interface DatosInsertarAvisoIncidente {
  codigo_seguimiento: string;
  tipo_afectacion: string;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  informante_nombre: string;
  informante_rut: string;
  informante_telefono: string | null;
  estado?: EstadoAvisoIncidente;
  es_duplicado?: boolean;
  aviso_original_id?: string | null;
}

export interface ParametrosBusquedaDuplicado {
  tipoAfectacion: string;
  latitud: number;
  longitud: number;
  radioMetros?: number;
  horasVentana?: number;
}

/**
 * Inserta un nuevo registro de aviso de incidente en la base de datos con su punto PostGIS.
 */
export async function insertarAvisoIncidente(datos: DatosInsertarAvisoIncidente) {
  const fila = await db
    .insertInto("aviso_incidente")
    .values({
      codigo_seguimiento: datos.codigo_seguimiento,
      tipo_afectacion: datos.tipo_afectacion,
      direccion_texto: datos.direccion_texto,
      latitud: datos.latitud,
      longitud: datos.longitud,
      ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
      descripcion: datos.descripcion,
      informante_nombre: datos.informante_nombre,
      informante_rut: datos.informante_rut,
      informante_telefono: datos.informante_telefono,
      estado: datos.estado ?? "PENDIENTE_VERIFICACION",
      es_duplicado: datos.es_duplicado ?? false,
      aviso_original_id: datos.aviso_original_id ?? null,
    })
    .returning([
      "id",
      "codigo_seguimiento",
      "tipo_afectacion",
      "direccion_texto",
      "latitud",
      "longitud",
      "descripcion",
      "informante_nombre",
      "informante_rut",
      "informante_telefono",
      "estado",
      "es_duplicado",
      "aviso_original_id",
      "incidente_id",
      "creado_en",
      "actualizado_en",
    ])
    .executeTakeFirstOrThrow();

  return fila;
}

/**
 * Busca si existe un aviso previo cercano con el mismo tipo de afectación en una ventana de tiempo reciente.
 * Utiliza PostGIS ST_DWithin sobre tipos geográficos (en metros).
 */
export async function buscarAvisoDuplicadoCercano({
  tipoAfectacion,
  latitud,
  longitud,
  radioMetros = 300,
  horasVentana = 24,
}: ParametrosBusquedaDuplicado) {
  const duplicado = await db
    .selectFrom("aviso_incidente")
    .selectAll()
    .where("tipo_afectacion", "=", tipoAfectacion)
    .where("es_duplicado", "=", false)
    .where("creado_en", ">=", sql`CURRENT_TIMESTAMP - (${horasVentana} || ' hours')::interval`)
    .where(
      sql<boolean>`ST_DWithin(
        ubicacion::geography,
        ST_SetSRID(ST_MakePoint(${longitud}, ${latitud}), 4326)::geography,
        ${radioMetros}
      )`
    )
    .orderBy("creado_en", "desc")
    .limit(1)
    .executeTakeFirst();

  return duplicado;
}

/**
 * Consulta un aviso de incidente a partir de su código de seguimiento numérico.
 */
export async function buscarAvisoPorCodigo(codigoSeguimiento: string) {
  const aviso = await db
    .selectFrom("aviso_incidente")
    .selectAll()
    .where("codigo_seguimiento", "=", codigoSeguimiento)
    .orderBy("creado_en", "asc")
    .limit(1)
    .executeTakeFirst();

  return aviso;
}
