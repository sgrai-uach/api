import { sql, type Kysely, type Transaction } from "kysely";
import { db } from "@/lib/db";
import { BadRequestError, ConflictError } from "@/modules/seguridad/errors";
import type {
  Database,
  EstadoEventoAtp,
  NivelAlertaEventoAtp,
  TipoAmenazaEventoAtp,
} from "@/lib/db/types";
import type {
  EntidadVinculadaEventoAtp,
  VinculosEventoAtp,
} from "./evento-atp.schema";

export interface DatosCrearEventoAtpRepo {
  codigo?: string;
  nombre: string;
  descripcion: string;
  tipoAmenaza: TipoAmenazaEventoAtp;
  nivelAlerta: NivelAlertaEventoAtp;
  fechaInicio: Date;
  fechaTermino: Date;
  delegacionIds: string[];
  creadoPorId: string;
}

export interface FilaEventoAtp {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo_amenaza: TipoAmenazaEventoAtp;
  nivel_alerta: NivelAlertaEventoAtp;
  fecha_inicio: Date;
  fecha_termino: Date;
  estado: EstadoEventoAtp;
  creado_por_id: string | null;
  creado_en: Date;
  actualizado_en: Date;
}

export interface FilaDelegacionEventoAtp {
  id: string;
  codigo: string;
  nombre: string;
}

export interface ResultadoInsercionEventoAtp {
  evento: FilaEventoAtp;
  delegaciones: FilaDelegacionEventoAtp[];
}

/**
 * Verifica cuáles delegaciones existen y están activas en el catálogo municipal.
 * Permite entregar un error de negocio claro antes de violar la FK.
 *
 * Puede ejecutarse dentro de una transacción (`trx`) para evitar que una
 * delegación sea desactivada entre la validación y el INSERT.
 */
export async function verificarDelegacionesExisten(
  delegacionIds: string[],
  trx?: Transaction<Database>
): Promise<{ existentes: string[]; faltantes: string[] }> {
  if (delegacionIds.length === 0) {
    return { existentes: [], faltantes: [] };
  }

  const filas = await (trx ?? db)
    .selectFrom("delegacion")
    .select("id")
    .where("id", "in", delegacionIds)
    .where("activo", "=", true)
    .execute();

  const existentes = filas.map((fila) => fila.id);
  const setExistentes = new Set(existentes);
  const faltantes = delegacionIds.filter((id) => !setExistentes.has(id));

  return { existentes, faltantes };
}

/**
 * Comprueba si ya existe un evento con el código indicado.
 */
export async function existeCodigoEventoAtp(
  codigo: string,
  trx?: Transaction<Database>
): Promise<boolean> {
  const query = (trx ?? db)
    .selectFrom("evento_atp")
    .select("id")
    .where("codigo", "=", codigo)
    .limit(1);

  const fila = await query.executeTakeFirst();
  return Boolean(fila);
}

/**
 * Detecta la violación de unicidad del código del Evento ATP
 * (`SQLSTATE 23505` sobre `evento_atp_codigo_key`).
 */
export function esViolacionCodigoEventoAtpUnico(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const detalle = error as {
    code?: string;
    constraint?: string;
  };

  if (detalle.code !== "23505") {
    return false;
  }

  if (detalle.constraint) {
    return detalle.constraint === "evento_atp_codigo_key";
  }

  return true;
}

/**
 * Genera el siguiente correlativo anual ATP-YYYY-#### dentro de una transacción.
 *
 * Se usa un advisory lock por año para serializar la generación y evitar
 * colisiones cuando dos administradores crean eventos concurrentemente.
 *
 * Solo se consideran los códigos con sufijo estrictamente numérico de al menos
 * cuatro dígitos (`ATP-AAAA-####`), de modo que códigos manuales como
 * `ATP-2026-MAYO` o `ATP-2026-99` no alteran la secuencia ni colisionan.
 */
export async function generarSiguienteCodigoEventoAtp(
  trx: Transaction<Database>,
  anio: number = new Date().getFullYear()
): Promise<string> {
  await sql`
    SELECT pg_advisory_xact_lock(hashtext(${`evento_atp_codigo_${anio}`})::bigint);
  `.execute(trx);

  const prefijo = `ATP-${anio}-`;
  const patron = `^${prefijo}[0-9]{4,15}$`;

  const resultado = await sql<{ maximo: string | null }>`
    SELECT COALESCE(MAX(SUBSTRING(codigo FROM ${prefijo.length + 1})::bigint), 0) AS maximo
    FROM evento_atp
    WHERE codigo ~ ${patron}
  `.execute(trx);

  const maximo = Number(resultado.rows[0]?.maximo ?? 0);
  let secuencia = Number.isSafeInteger(maximo) && maximo > 0 ? maximo + 1 : 1;

  let candidato = `${prefijo}${String(secuencia).padStart(4, "0")}`;

  // Defensa final: si el correlativo calculado ya existe (por ejemplo porque fue
  // registrado manualmente con el mismo formato), se avanza hasta obtener uno
  // libre dentro de la misma transacción.
  while (await existeCodigoEventoAtp(candidato, trx)) {
    secuencia += 1;
    candidato = `${prefijo}${String(secuencia).padStart(4, "0")}`;
  }

  return candidato;
}

/**
 * Inserta un Evento ATP y sus delegaciones afectadas en una sola transacción
 * PostgreSQL. Si falla cualquier inserción, se revierte todo el conjunto.
 *
 * Dentro de la misma transacción se:
 * - validan las delegaciones activas existentes;
 * - verifica la unicidad del código manual (con advisory lock por código);
 * - genera el correlativo automático (con advisory lock por año);
 * - captura `SQLSTATE 23505` para responder `409 Conflict` en vez de `500`.
 */
export async function insertarEventoAtpConDelegaciones(
  datos: DatosCrearEventoAtpRepo
): Promise<ResultadoInsercionEventoAtp> {
  return await db.transaction().execute(async (trx) => {
    const codigoManual = datos.codigo?.trim().toUpperCase() || undefined;

    // 1. Validar que las delegaciones seleccionadas existan y estén activas
    const { faltantes } = await verificarDelegacionesExisten(
      datos.delegacionIds,
      trx
    );

    if (faltantes.length > 0) {
      throw new BadRequestError(
        `Las siguientes delegaciones no existen en el sistema: ${faltantes.join(", ")}.`
      );
    }

    // 2. Determinar el código único del evento dentro de la transacción
    let codigo: string;

    if (codigoManual) {
      await sql`
        SELECT pg_advisory_xact_lock(hashtext(${`evento_atp_codigo_${codigoManual}`})::bigint);
      `.execute(trx);

      if (await existeCodigoEventoAtp(codigoManual, trx)) {
        throw new ConflictError(
          `Ya existe un Evento ATP registrado con el código '${codigoManual}'.`
        );
      }

      codigo = codigoManual;
    } else {
      codigo = await generarSiguienteCodigoEventoAtp(trx);
    }

    // 3. Insertar el evento capturando la violación de unicidad por código
    let evento: FilaEventoAtp;

    try {
      const fila = await trx
        .insertInto("evento_atp")
        .values({
          codigo,
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          tipo_amenaza: datos.tipoAmenaza,
          nivel_alerta: datos.nivelAlerta,
          fecha_inicio: datos.fechaInicio,
          fecha_termino: datos.fechaTermino,
          estado: "ACTIVO",
          creado_por_id: datos.creadoPorId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      evento = fila as unknown as FilaEventoAtp;
    } catch (error) {
      if (esViolacionCodigoEventoAtpUnico(error)) {
        throw new ConflictError(
          `Ya existe un Evento ATP registrado con el código '${codigo}'.`
        );
      }

      throw error;
    }

    if (datos.delegacionIds.length > 0) {
      await trx
        .insertInto("evento_atp_delegacion")
        .values(
          datos.delegacionIds.map((delegacionId) => ({
            evento_atp_id: evento.id,
            delegacion_id: delegacionId,
          }))
        )
        .execute();
    }

    const delegaciones = await trx
      .selectFrom("evento_atp_delegacion as ed")
      .innerJoin("delegacion as d", "d.id", "ed.delegacion_id")
      .select([
        "d.id as id",
        "d.codigo as codigo",
        "d.nombre as nombre",
      ])
      .where("ed.evento_atp_id", "=", evento.id)
      .orderBy("d.nombre", "asc")
      .execute();

    return {
      evento,
      delegaciones: delegaciones as unknown as FilaDelegacionEventoAtp[],
    };
  });
}

/**
 * Obtiene un Evento ATP con sus delegaciones. Útil para H60 y para pruebas.
 */
export async function obtenerEventoAtpPorId(
  id: string
): Promise<ResultadoInsercionEventoAtp | null> {
  const evento = await db
    .selectFrom("evento_atp")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();

  if (!evento) {
    return null;
  }

  const delegaciones = await db
    .selectFrom("evento_atp_delegacion as ed")
    .innerJoin("delegacion as d", "d.id", "ed.delegacion_id")
    .select(["d.id as id", "d.codigo as codigo", "d.nombre as nombre"])
    .where("ed.evento_atp_id", "=", id)
    .orderBy("d.nombre", "asc")
    .execute();

  return {
    evento: evento as unknown as FilaEventoAtp,
    delegaciones: delegaciones as unknown as FilaDelegacionEventoAtp[],
  };
}

/* ==========================================================================
   H60 - Catálogo, detalle y vinculaciones
   ========================================================================== */

export interface FiltrosListarEventosAtp {
  estado?: EstadoEventoAtp;
  delegacionId?: string;
  busqueda?: string;
}

export interface OpcionesPaginacionAtp {
  page: number;
  limit: number;
}

/**
 * Obtiene las delegaciones de un conjunto de Eventos ATP agrupadas por evento.
 */
async function obtenerDelegacionesPorEvento(
  eventoIds: string[]
): Promise<Map<string, FilaDelegacionEventoAtp[]>> {
  const mapa = new Map<string, FilaDelegacionEventoAtp[]>();
  if (eventoIds.length === 0) return mapa;

  const filas = await db
    .selectFrom("evento_atp_delegacion as ed")
    .innerJoin("delegacion as d", "d.id", "ed.delegacion_id")
    .select([
      "ed.evento_atp_id as evento_atp_id",
      "d.id as id",
      "d.codigo as codigo",
      "d.nombre as nombre",
    ])
    .where("ed.evento_atp_id", "in", eventoIds)
    .orderBy("d.nombre", "asc")
    .execute();

  for (const fila of filas) {
    const actual = mapa.get(fila.evento_atp_id) ?? [];
    actual.push({
      id: fila.id,
      codigo: fila.codigo ?? "",
      nombre: fila.nombre ?? "",
    });
    mapa.set(fila.evento_atp_id, actual);
  }

  return mapa;
}

/**
 * Lista Eventos ATP con filtros y paginación.
 */
export async function listarEventosAtpPaginadosRepo(
  filtros: FiltrosListarEventosAtp,
  paginacion: OpcionesPaginacionAtp
) {
  const construirBase = () => {
    let query = db.selectFrom("evento_atp");

    if (filtros.estado) {
      query = query.where("evento_atp.estado", "=", filtros.estado);
    }

    if (filtros.delegacionId) {
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom("evento_atp_delegacion as ed")
            .select("ed.id")
            .whereRef("ed.evento_atp_id", "=", "evento_atp.id")
            .where("ed.delegacion_id", "=", filtros.delegacionId!)
        )
      );
    }

    if (filtros.busqueda && filtros.busqueda.trim() !== "") {
      const patron = `%${filtros.busqueda.trim()}%`;
      query = query.where((eb) =>
        eb.or([
          eb("evento_atp.codigo", "ilike", patron),
          eb("evento_atp.nombre", "ilike", patron),
        ])
      );
    }

    return query;
  };

  const totalFila = await construirBase()
    .select(sql<number>`count(*)::int`.as("total"))
    .executeTakeFirst();

  const total = Number(totalFila?.total ?? 0);

  const eventos = await construirBase()
    .selectAll()
    .orderBy("evento_atp.fecha_inicio", "desc")
    .limit(paginacion.limit)
    .offset((paginacion.page - 1) * paginacion.limit)
    .execute();

  const ids = eventos.map((evento) => evento.id);
  const delegaciones = await obtenerDelegacionesPorEvento(ids);

  return {
    eventos: eventos as unknown as FilaEventoAtp[],
    delegaciones,
    total,
  };
}

/**
 * Cuenta las entidades vinculadas para un conjunto de Eventos ATP en una sola
 * pasada por tabla (GROUP BY), evitando el patrón N+1 del listado.
 */
export async function contarVinculosPorEventoAtp(
  eventoAtpIds: string[]
): Promise<Map<string, number>> {
  const conteos = new Map<string, number>();

  if (eventoAtpIds.length === 0) {
    return conteos;
  }

  const [incidentes, prevencion, recuperaciones, asistencia] =
    await Promise.all([
      db
        .selectFrom("incidente")
        .select([
          "evento_atp_id",
          sql<number>`count(*)::int`.as("total"),
        ])
        .where("evento_atp_id", "in", eventoAtpIds)
        .groupBy("evento_atp_id")
        .execute(),
      db
        .selectFrom("evento_prevencion")
        .select([
          "evento_atp_id",
          sql<number>`count(*)::int`.as("total"),
        ])
        .where("evento_atp_id", "in", eventoAtpIds)
        .groupBy("evento_atp_id")
        .execute(),
      db
        .selectFrom("recuperacion")
        .select([
          "evento_atp_id",
          sql<number>`count(*)::int`.as("total"),
        ])
        .where("evento_atp_id", "in", eventoAtpIds)
        .groupBy("evento_atp_id")
        .execute(),
      db
        .selectFrom("evento_asistencia_social")
        .select([
          "evento_atp_id",
          sql<number>`count(*)::int`.as("total"),
        ])
        .where("evento_atp_id", "in", eventoAtpIds)
        .where("eliminado_en", "is", null)
        .groupBy("evento_atp_id")
        .execute(),
    ]);

  for (const fila of [
    ...incidentes,
    ...prevencion,
    ...recuperaciones,
    ...asistencia,
  ]) {
    if (!fila.evento_atp_id) continue;
    conteos.set(
      fila.evento_atp_id,
      (conteos.get(fila.evento_atp_id) ?? 0) + Number(fila.total ?? 0)
    );
  }

  return conteos;
}

/**
 * Cuenta las entidades vinculadas a un Evento ATP.
 */
export async function contarVinculosEventoAtp(
  eventoAtpId: string
): Promise<number> {
  const conteos = await contarVinculosPorEventoAtp([eventoAtpId]);
  return conteos.get(eventoAtpId) ?? 0;
}

/**
 * Obtiene las entidades vinculadas a un Evento ATP agrupadas por tipo.
 */
export async function obtenerVinculosEventoAtp(
  eventoAtpId: string
): Promise<VinculosEventoAtp> {
  const [incidentes, prevencion, recuperaciones, asistencia] =
    await Promise.all([
      db
        .selectFrom("incidente")
        .select(["id", "codigo", "tipo_afectacion", "estado", "creado_en"])
        .where("evento_atp_id", "=", eventoAtpId)
        .orderBy("creado_en", "desc")
        .execute(),
      db
        .selectFrom("evento_prevencion")
        .select(["id", "codigo", "nombre", "estado", "creado_en"])
        .where("evento_atp_id", "=", eventoAtpId)
        .orderBy("creado_en", "desc")
        .execute(),
      db
        .selectFrom("recuperacion")
        .select(["id", "codigo", "nombre", "estado", "creado_en"])
        .where("evento_atp_id", "=", eventoAtpId)
        .orderBy("creado_en", "desc")
        .execute(),
      db
        .selectFrom("evento_asistencia_social")
        .select(["id", "codigo", "tipo_afectacion", "estado", "creado_en"])
        .where("evento_atp_id", "=", eventoAtpId)
        .where("eliminado_en", "is", null)
        .orderBy("creado_en", "desc")
        .execute(),
    ]);

  const mapear = (
    fila: {
      id: string;
      codigo: string;
      estado: string | null;
      creado_en: Date | string;
    },
    nombre: string | null
  ): EntidadVinculadaEventoAtp => ({
    id: fila.id,
    codigo: fila.codigo,
    nombre,
    estado: fila.estado ?? null,
    creadoEn:
      fila.creado_en instanceof Date
        ? fila.creado_en.toISOString()
        : new Date(fila.creado_en).toISOString(),
  });

  return {
    incidentes: incidentes.map((fila) =>
      mapear(fila, fila.tipo_afectacion ?? null)
    ),
    eventosPrevencion: prevencion.map((fila) => mapear(fila, fila.nombre ?? null)),
    recuperaciones: recuperaciones.map((fila) => mapear(fila, fila.nombre ?? null)),
    eventosAsistenciaSocial: asistencia.map((fila) =>
      mapear(fila, fila.tipo_afectacion ?? null)
    ),
  };
}


/**
 * Obtiene el estado actual de un Evento ATP sin bloquear la fila.
 * Se usa al crear entidades que pueden vincularse opcionalmente a un ATP.
 */
export async function obtenerEstadoEventoAtp(
  id: string,
  executor: Kysely<Database> = db
): Promise<{ id: string; codigo: string; estado: EstadoEventoAtp } | null> {
  const fila = await executor
    .selectFrom("evento_atp")
    .select(["id", "codigo", "estado"])
    .where("id", "=", id)
    .forShare()
    .executeTakeFirst();

  return fila ?? null;
}
