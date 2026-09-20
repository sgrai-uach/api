import { db } from "@/lib/db";
import { sql } from "kysely";
import type {
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
  creado_por_id?: string | null;
  estado?: EstadoIncidente;
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
 * Inserta o recupera un informante por su RUT.
 */
async function buscarOCrearInformante(
  trx: typeof db,
  rut: string | null,
  nombre: string,
  telefono: string | null
): Promise<string> {
  if (rut) {
    const existente = await trx
      .selectFrom("informante")
      .select("id")
      .where("rut", "=", rut)
      .limit(1)
      .executeTakeFirst();

    if (existente) {
      return existente.id;
    }
  }

  const nuevo = await trx
    .insertInto("informante")
    .values({
      rut: rut ?? null,
      nombre,
      telefono,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  return nuevo.id;
}

/**
 * Inserta un nuevo reporte en la tabla incidente asociada al informante según el Diagrama ER.
 */
export async function insertarAvisoIncidente(datos: DatosInsertarAvisoIncidente) {
  return await db.transaction().execute(async (trx) => {
    const informanteId = await buscarOCrearInformante(
      trx,
      datos.informante_rut,
      datos.informante_nombre,
      datos.informante_telefono
    );

    const codigoIncidente = `INC-${datos.codigo_seguimiento}`;

    const nuevoIncidente = await trx
      .insertInto("incidente")
      .values({
        codigo: codigoIncidente,
        codigo_seguimiento: datos.codigo_seguimiento,
        informante_id: informanteId,
        tipo_afectacion: datos.tipo_afectacion,
        direccion_texto: datos.direccion_texto,
        latitud: datos.latitud,
        longitud: datos.longitud,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
        descripcion: datos.descripcion,
        estado: datos.estado ?? "REPORTADO",
        prioridad: "MEDIA",
        requiere_asistencia_social: false,
        fuente_origen: datos.origen_reporte ?? "CHATBOT",
        asterisk_call_id: datos.asterisk_call_id ?? null,
        asterisk_caller_phone: datos.asterisk_caller_phone ?? null,
        creado_por_id: datos.creado_por_id ?? null,
        operador_id: datos.operador_id ?? null,
        encargado_id: null,
      })
      .returning([
        "id",
        "codigo",
        "codigo_seguimiento",
        "tipo_afectacion",
        "direccion_texto",
        "latitud",
        "longitud",
        "descripcion",
        "estado",
        "fuente_origen",
        "creado_en",
        "actualizado_en",
      ])
      .executeTakeFirstOrThrow();

    return {
      id: nuevoIncidente.id,
      codigo_seguimiento: nuevoIncidente.codigo_seguimiento,
      tipo_afectacion: nuevoIncidente.tipo_afectacion,
      direccion_texto: nuevoIncidente.direccion_texto,
      latitud: Number(nuevoIncidente.latitud),
      longitud: Number(nuevoIncidente.longitud),
      descripcion: nuevoIncidente.descripcion,
      informante_nombre: datos.informante_nombre,
      informante_rut: datos.informante_rut,
      informante_telefono: datos.informante_telefono,
      origen_reporte: (nuevoIncidente.fuente_origen ?? "CHATBOT") as OrigenReporte,
      asterisk_call_id: datos.asterisk_call_id ?? null,
      asterisk_caller_phone: datos.asterisk_caller_phone ?? null,
      operador_id: datos.operador_id ?? null,
      estado: nuevoIncidente.estado,
      es_duplicado: datos.es_duplicado ?? false,
      aviso_original_id: datos.aviso_original_id ?? null,
      incidente_id: nuevoIncidente.id as string | null,
      creado_en: nuevoIncidente.creado_en,
      actualizado_en: nuevoIncidente.actualizado_en,
    };
  });
}

/**
 * Busca si existe un incidente previo cercano con el mismo tipo de afectación en una ventana de tiempo reciente.
 * Utiliza PostGIS ST_DWithin sobre tipos geográficos (en metros).
 */
export async function buscarAvisoDuplicadoCercano({
  tipoAfectacion,
  latitud,
  longitud,
  radioMetros = 300,
  horasVentana = 24,
}: ParametrosBusquedaDuplicado) {
  const puntoGeom = sql`ST_SetSRID(ST_MakePoint(${longitud}, ${latitud}), 4326)::geography`;

  const duplicado = await db
    .selectFrom("incidente")
    .leftJoin("informante", "informante.id", "incidente.informante_id")
    .select([
      "incidente.id",
      "incidente.codigo",
      "incidente.codigo_seguimiento",
      "incidente.tipo_afectacion",
      "incidente.direccion_texto",
      "incidente.latitud",
      "incidente.longitud",
      "incidente.ubicacion",
      "incidente.descripcion",
      "informante.nombre as informante_nombre",
      "informante.rut as informante_rut",
      "informante.telefono as informante_telefono",
      "incidente.fuente_origen as origen_reporte",
      "incidente.estado",
      "incidente.creado_en",
      "incidente.actualizado_en",
    ])
    .where("incidente.tipo_afectacion", "=", tipoAfectacion)
    .where("incidente.estado", "not in", ["RESUELTO", "NO_ABORDABLE"])
    .where(
      "incidente.creado_en",
      ">=",
      sql<Date>`CURRENT_TIMESTAMP - (${horasVentana} || ' hours')::interval`
    )
    .where(
      sql<boolean>`ST_DWithin(
        incidente.ubicacion::geography,
        ${puntoGeom},
        ${radioMetros}
      )`
    )
    .orderBy("incidente.creado_en", "desc")
    .limit(1)
    .executeTakeFirst();

  return duplicado;
}

/**
 * Busca incidentes cercanos con el mismo tipo de afectación para alertar al Call Center.
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

  const incidentes = await db
    .selectFrom("incidente")
    .select([
      "id",
      "codigo",
      "codigo_seguimiento",
      "tipo_afectacion as tipoAfectacion",
      "direccion_texto as direccion",
      "estado",
      "creado_en as creadoEn",
      sql<number>`round(ST_Distance(ubicacion::geography, ${puntoGeom})::numeric, 1)`.as("distanciaMetros"),
    ])
    .where("tipo_afectacion", "=", tipoAfectacion)
    .where("estado", "not in", ["RESUELTO", "NO_ABORDABLE"])
    .where(
      "creado_en",
      ">=",
      sql<Date>`CURRENT_TIMESTAMP - (${horasVentana} || ' hours')::interval`
    )
    .where(sql<boolean>`ST_DWithin(ubicacion::geography, ${puntoGeom}, ${radioMetros})`)
    .orderBy("distanciaMetros", "asc")
    .execute();

  const resultados: CoincidenciaEspacial[] = incidentes.map((inc) => ({
    id: inc.id,
    codigo: inc.codigo,
    tipoAfectacion: inc.tipoAfectacion,
    direccion: inc.direccion,
    estado: inc.estado,
    distanciaMetros: Number(inc.distanciaMetros),
    creadoEn:
      typeof inc.creadoEn === "string" ? inc.creadoEn : inc.creadoEn.toISOString(),
    origen: "incidente" as const,
  }));

  return resultados.sort((a, b) => a.distanciaMetros - b.distanciaMetros);
}

/**
 * Consulta un incidente a partir de su código de seguimiento numérico.
 */
export async function buscarAvisoPorCodigo(codigoSeguimiento: string) {
  const aviso = await db
    .selectFrom("incidente")
    .leftJoin("informante", "informante.id", "incidente.informante_id")
    .select([
      "incidente.id",
      "incidente.codigo",
      "incidente.codigo_seguimiento",
      "incidente.tipo_afectacion",
      "incidente.direccion_texto",
      "incidente.latitud",
      "incidente.longitud",
      "incidente.ubicacion",
      "incidente.descripcion",
      "informante.nombre as informante_nombre",
      "informante.rut as informante_rut",
      "informante.telefono as informante_telefono",
      "incidente.fuente_origen as origen_reporte",
      "incidente.asterisk_call_id",
      "incidente.asterisk_caller_phone",
      "incidente.operador_id",
      "incidente.estado",
      "incidente.creado_en",
      "incidente.actualizado_en",
    ])
    .where("incidente.codigo_seguimiento", "=", codigoSeguimiento)
    .orderBy("incidente.creado_en", "asc")
    .limit(1)
    .executeTakeFirst();

  if (!aviso) {
    return undefined;
  }

  return {
    ...aviso,
    es_duplicado: false,
    aviso_original_id: null as string | null,
    incidente_id: aviso.id as string | null,
  };
}

/**
 * Inserta de manera atómica el registro en informante e incidente con estado REPORTADO
 * a partir de un ingreso manual de Call Center o funcionario en terreno.
 */
export async function insertarIncidenteManualTransaccional(datos: ParametrosInsertarIncidenteManual) {
  return await db.transaction().execute(async (trx) => {
    const nuevoCodigoSeguimiento = generarCodigoSeguimientoNumerico();
    const codigoIncidente = `INC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // 1. Buscar o crear informante
    const informanteId = await buscarOCrearInformante(
      trx,
      datos.informanteRut,
      datos.informanteNombre,
      datos.informanteTelefono ?? null
    );

    // 2. Insertar directamente en incidente
    const nuevoIncidente = await trx
      .insertInto("incidente")
      .values({
        codigo: codigoIncidente,
        codigo_seguimiento: nuevoCodigoSeguimiento,
        informante_id: informanteId,
        tipo_afectacion: datos.tipoAfectacion,
        descripcion: datos.descripcion,
        direccion_texto: datos.direccion,
        latitud: datos.latitud,
        longitud: datos.longitud,
        ubicacion: sql`ST_SetSRID(ST_MakePoint(${datos.longitud}, ${datos.latitud}), 4326)`,
        estado: "REPORTADO",
        prioridad: datos.prioridad ?? "MEDIA",
        requiere_asistencia_social: datos.requiereAsistenciaSocial ?? false,
        fuente_origen: datos.origenReporte,
        asterisk_call_id: datos.asteriskCallId ?? null,
        asterisk_caller_phone: datos.asteriskCallerPhone ?? null,
        creado_por_id: datos.operadorId,
        operador_id: datos.operadorId,
        encargado_id: null,
      })
      .returning([
        "id",
        "codigo",
        "codigo_seguimiento",
        "tipo_afectacion",
        "descripcion",
        "direccion_texto",
        "latitud",
        "longitud",
        "estado",
        "prioridad",
        "requiere_asistencia_social",
        "fuente_origen",
        "asterisk_call_id",
        "asterisk_caller_phone",
        "creado_por_id",
        "operador_id",
        "encargado_id",
        "creado_en",
        "actualizado_en",
      ])
      .executeTakeFirstOrThrow();

    const avisoSimulado = {
      id: nuevoIncidente.id,
      codigo_seguimiento: nuevoIncidente.codigo_seguimiento,
      tipo_afectacion: nuevoIncidente.tipo_afectacion,
      direccion_texto: nuevoIncidente.direccion_texto,
      latitud: Number(nuevoIncidente.latitud),
      longitud: Number(nuevoIncidente.longitud),
      descripcion: nuevoIncidente.descripcion,
      informante_nombre: datos.informanteNombre,
      informante_rut: datos.informanteRut,
      informante_telefono: datos.informanteTelefono ?? null,
      origen_reporte: datos.origenReporte,
      asterisk_call_id: datos.asteriskCallId ?? null,
      asterisk_caller_phone: datos.asteriskCallerPhone ?? null,
      operador_id: datos.operadorId,
      estado: nuevoIncidente.estado,
      es_duplicado: datos.esDuplicado ?? false,
      aviso_original_id: datos.avisoOriginalId ?? null,
      incidente_id: nuevoIncidente.id,
      creado_en: nuevoIncidente.creado_en,
      actualizado_en: nuevoIncidente.actualizado_en,
    };

    return {
      aviso: avisoSimulado,
      incidente: {
        ...nuevoIncidente,
        aviso_origen_id: nuevoIncidente.id,
      },
    };
  });
}
