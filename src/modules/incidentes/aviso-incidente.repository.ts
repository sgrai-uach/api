import { db } from "@/lib/db";
import { sql } from "kysely";
import type {
  OrigenReporte,
  PrioridadIncidente,
  EstadoIncidente,
} from "@/lib/db/types";
import { generarCodigoSeguimientoNumerico } from "./aviso-incidente.utils";

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
  informanteTelefono?: string | null;
  origen_reporte?: OrigenReporte | string;
  asterisk_call_id?: string | null;
  asterisk_caller_phone?: string | null;
  operador_id?: string | null;
  creado_por_id?: string | null;
  estado?: EstadoIncidente | string;
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

export interface InformanteRow {
  id: string;
  rut: string | null;
  nombre: string | null;
  telefono: string | null;
  creado_en?: Date;
}

export async function buscarOCrearInformante(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trx: any,
  rutOrDatos: { rut: string; nombre: string; telefono?: string | null }
): Promise<InformanteRow>;
export async function buscarOCrearInformante(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trx: any,
  rutOrDatos: string | null,
  nombreParam?: string,
  telefonoParam?: string | null
): Promise<string>;
export async function buscarOCrearInformante(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trx: any,
  rutOrDatos: string | null | { rut: string; nombre: string; telefono?: string | null },
  nombreParam?: string,
  telefonoParam?: string | null
): Promise<InformanteRow | string> {
  let rut: string | null = null;
  let nombre = "";
  let telefono: string | null = null;

  if (typeof rutOrDatos === "object" && rutOrDatos !== null) {
    rut = rutOrDatos.rut;
    nombre = rutOrDatos.nombre;
    telefono = rutOrDatos.telefono ?? null;
  } else {
    rut = rutOrDatos;
    nombre = nombreParam ?? "";
    telefono = telefonoParam ?? null;
  }

  if (rut) {
    const existente = await trx
      .selectFrom("informante")
      .selectAll()
      .where("rut", "=", rut)
      .limit(1)
      .executeTakeFirst();

    if (existente) {
      if (existente.nombre !== nombre || existente.telefono !== (telefono ?? null)) {
        await trx
          .updateTable("informante")
          .set({
            nombre: nombre || existente.nombre,
            telefono: telefono ?? existente.telefono,
          })
          .where("id", "=", existente.id)
          .execute();
      }
      return typeof rutOrDatos === "string" || rutOrDatos === null ? existente.id : existente;
    }
  }

  const nuevo = await trx
    .insertInto("informante")
    .values({
      rut: rut ?? null,
      nombre,
      telefono,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return typeof rutOrDatos === "string" || rutOrDatos === null ? nuevo.id : nuevo;
}

/**
 * Inserta un nuevo reporte ciudadano en la tabla aviso_incidente asociada al informante
 * para su recepción y visualización inmediata en la Bandeja de Avisos del Call Center.
 */
export async function insertarIncidenteDesdeChatbot(datos: DatosInsertarIncidente) {
  return await db.transaction().execute(async (trx) => {
    const telefono = datos.informante_telefono ?? datos.informanteTelefono ?? null;
    const informante = await buscarOCrearInformante(trx, {
      rut: datos.informante_rut,
      nombre: datos.informante_nombre,
      telefono,
    });

    let avisoOriginalIdValido: string | null = null;
    if (datos.aviso_original_id) {
      const existeAviso = await trx
        .selectFrom("aviso_incidente")
        .select("id")
        .where("id", "=", datos.aviso_original_id)
        .executeTakeFirst();
      if (existeAviso) {
        avisoOriginalIdValido = existeAviso.id;
      }
    }

    const aviso = await trx
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
        informante_telefono: telefono,
        origen_reporte: (datos.origen_reporte as string) ?? "CHATBOT",
        estado: "PENDIENTE_VERIFICACION",
        es_duplicado: datos.es_duplicado ?? false,
        aviso_original_id: avisoOriginalIdValido,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...aviso,
      codigo: `AVISO-${aviso.codigo_seguimiento}`,
      prioridad: "MEDIA",
      informante_id: informante.id,
      informante_nombre: informante.nombre,
      informante_rut: informante.rut,
      informante_telefono: informante.telefono,
      es_duplicado: datos.es_duplicado ?? false,
      aviso_original_id: datos.aviso_original_id ?? null,
    };
  });
}

// Alias de retrocompatibilidad
export const insertarAvisoIncidente = insertarIncidenteDesdeChatbot;

/**
 * Busca si existe un aviso o incidente activo previo cercano con el mismo tipo de afectación
 * en una ventana de tiempo reciente utilizando PostGIS ST_DWithin (en metros).
 */
export async function buscarIncidenteDuplicadoCercano({
  tipoAfectacion,
  latitud,
  longitud,
  radioMetros = 300,
  horasVentana = 24,
}: ParametrosBusquedaDuplicado) {
  const puntoGeom = sql`ST_SetSRID(ST_MakePoint(${longitud}, ${latitud}), 4326)::geography`;

  // 1. Buscar en aviso_incidente activos (no descartados, recientes)
  const avisoDuplicado = await db
    .selectFrom("aviso_incidente")
    .select([
      "id",
      "codigo_seguimiento",
      "tipo_afectacion",
      "direccion_texto",
      "latitud",
      "longitud",
      "ubicacion",
      "descripcion",
      "informante_nombre",
      "informante_rut",
      "informante_telefono",
      "origen_reporte",
      "estado",
      "creado_en",
      "actualizado_en",
    ])
    .where("tipo_afectacion", "=", tipoAfectacion)
    .where("estado", "!=", "DESCARTADO")
    .where(
      "creado_en",
      ">=",
      sql<Date>`CURRENT_TIMESTAMP - (${horasVentana} || ' hours')::interval`
    )
    .where(
      sql<boolean>`ST_DWithin(
        ubicacion::geography,
        ${puntoGeom},
        ${radioMetros}
      )`
    )
    .orderBy("creado_en", "desc")
    .limit(1)
    .executeTakeFirst();

  if (avisoDuplicado) {
    return {
      id: avisoDuplicado.id,
      codigo: `AVISO-${avisoDuplicado.codigo_seguimiento}`,
      codigo_seguimiento: avisoDuplicado.codigo_seguimiento,
      tipo_afectacion: avisoDuplicado.tipo_afectacion,
      direccion_texto: avisoDuplicado.direccion_texto,
      latitud: avisoDuplicado.latitud,
      longitud: avisoDuplicado.longitud,
      ubicacion: avisoDuplicado.ubicacion,
      descripcion: avisoDuplicado.descripcion,
      informante_nombre: avisoDuplicado.informante_nombre,
      informante_rut: avisoDuplicado.informante_rut,
      informante_telefono: avisoDuplicado.informante_telefono,
      origen_reporte: avisoDuplicado.origen_reporte,
      estado: avisoDuplicado.estado,
      creado_en: avisoDuplicado.creado_en,
      actualizado_en: avisoDuplicado.actualizado_en,
    };
  }

  // 2. Buscar en incidentes activos
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

  if (duplicado) {
    return {
      ...duplicado,
      codigo_seguimiento: duplicado.codigo_seguimiento || duplicado.codigo || `INC-${duplicado.id.slice(0, 8)}`,
    };
  }

  return undefined;
}

// Alias de retrocompatibilidad
export const buscarAvisoDuplicadoCercano = buscarIncidenteDuplicadoCercano;

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
 * Consulta un incidente a partir de su código de seguimiento numérico de 8 dígitos.
 */
export async function buscarIncidentePorCodigoSeguimiento(codigoSeguimiento: string) {
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
    .orderBy("incidente.creado_en", "desc")
    .limit(1)
    .executeTakeFirst();

  if (aviso) {
    return {
      ...aviso,
      es_duplicado: false,
      aviso_original_id: null as string | null,
      incidente_id: aviso.id as string | null,
    };
  }

  // 2. Si aún no ha sido promovido a incidente formal, consultar en aviso_incidente
  const avisoPendiente = await db
    .selectFrom("aviso_incidente")
    .select([
      "id",
      "codigo_seguimiento",
      "tipo_afectacion",
      "direccion_texto",
      "latitud",
      "longitud",
      "ubicacion",
      "descripcion",
      "informante_nombre",
      "informante_rut",
      "informante_telefono",
      "origen_reporte",
      "estado",
      "es_duplicado",
      "aviso_original_id",
      "incidente_id",
      "creado_en",
      "actualizado_en",
    ])
    .where("codigo_seguimiento", "=", codigoSeguimiento)
    .orderBy("creado_en", "desc")
    .limit(1)
    .executeTakeFirst();

  if (!avisoPendiente) {
    return undefined;
  }

  return {
    id: avisoPendiente.id,
    codigo: `AVISO-${avisoPendiente.codigo_seguimiento}`,
    codigo_seguimiento: avisoPendiente.codigo_seguimiento,
    tipo_afectacion: avisoPendiente.tipo_afectacion,
    direccion_texto: avisoPendiente.direccion_texto,
    latitud: avisoPendiente.latitud,
    longitud: avisoPendiente.longitud,
    ubicacion: avisoPendiente.ubicacion,
    descripcion: avisoPendiente.descripcion,
    informante_nombre: avisoPendiente.informante_nombre,
    informante_rut: avisoPendiente.informante_rut,
    informante_telefono: avisoPendiente.informante_telefono,
    origen_reporte: avisoPendiente.origen_reporte,
    asterisk_call_id: null,
    asterisk_caller_phone: null,
    operador_id: null,
    estado: avisoPendiente.estado === "DESCARTADO" ? "NO_ABORDABLE" : "REPORTADO",
    creado_en: avisoPendiente.creado_en,
    actualizado_en: avisoPendiente.actualizado_en,
    es_duplicado: avisoPendiente.es_duplicado,
    aviso_original_id: avisoPendiente.aviso_original_id,
    incidente_id: avisoPendiente.incidente_id,
  };
}

// Alias de retrocompatibilidad
export const buscarAvisoPorCodigo = buscarIncidentePorCodigoSeguimiento;

/**
 * Actualiza el estado de un incidente por su ID o código de seguimiento.
 */
export async function actualizarEstadoIncidente(
  idOIdCodigo: string,
  nuevoEstado: EstadoIncidente
) {
  const fila = await db
    .updateTable("incidente")
    .set({
      estado: nuevoEstado,
      actualizado_en: sql`CURRENT_TIMESTAMP`,
    })
    .where((eb) =>
      eb.or([
        eb("id", "=", idOIdCodigo),
        eb("codigo_seguimiento", "=", idOIdCodigo),
      ])
    )
    .returningAll()
    .executeTakeFirst();

  return fila;
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
