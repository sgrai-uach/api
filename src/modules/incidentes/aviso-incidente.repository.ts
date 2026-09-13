import { db } from "@/lib/db";
import { sql } from "kysely";
import type {
  EstadoAvisoIncidente,
  OrigenReporte,
  PrioridadIncidente,
  EstadoIncidente,
} from "@/lib/db/types";
import { generarCodigoSeguimientoNumerico } from "./aviso-incidente.utils";

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
  origen_reporte?: OrigenReporte;
  asterisk_call_id?: string | null;
  asterisk_caller_phone?: string | null;
  operador_id?: string | null;
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

export interface CoincidenciaEspacial {
  id: string;
  codigo: string;
  tipoAfectacion: string;
  direccion: string;
  estado: string;
  distanciaMetros: number;
  creadoEn: string;
  origen: "aviso" | "incidente";
}

export interface ParametrosInsertarIncidenteManual {
  origenReporte: OrigenReporte;
  tipoAfectacion: string;
  descripcion: string;
  direccion: string;
  latitud: number;
  longitud: number;
  informanteNombre: string;
  informanteRut: string;
  informanteTelefono?: string | null;
  asteriskCallId?: string | null;
  asteriskCallerPhone?: string | null;
  prioridad?: PrioridadIncidente;
  requiereAsistenciaSocial?: boolean;
  esDuplicado?: boolean;
  avisoOriginalId?: string | null;
  operadorId: string;
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
      origen_reporte: datos.origen_reporte ?? "CHATBOT",
      asterisk_call_id: datos.asterisk_call_id ?? null,
      asterisk_caller_phone: datos.asterisk_caller_phone ?? null,
      operador_id: datos.operador_id ?? null,
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
      "origen_reporte",
      "asterisk_call_id",
      "asterisk_caller_phone",
      "operador_id",
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

/**
 * Busca avisos e incidentes cercanos con el mismo tipo de afectación para alertar al Call Center.
 * Retorna las coincidencias calculando la distancia exacta en metros con PostGIS ST_Distance.
 */
export async function buscarIncidentesYDuplicadosCercanos({
  tipoAfectacion,
  latitud,
  longitud,
  radioMetros = 300,
  horasVentana = 24,
}: ParametrosBusquedaDuplicado): Promise<CoincidenciaEspacial[]> {
  const puntoGeom = sql`ST_SetSRID(ST_MakePoint(${longitud}, ${latitud}), 4326)::geography`;

  // 1. Buscar en avisos recientes
  const avisos = await db
    .selectFrom("aviso_incidente")
    .select([
      "id",
      "codigo_seguimiento as codigo",
      "tipo_afectacion as tipoAfectacion",
      "direccion_texto as direccion",
      "estado",
      "creado_en as creadoEn",
      sql<number>`round(ST_Distance(ubicacion::geography, ${puntoGeom})::numeric, 1)`.as("distanciaMetros"),
    ])
    .where("tipo_afectacion", "=", tipoAfectacion)
    .where("es_duplicado", "=", false)
    .where("creado_en", ">=", sql<Date>`CURRENT_TIMESTAMP - (${horasVentana} || ' hours')::interval`)
    .where(sql<boolean>`ST_DWithin(ubicacion::geography, ${puntoGeom}, ${radioMetros})`)
    .orderBy("distanciaMetros", "asc")
    .execute();

  // 2. Buscar en incidentes activos (no resueltos ni descartados)
  const incidentes = await db
    .selectFrom("incidente")
    .select([
      "id",
      "codigo",
      "tipo_afectacion as tipoAfectacion",
      "direccion_texto as direccion",
      "estado",
      "creado_en as creadoEn",
      sql<number>`round(ST_Distance(ubicacion::geography, ${puntoGeom})::numeric, 1)`.as("distanciaMetros"),
    ])
    .where("tipo_afectacion", "=", tipoAfectacion)
    .where("estado", "not in", ["RESUELTO", "DESCARTADO"])
    .where("creado_en", ">=", sql<Date>`CURRENT_TIMESTAMP - (${horasVentana} || ' hours')::interval`)
    .where(sql<boolean>`ST_DWithin(ubicacion::geography, ${puntoGeom}, ${radioMetros})`)
    .orderBy("distanciaMetros", "asc")
    .execute();

  const resultados: CoincidenciaEspacial[] = [
    ...incidentes.map((inc) => ({
      id: inc.id,
      codigo: inc.codigo,
      tipoAfectacion: inc.tipoAfectacion,
      direccion: inc.direccion,
      estado: inc.estado,
      distanciaMetros: Number(inc.distanciaMetros),
      creadoEn:
        typeof inc.creadoEn === "string" ? inc.creadoEn : inc.creadoEn.toISOString(),
      origen: "incidente" as const,
    })),
    ...avisos.map((av) => ({
      id: av.id,
      codigo: av.codigo,
      tipoAfectacion: av.tipoAfectacion,
      direccion: av.direccion,
      estado: av.estado,
      distanciaMetros: Number(av.distanciaMetros),
      creadoEn:
        typeof av.creadoEn === "string" ? av.creadoEn : av.creadoEn.toISOString(),
      origen: "aviso" as const,
    })),
  ];

  // Ordenar por distancia menor primero
  return resultados.sort((a, b) => a.distanciaMetros - b.distanciaMetros);
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

/**
 * Inserta de manera atómica (en una misma transacción PostgreSQL) el registro en aviso_incidente
 * y lo promueve directamente como un incidente válido en la tabla incidente con estado SIN_ATENDER.
 */
export async function insertarIncidenteManualTransaccional(datos: ParametrosInsertarIncidenteManual) {
  return await db.transaction().execute(async (trx) => {
    const nuevoCodigoSeguimiento = generarCodigoSeguimientoNumerico();
    const codigoIncidente = `INC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // 1. Insertar en aviso_incidente
    const nuevoAviso = await trx
      .insertInto("aviso_incidente")
      .values({
        codigo_seguimiento: nuevoCodigoSeguimiento,
        tipo_afectacion: datos.tipoAfectacion,
        direccion_texto: datos.direccion,
        latitud: datos.latitud,
        longitud: datos.longitud,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
        descripcion: datos.descripcion,
        informante_nombre: datos.informanteNombre,
        informante_rut: datos.informanteRut,
        informante_telefono: datos.informanteTelefono ?? null,
        origen_reporte: datos.origenReporte,
        asterisk_call_id: datos.asteriskCallId ?? null,
        asterisk_caller_phone: datos.asteriskCallerPhone ?? null,
        operador_id: datos.operadorId,
        estado: "EN_ATENCION",
        es_duplicado: datos.esDuplicado ?? false,
        aviso_original_id: datos.avisoOriginalId ?? null,
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
        "origen_reporte",
        "asterisk_call_id",
        "asterisk_caller_phone",
        "operador_id",
        "estado",
        "es_duplicado",
        "aviso_original_id",
        "incidente_id",
        "creado_en",
        "actualizado_en",
      ])
      .executeTakeFirstOrThrow();

    // 2. Insertar en tabla incidente vinculando el aviso_origen_id y con estado SIN_ATENDER
    const nuevoIncidente = await trx
      .insertInto("incidente")
      .values({
        codigo: codigoIncidente,
        tipo_afectacion: datos.tipoAfectacion,
        descripcion: datos.descripcion,
        direccion_texto: datos.direccion,
        latitud: datos.latitud,
        longitud: datos.longitud,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
        estado: "SIN_ATENDER",
        prioridad: datos.prioridad ?? "MEDIA",
        requiere_asistencia_social: datos.requiereAsistenciaSocial ?? false,
        aviso_origen_id: nuevoAviso.id,
        creado_por_id: datos.operadorId,
        encargado_id: null,
      })
      .returning([
        "id",
        "codigo",
        "tipo_afectacion",
        "descripcion",
        "direccion_texto",
        "latitud",
        "longitud",
        "estado",
        "prioridad",
        "requiere_asistencia_social",
        "aviso_origen_id",
        "creado_por_id",
        "encargado_id",
        "creado_en",
        "actualizado_en",
      ])
      .executeTakeFirstOrThrow();

    // 3. Actualizar la referencia incidente_id en aviso_incidente
    await trx
      .updateTable("aviso_incidente")
      .set({ incidente_id: nuevoIncidente.id })
      .where("id", "=", nuevoAviso.id)
      .execute();

    return {
      aviso: {
        ...nuevoAviso,
        incidente_id: nuevoIncidente.id,
      },
      incidente: nuevoIncidente,
    };
  });
}
