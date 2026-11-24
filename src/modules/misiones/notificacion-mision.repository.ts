import { db } from "@/lib/db";
import { sql } from "kysely";
import { NotFoundError, ForbiddenError } from "@/modules/seguridad/errors";
import type {
  EstadoNotificacionMision,
  NotificacionMisionDetalle,
  MisionPendienteTerreno,
  TipoUnidadNotificacion,
} from "./notificacion-mision.schema";

function mapearDetalleNotificacion(
  fila: {
    id: string;
    mision_id: string;
    patrulla_id: string | null;
    cuadrilla_id?: string | null;
    mision_incidente_id?: string | null;
    estado: string;
    intentos_envio: number | string;
    creada_at: Date | string;
    enviada_at: Date | string | null;
    recibida_at: Date | string | null;
    leida_at: Date | string | null;
  },
  incidenteIdFallback?: string | null
): NotificacionMisionDetalle {
  const patrullaId = fila.patrulla_id ?? null;
  const cuadrillaId = fila.cuadrilla_id ?? null;
  const tipoUnidad: TipoUnidadNotificacion = cuadrillaId ? "CUADRILLA" : "PATRULLA";

  return {
    id: fila.id,
    misionId: fila.mision_id,
    ...(fila.mision_incidente_id !== undefined || incidenteIdFallback !== undefined
      ? { incidenteId: fila.mision_incidente_id ?? incidenteIdFallback ?? null }
      : {}),
    patrullaId,
    cuadrillaId,
    tipoUnidad,
    estado: fila.estado as EstadoNotificacionMision,
    intentosEnvio: Number(fila.intentos_envio),
    creadaAt: formatearIso(fila.creada_at) || new Date().toISOString(),
    enviadaAt: formatearIso(fila.enviada_at),
    recibidaAt: formatearIso(fila.recibida_at),
    leidaAt: formatearIso(fila.leida_at),
  };
}

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
 * Consulta la cuadrilla operativa activa a la que pertenece un usuario (como delegado o integrante).
 */
export async function obtenerCuadrillaDeUsuarioRepo(
  usuarioId: string
): Promise<{ id: string; nombre: string } | null> {
  // 1. Verificar si es delegado titular de la cuadrilla
  const delegado = await db
    .selectFrom("cuadrilla")
    .select(["id", "nombre"])
    .where("usuario_delegado_id", "=", usuarioId)
    .where("eliminado_en", "is", null)
    .where("activo", "=", true)
    .executeTakeFirst();

  if (delegado) {
    return delegado;
  }

  // 2. Verificar si es integrante activo en cuadrilla_personal
  const integrante = await db
    .selectFrom("cuadrilla_personal")
    .innerJoin("cuadrilla", "cuadrilla.id", "cuadrilla_personal.cuadrilla_id")
    .innerJoin("personal", "personal.id", "cuadrilla_personal.personal_id")
    .select(["cuadrilla.id", "cuadrilla.nombre"])
    .where("personal.usuario_id", "=", usuarioId)
    .where("cuadrilla_personal.activo", "=", true)
    .where("cuadrilla_personal.desvinculado_en", "is", null)
    .where("cuadrilla.eliminado_en", "is", null)
    .where("cuadrilla.activo", "=", true)
    .executeTakeFirst();

  return integrante ?? null;
}

/**
 * Inserta el registro inicial de notificación en estado PENDIENTE_ENVIO
 * para una patrulla verificadora o una cuadrilla operativa.
 */
export async function crearNotificacionMisionRepo(
  misionId: string,
  destino: string | { patrullaId?: string | null; cuadrillaId?: string | null },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trx?: any
): Promise<NotificacionMisionDetalle> {
  const executor = trx || db;
  const patrullaId = typeof destino === "string" ? destino : destino.patrullaId ?? null;
  const cuadrillaId = typeof destino === "string" ? null : destino.cuadrillaId ?? null;

  const fila = await executor
    .insertInto("notificaciones_mision")
    .values({
      mision_id: misionId,
      patrulla_id: patrullaId,
      ...(cuadrillaId ? { cuadrilla_id: cuadrillaId } : {}),
      estado: "PENDIENTE_ENVIO",
      intentos_envio: 0,
      creada_at: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return mapearDetalleNotificacion(fila);
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

    return mapearDetalleNotificacion(actual);
  }

  return mapearDetalleNotificacion(fila);
}

/**
 * Actualiza de forma idempotente el estado de la notificación (RECIBIDA o LEIDA)
 * validando que pertenezca a la patrulla o cuadrilla del usuario autenticado.
 */
export async function actualizarEstadoNotificacionIdempotenteRepo(
  notificacionId: string,
  nuevoEstado: "RECIBIDA" | "LEIDA",
  usuarioId: string,
  esAdmin = false
): Promise<NotificacionMisionDetalle> {
  return await db.transaction().execute(async (trx) => {
    // 1. Obtener la notificación existente junto al incidenteId asociado (en una única lectura)
    const notificacion = await trx
      .selectFrom("notificaciones_mision")
      .leftJoin("mision", "mision.id", "notificaciones_mision.mision_id")
      .selectAll("notificaciones_mision")
      .select("mision.incidente_id as mision_incidente_id")
      .where("notificaciones_mision.id", "=", notificacionId)
      .executeTakeFirst();

    if (!notificacion) {
      throw new NotFoundError(
        `Notificación con ID '${notificacionId}' no encontrada.`
      );
    }

    const incidenteId =
      (notificacion as { mision_incidente_id?: string | null }).mision_incidente_id ?? null;

    // 2. Validar pertenencia a la patrulla o cuadrilla destinataria si no es Administrador
    if (!esAdmin) {
      if (notificacion.cuadrilla_id) {
        const cuadrilla = await trx
          .selectFrom("cuadrilla")
          .select(["id", "usuario_delegado_id"])
          .where("id", "=", notificacion.cuadrilla_id)
          .executeTakeFirst();

        const esDelegado = cuadrilla?.usuario_delegado_id === usuarioId;

        let esIntegrante = false;
        if (!esDelegado) {
          const integrante = await trx
            .selectFrom("cuadrilla_personal")
            .innerJoin("personal", "personal.id", "cuadrilla_personal.personal_id")
            .select("cuadrilla_personal.id")
            .where("cuadrilla_personal.cuadrilla_id", "=", notificacion.cuadrilla_id)
            .where("cuadrilla_personal.activo", "=", true)
            .where("cuadrilla_personal.desvinculado_en", "is", null)
            .where("personal.usuario_id", "=", usuarioId)
            .executeTakeFirst();

          esIntegrante = Boolean(integrante);
        }

        if (!esDelegado && !esIntegrante) {
          throw new ForbiddenError(
            "No está autorizado para confirmar notificaciones asignadas a otra cuadrilla operativa."
          );
        }
      } else if (notificacion.patrulla_id) {
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
    }

    const estadoActual = notificacion.estado as EstadoNotificacionMision;

    // 3. Regla de Idempotencia y Anti-retroceso:
    // Si el nuevo estado es igual o menor en jerarquía al actual, no alteramos timestamps ni estado.
    if (PRIORIDAD_ESTADO[nuevoEstado] <= PRIORIDAD_ESTADO[estadoActual]) {
      return mapearDetalleNotificacion(notificacion, incidenteId);
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

    return mapearDetalleNotificacion(actualizada, incidenteId);
  });
}

/**
 * Consulta las misiones pendientes con notificaciones en PENDIENTE_ENVIO o ENVIADA para reconciliación offline.
 */
export async function listarMisionesPendientesTerrenoRepo(
  destino: string | { patrullaId?: string; cuadrillaId?: string }
): Promise<MisionPendienteTerreno[]> {
  const patrullaId = typeof destino === "string" ? destino : destino.patrullaId;
  const cuadrillaId = typeof destino === "string" ? undefined : destino.cuadrillaId;

  let consulta = db
    .selectFrom("notificaciones_mision")
    .innerJoin("mision", "mision.id", "notificaciones_mision.mision_id")
    .leftJoin("incidente", "incidente.id", "mision.incidente_id")
    .select([
      "notificaciones_mision.id as notificacion_id",
      "notificaciones_mision.estado as notificacion_estado",
      "notificaciones_mision.patrulla_id",
      "notificaciones_mision.cuadrilla_id",
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
    .where("notificaciones_mision.estado", "in", ["PENDIENTE_ENVIO", "ENVIADA"])
    .where("mision.estado", "=", "DESPACHADA");

  if (cuadrillaId) {
    consulta = consulta.where("notificaciones_mision.cuadrilla_id", "=", cuadrillaId);
  } else if (patrullaId) {
    consulta = consulta.where("notificaciones_mision.patrulla_id", "=", patrullaId);
  }

  const filas = await consulta
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
    patrullaId: f.patrulla_id ?? null,
    cuadrillaId: (f as { cuadrilla_id?: string | null }).cuadrilla_id ?? null,
    tipoUnidad: (f as { cuadrilla_id?: string | null }).cuadrilla_id ? "CUADRILLA" : "PATRULLA",
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

