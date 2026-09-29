import { db } from "@/lib/db";
import { sql } from "kysely";
import type { EstadoIncidente } from "@/lib/db/types";

export interface DatosInsertarIncidente {
  codigo_seguimiento: string;
  tipo_afectacion: string;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  descripcion: string | null;
  informante_nombre: string;
  informante_rut: string;
  informante_telefono: string | null;
  estado?: EstadoIncidente;
  es_duplicado?: boolean;
  aviso_original_id?: string | null;
}

export type DatosInsertarAvisoIncidente = DatosInsertarIncidente;

export interface ParametrosBusquedaDuplicado {
  tipoAfectacion: string;
  latitud: number;
  longitud: number;
  radioMetros?: number;
  horasVentana?: number;
}

/**
 * Busca o registra un informante ciudadano por su RUT en la tabla 'informante'.
 */
export async function buscarOCrearInformante(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trx: any,
  datos: {
    rut: string;
    nombre: string;
    telefono?: string | null;
  }
) {
  const existente = await trx
    .selectFrom("informante")
    .selectAll()
    .where("rut", "=", datos.rut)
    .executeTakeFirst();

  if (existente) {
    if (existente.nombre !== datos.nombre || existente.telefono !== (datos.telefono ?? null)) {
      await trx
        .updateTable("informante")
        .set({
          nombre: datos.nombre,
          telefono: datos.telefono ?? existente.telefono,
        })
        .where("id", "=", existente.id)
        .execute();
    }
    return existente;
  }

  return await trx
    .insertInto("informante")
    .values({
      rut: datos.rut,
      nombre: datos.nombre,
      telefono: datos.telefono ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Inserta un nuevo registro de incidente en la base de datos vinculando al informante.
 */
export async function insertarIncidenteDesdeChatbot(datos: DatosInsertarIncidente) {
  return await db.transaction().execute(async (trx) => {
    const informante = await buscarOCrearInformante(trx, {
      rut: datos.informante_rut,
      nombre: datos.informante_nombre,
      telefono: datos.informante_telefono,
    });

    const codigo = `INC-${datos.codigo_seguimiento}`;

    const incidente = await trx
      .insertInto("incidente")
      .values({
        codigo,
        codigo_seguimiento: datos.codigo_seguimiento,
        informante_id: informante.id,
        tipo_afectacion: datos.tipo_afectacion,
        direccion_texto: datos.direccion_texto,
        latitud: datos.latitud,
        longitud: datos.longitud,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
        descripcion: datos.descripcion,
        estado: datos.estado ?? "REPORTADO",
        prioridad: "MEDIA",
        requiere_asistencia_social: false,
        fuente_origen: "CHATBOT",
        asterisk_call_id: null,
        asterisk_caller_phone: null,
        creado_por_id: null,
        encargado_id: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...incidente,
      informante_nombre: informante.nombre,
      informante_rut: informante.rut,
      informante_telefono: informante.telefono,
      es_duplicado: datos.es_duplicado ?? false,
      aviso_original_id: datos.aviso_original_id ?? null,
    };
  });
}

export async function insertarAvisoIncidente(datos: DatosInsertarIncidente) {
  return await insertarIncidenteDesdeChatbot(datos);
}

/**
 * Busca si existe un incidente activo previo cercano con el mismo tipo de afectación
 * en una ventana de tiempo reciente utilizando PostGIS ST_DWithin (en metros).
 */
export async function buscarIncidenteDuplicadoCercano({
  tipoAfectacion,
  latitud,
  longitud,
  radioMetros = 300,
  horasVentana = 24,
}: ParametrosBusquedaDuplicado) {
  const duplicado = await db
    .selectFrom("incidente")
    .selectAll()
    .where("tipo_afectacion", "=", tipoAfectacion)
    .where("estado", "not in", ["RESUELTO", "NO_ABORDABLE"])
    .where("creado_en", ">=", sql<Date>`CURRENT_TIMESTAMP - (${horasVentana} || ' hours')::interval`)
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

export async function buscarAvisoDuplicadoCercano(params: ParametrosBusquedaDuplicado) {
  return await buscarIncidenteDuplicadoCercano(params);
}

/**
 * Consulta un incidente a partir de su código de seguimiento numérico de 8 dígitos.
 */
export async function buscarIncidentePorCodigoSeguimiento(codigoSeguimiento: string) {
  const incidente = await db
    .selectFrom("incidente")
    .selectAll()
    .where("codigo_seguimiento", "=", codigoSeguimiento)
    .orderBy("creado_en", "asc")
    .limit(1)
    .executeTakeFirst();

  return incidente;
}

export async function buscarAvisoPorCodigo(codigoSeguimiento: string) {
  return await buscarIncidentePorCodigoSeguimiento(codigoSeguimiento);
}

