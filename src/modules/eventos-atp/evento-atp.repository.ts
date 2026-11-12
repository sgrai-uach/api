import { sql, type Transaction } from "kysely";
import { db } from "@/lib/db";
import type {
  Database,
  EstadoEventoAtp,
  NivelAlertaEventoAtp,
  TipoAmenazaEventoAtp,
} from "@/lib/db/types";

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
 * Verifica cuáles delegaciones existen en el catálogo municipal.
 * Permite entregar un error de negocio claro antes de violar la FK.
 */
export async function verificarDelegacionesExisten(
  delegacionIds: string[]
): Promise<{ existentes: string[]; faltantes: string[] }> {
  if (delegacionIds.length === 0) {
    return { existentes: [], faltantes: [] };
  }

  const filas = await db
    .selectFrom("delegacion")
    .select("id")
    .where("id", "in", delegacionIds)
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
 * Genera el siguiente correlativo anual ATP-YYYY-#### dentro de una transacción.
 *
 * Se usa un advisory lock por año para serializar la generación y evitar
 * colisiones cuando dos administradores crean eventos concurrentemente.
 */
export async function generarSiguienteCodigoEventoAtp(
  trx: Transaction<Database>,
  anio: number = new Date().getFullYear()
): Promise<string> {
  await sql`
    SELECT pg_advisory_xact_lock(hashtext(${`evento_atp_codigo_${anio}`})::bigint);
  `.execute(trx);

  const prefijo = `ATP-${anio}-`;

  const ultimaFila = await trx
    .selectFrom("evento_atp")
    .select("codigo")
    .where("codigo", "like", `${prefijo}%`)
    .orderBy("codigo", "desc")
    .limit(1)
    .executeTakeFirst();

  const ultimaSecuencia = ultimaFila
    ? Number.parseInt(ultimaFila.codigo.slice(prefijo.length), 10)
    : 0;

  const siguienteSecuencia = Number.isNaN(ultimaSecuencia)
    ? 1
    : ultimaSecuencia + 1;

  return `${prefijo}${String(siguienteSecuencia).padStart(4, "0")}`;
}

/**
 * Inserta un Evento ATP y sus delegaciones afectadas en una sola transacción
 * PostgreSQL. Si falla cualquier inserción, se revierte todo el conjunto.
 */
export async function insertarEventoAtpConDelegaciones(
  datos: DatosCrearEventoAtpRepo
): Promise<ResultadoInsercionEventoAtp> {
  return await db.transaction().execute(async (trx) => {
    const codigo =
      datos.codigo?.trim().toUpperCase() ??
      (await generarSiguienteCodigoEventoAtp(trx));

    const evento = await trx
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
      evento: evento as unknown as FilaEventoAtp,
      delegaciones: delegaciones as FilaDelegacionEventoAtp[],
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
    delegaciones: delegaciones as FilaDelegacionEventoAtp[],
  };
}
