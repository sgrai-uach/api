import { db } from "@/lib/db";
import { sql } from "kysely";
import { NotFoundError, ForbiddenError } from "@/modules/seguridad/errors";
import type {
  EstadoNotificacionMision,
  NotificacionMisionDetalle,
  MisionPendienteTerreno,
} from "./notificacion-mision.schema";

const PRIORIDAD_ESTADO: Record<EstadoNotificacionMision, number> = {
  PENDIENTE_ENVIO: 0,
  ENVIADA: 1,
  RECIBIDA: 2,
  LEIDA: 3,
};

function formatearIso(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  return typeof fecha === "string" ? new Date(fecha).toISOString() : fecha.toISOString();
}

/**
 * Consulta la patrulla verificadora activa a la que pertenece un usuario (como líder o integrante).
 */
export async function obtenerPatrullaDeUsuarioRepo(
  usuarioId: string
): Promise<{ id: string; nombre: string } | null> {
  // 1. Verificar si es líder directo
  const lider = await db
    .selectFrom("patrulla_verificadora")
    .select(["id", "nombre"])
    .where("usuario_lider_id", "=", usuarioId)
    .where("eliminado_en", "is", null)
    .where("activo", "=", true)
    .executeTakeFirst();

  if (lider) {
    return lider;
  }

  // 2. Verificar si es integrante activo en patrulla_personal
  const integrante = await db
    .selectFrom("patrulla_personal")
    .innerJoin("patrulla_verificadora", "patrulla_verificadora.id", "patrulla_personal.patrulla_id")
    .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
    .select(["patrulla_verificadora.id", "patrulla_verificadora.nombre"])
    .where("personal.usuario_id", "=", usuarioId)
    .where("patrulla_verificadora.eliminado_en", "is", null)
    .where("patrulla_verificadora.activo", "=", true)
    .executeTakeFirst();

  return integrante ?? null;
}

/**
 * Inserta el registro inicial de notificación en estado PENDIENTE_ENVIO.
 */
export async function crearNotificacionMisionRepo(
  misionId: string,
  patrullaId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trx?: any
): Promise<NotificacionMisionDetalle> {
  const executor = trx || db;

  const fila = await executor
    .insertInto("notificaciones_mision")
    .values({
      mision_id: misionId,
      patrulla_id: patrullaId,
      estado: "PENDIENTE_ENVIO",
      intentos_envio: 0,
      creada_at: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    id: fila.id,
    misionId: fila.mision_id,
    patrullaId: fila.patrulla_id,
    estado: fila.estado as EstadoNotificacionMision,
    intentosEnvio: Number(fila.intentos_envio),
    creadaAt: formatearIso(fila.creada_at) || new Date().toISOString(),
    enviadaAt: formatearIso(fila.enviada_at),
    recibidaAt: formatearIso(fila.recibida_at),
    leidaAt: formatearIso(fila.leida_at),
  };
}

/**
 * Actualiza la notificación al estado ENVIADA al ser despachada por el broker de sockets.
 */
export async function marcarNotificacionEnviadaRepo(
  notificacionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trx?: any
): Promise<NotificacionMisionDetalle | null> {
  const executor = trx || db;

  const fila = await executor
    .updateTable("notificaciones_mision")
    .set({
      estado: "ENVIADA",
      enviada_at: sql`COALESCE(enviada_at, CURRENT_TIMESTAMP)`,
      intentos_envio: sql`intentos_envio + 1`,
    })
    .where("id", "=", notificacionId)
    .where("estado", "=", "PENDIENTE_ENVIO")
    .returningAll()
    .executeTakeFirst();

  if (!fila) {
    const actual = await executor
      .selectFrom("notificaciones_mision")
      .selectAll()
      .where("id", "=", notificacionId)
      .executeTakeFirst();

    if (!actual) return null;

    return {
      id: actual.id,
      misionId: actual.mision_id,
      patrullaId: actual.patrulla_id,
      estado: actual.estado as EstadoNotificacionMision,
      intentosEnvio: Number(actual.intentos_envio),
      creadaAt: formatearIso(actual.creada_at) || new Date().toISOString(),
      enviadaAt: formatearIso(actual.enviada_at),
      recibidaAt: formatearIso(actual.recibida_at),
      leidaAt: formatearIso(actual.leida_at),
    };
  }

  return {
    id: fila.id,
    misionId: fila.mision_id,
    patrullaId: fila.patrulla_id,
    estado: fila.estado as EstadoNotificacionMision,
    intentosEnvio: Number(fila.intentos_envio),
    creadaAt: formatearIso(fila.creada_at) || new Date().toISOString(),
    enviadaAt: formatearIso(fila.enviada_at),
    recibidaAt: formatearIso(fila.recibida_at),
    leidaAt: formatearIso(fila.leida_at),
  };
}

/**
 * Actualiza de forma idempotente el estado de la notificación (RECIBIDA o LEIDA)
 * validando que pertenezca a la patrulla del usuario autenticado.
 */
export async function actualizarEstadoNotificacionIdempotenteRepo(
  notificacionId: string,
  nuevoEstado: "RECIBIDA" | "LEIDA",
  usuarioId: string,
  esAdmin = false
): Promise<NotificacionMisionDetalle> {
  return await db.transaction().execute(async (trx) => {
    // 1. Obtener la notificación existente
    const notificacion = await trx
      .selectFrom("notificaciones_mision")
      .selectAll()
      .where("id", "=", notificacionId)
      .executeTakeFirst();

    if (!notificacion) {
      throw new NotFoundError(
        `Notificación con ID '${notificacionId}' no encontrada.`
      );
    }

    // 2. Validar pertenencia a la patrulla si no es Administrador
    if (!esAdmin) {
      const patrulla = await trx
        .selectFrom("patrulla_verificadora")
        .select(["id", "usuario_lider_id"])
        .where("id", "=", notificacion.patrulla_id)
        .executeTakeFirst();

      const esLider = patrulla?.usuario_lider_id === usuarioId;

      let esIntegrante = false;
      if (!esLider) {
        const integrante = await trx
          .selectFrom("patrulla_personal")
          .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
          .select("patrulla_personal.id")
          .where("patrulla_personal.patrulla_id", "=", notificacion.patrulla_id)
          .where("personal.usuario_id", "=", usuarioId)
          .executeTakeFirst();

        esIntegrante = Boolean(integrante);
      }

      if (!esLider && !esIntegrante) {
        throw new ForbiddenError(
          "No está autorizado para confirmar notificaciones asignadas a otra patrulla verificadora."
        );
      }
    }

    const estadoActual = notificacion.estado as EstadoNotificacionMision;

    // 3. Regla de Idempotencia y Anti-retroceso:
    // Si el nuevo estado es igual o menor en jerarquía al actual, no alteramos timestamps ni estado.
    if (PRIORIDAD_ESTADO[nuevoEstado] <= PRIORIDAD_ESTADO[estadoActual]) {
      return {
        id: notificacion.id,
        misionId: notificacion.mision_id,
        patrullaId: notificacion.patrulla_id,
        estado: estadoActual,
        intentosEnvio: Number(notificacion.intentos_envio),
        creadaAt: formatearIso(notificacion.creada_at) || new Date().toISOString(),
        enviadaAt: formatearIso(notificacion.enviada_at),
        recibidaAt: formatearIso(notificacion.recibida_at),
        leidaAt: formatearIso(notificacion.leida_at),
      };
    }

    // 4. Aplicar transición progresiva
    const updates: Record<string, unknown> = {
      estado: nuevoEstado,
      enviada_at: sql`COALESCE(enviada_at, CURRENT_TIMESTAMP)`,
    };

    if (nuevoEstado === "RECIBIDA") {
      updates.recibida_at = sql`COALESCE(recibida_at, CURRENT_TIMESTAMP)`;
    } else if (nuevoEstado === "LEIDA") {
      updates.recibida_at = sql`COALESCE(recibida_at, CURRENT_TIMESTAMP)`;
      updates.leida_at = sql`COALESCE(leida_at, CURRENT_TIMESTAMP)`;
    }

    const actualizada = await trx
      .updateTable("notificaciones_mision")
      .set(updates)
      .where("id", "=", notificacionId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: actualizada.id,
      misionId: actualizada.mision_id,
      patrullaId: actualizada.patrulla_id,
      estado: actualizada.estado as EstadoNotificacionMision,
      intentosEnvio: Number(actualizada.intentos_envio),
      creadaAt: formatearIso(actualizada.creada_at) || new Date().toISOString(),
      enviadaAt: formatearIso(actualizada.enviada_at),
      recibidaAt: formatearIso(actualizada.recibida_at),
      leidaAt: formatearIso(actualizada.leida_at),
    };
  });
}

/**
 * Consulta las misiones pendientes con notificaciones en PENDIENTE_ENVIO o ENVIADA para reconciliación offline.
 */
export async function listarMisionesPendientesTerrenoRepo(
  patrullaId: string
): Promise<MisionPendienteTerreno[]> {
  const filas = await db
    .selectFrom("notificaciones_mision")
    .innerJoin("mision", "mision.id", "notificaciones_mision.mision_id")
    .leftJoin("incidente", "incidente.id", "mision.incidente_id")
    .select([
      "notificaciones_mision.id as notificacion_id",
      "notificaciones_mision.estado as notificacion_estado",
      "notificaciones_mision.patrulla_id",
      "notificaciones_mision.creada_at",
      "notificaciones_mision.enviada_at",
      "mision.id as mision_id",
      "mision.codigo as mision_codigo",
      "mision.titulo as mision_titulo",
      "mision.descripcion as mision_descripcion",
      "mision.tipo_mision",
      "mision.prioridad as mision_prioridad",
      "mision.estado as mision_estado",
      "incidente.id as incidente_id",
      "incidente.codigo as incidente_codigo",
      "incidente.folio as incidente_folio",
      "incidente.tipo_afectacion as incidente_tipo_afectacion",
      "incidente.direccion_texto as incidente_direccion",
      "incidente.latitud as incidente_latitud",
      "incidente.longitud as incidente_longitud",
    ])
    .where("notificaciones_mision.patrulla_id", "=", patrullaId)
    .where("notificaciones_mision.estado", "in", ["PENDIENTE_ENVIO", "ENVIADA"])
    .where("mision.estado", "=", "DESPACHADA")
    .orderBy("notificaciones_mision.creada_at", "asc")
    .execute();

  return filas.map((f) => ({
    notificacionId: f.notificacion_id,
    misionId: f.mision_id,
    codigoMision: f.mision_codigo,
    titulo: f.mision_titulo,
    descripcion: f.mision_descripcion ?? null,
    tipoMision: f.tipo_mision,
    prioridad: f.mision_prioridad,
    estadoMision: f.mision_estado,
    estadoNotificacion: f.notificacion_estado as EstadoNotificacionMision,
    patrullaId: f.patrulla_id,
    incidenteId: f.incidente_id ?? null,
    incidenteCodigo: f.incidente_codigo ?? null,
    incidenteFolio: f.incidente_folio ?? null,
    tipoAfectacion: f.incidente_tipo_afectacion ?? null,
    direccion: f.incidente_direccion ?? null,
    latitud: f.incidente_latitud !== null ? Number(f.incidente_latitud) : null,
    longitud: f.incidente_longitud !== null ? Number(f.incidente_longitud) : null,
    creadaAt: formatearIso(f.creada_at) || new Date().toISOString(),
    enviadaAt: formatearIso(f.enviada_at),
  }));
}

