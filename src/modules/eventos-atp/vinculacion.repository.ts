import type { Transaction } from "kysely";
import { db } from "@/lib/db";
import type { Database } from "@/lib/db/types";
import type { TipoEntidadVinculable } from "./vinculacion.schema";

export type KyselyTrx = Transaction<Database>;

export interface FilaEntidadVinculable {
  tipo: TipoEntidadVinculable;
  id: string;
  codigo: string;
  nombre: string | null;
  evento_atp_id: string | null;
}

export interface GruposEntidades {
  incidenteIds: string[];
  eventoPrevencionIds: string[];
  recuperacionIds: string[];
  eventoAsistenciaSocialIds: string[];
}

/**
 * Obtiene el Evento ATP dentro de una transacción y bloquea su fila para
 * serializar vinculaciones concurrentes sobre el mismo evento.
 */
export async function buscarEventoAtpParaVinculacion(
  trx: KyselyTrx,
  eventoAtpId: string
) {
  return trx
    .selectFrom("evento_atp")
    .select(["id", "codigo", "estado"])
    .where("id", "=", eventoAtpId)
    .forUpdate()
    .executeTakeFirst();
}

/* ==========================================================================
   Lectura de entidades
   ========================================================================== */

async function obtenerIncidentes(
  trx: KyselyTrx,
  ids: string[]
): Promise<FilaEntidadVinculable[]> {
  if (ids.length === 0) return [];
  const filas = await trx
    .selectFrom("incidente")
    .select(["id", "codigo", "tipo_afectacion", "evento_atp_id"])
    .where("id", "in", ids)
    .execute();

  return filas.map((fila) => ({
    tipo: "INCIDENTE" as const,
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.tipo_afectacion ?? null,
    evento_atp_id: fila.evento_atp_id ?? null,
  }));
}

async function obtenerEventosPrevencion(
  trx: KyselyTrx,
  ids: string[]
): Promise<FilaEntidadVinculable[]> {
  if (ids.length === 0) return [];
  const filas = await trx
    .selectFrom("evento_prevencion")
    .select(["id", "codigo", "nombre", "evento_atp_id"])
    .where("id", "in", ids)
    .execute();

  return filas.map((fila) => ({
    tipo: "EVENTO_PREVENCION" as const,
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre ?? null,
    evento_atp_id: fila.evento_atp_id ?? null,
  }));
}

async function obtenerRecuperaciones(
  trx: KyselyTrx,
  ids: string[]
): Promise<FilaEntidadVinculable[]> {
  if (ids.length === 0) return [];
  const filas = await trx
    .selectFrom("recuperacion")
    .select(["id", "codigo", "nombre", "evento_atp_id"])
    .where("id", "in", ids)
    .execute();

  return filas.map((fila) => ({
    tipo: "RECUPERACION" as const,
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre ?? null,
    evento_atp_id: fila.evento_atp_id ?? null,
  }));
}

async function obtenerEventosAsistenciaSocial(
  trx: KyselyTrx,
  ids: string[]
): Promise<FilaEntidadVinculable[]> {
  if (ids.length === 0) return [];
  const filas = await trx
    .selectFrom("evento_asistencia_social")
    .select(["id", "codigo", "tipo_afectacion", "evento_atp_id"])
    .where("id", "in", ids)
    .where("eliminado_en", "is", null)
    .execute();

  return filas.map((fila) => ({
    tipo: "EVENTO_ASISTENCIA_SOCIAL" as const,
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.tipo_afectacion ?? null,
    evento_atp_id: fila.evento_atp_id ?? null,
  }));
}

/**
 * Obtiene las entidades solicitadas que existan, agrupadas por tipo.
 */
export async function obtenerEntidadesExistentes(
  trx: KyselyTrx,
  grupos: GruposEntidades
): Promise<FilaEntidadVinculable[]> {
  const [incidentes, prevencion, recuperaciones, asistencia] =
    await Promise.all([
      obtenerIncidentes(trx, grupos.incidenteIds),
      obtenerEventosPrevencion(trx, grupos.eventoPrevencionIds),
      obtenerRecuperaciones(trx, grupos.recuperacionIds),
      obtenerEventosAsistenciaSocial(trx, grupos.eventoAsistenciaSocialIds),
    ]);

  return [...incidentes, ...prevencion, ...recuperaciones, ...asistencia];
}

/* ==========================================================================
   Escritura de vinculaciones
   ========================================================================== */

/**
 * Actualiza `evento_atp_id` de forma atómica en las cuatro tablas soportadas.
 * Solo toca los identificadores efectivamente recibidos.
 */
export async function actualizarEventoAtpDeEntidades(
  trx: KyselyTrx,
  eventoAtpId: string | null,
  grupos: GruposEntidades
): Promise<void> {
  if (grupos.incidenteIds.length > 0) {
    await trx
      .updateTable("incidente")
      .set({ evento_atp_id: eventoAtpId })
      .where("id", "in", grupos.incidenteIds)
      .execute();
  }

  if (grupos.eventoPrevencionIds.length > 0) {
    await trx
      .updateTable("evento_prevencion")
      .set({ evento_atp_id: eventoAtpId })
      .where("id", "in", grupos.eventoPrevencionIds)
      .execute();
  }

  if (grupos.recuperacionIds.length > 0) {
    await trx
      .updateTable("recuperacion")
      .set({ evento_atp_id: eventoAtpId })
      .where("id", "in", grupos.recuperacionIds)
      .execute();
  }

  if (grupos.eventoAsistenciaSocialIds.length > 0) {
    await trx
      .updateTable("evento_asistencia_social")
      .set({ evento_atp_id: eventoAtpId })
      .where("id", "in", grupos.eventoAsistenciaSocialIds)
      .where("eliminado_en", "is", null)
      .execute();
  }
}

/**
 * Desvincula únicamente las entidades que pertenecen al Evento ATP indicado.
 * Las entidades vinculadas a otro evento se preservan y se reportan aparte.
 */
export async function desvincularEntidadesDelEvento(
  trx: KyselyTrx,
  eventoAtpId: string,
  grupos: GruposEntidades
): Promise<void> {
  if (grupos.incidenteIds.length > 0) {
    await trx
      .updateTable("incidente")
      .set({ evento_atp_id: null })
      .where("id", "in", grupos.incidenteIds)
      .where("evento_atp_id", "=", eventoAtpId)
      .execute();
  }

  if (grupos.eventoPrevencionIds.length > 0) {
    await trx
      .updateTable("evento_prevencion")
      .set({ evento_atp_id: null })
      .where("id", "in", grupos.eventoPrevencionIds)
      .where("evento_atp_id", "=", eventoAtpId)
      .execute();
  }

  if (grupos.recuperacionIds.length > 0) {
    await trx
      .updateTable("recuperacion")
      .set({ evento_atp_id: null })
      .where("id", "in", grupos.recuperacionIds)
      .where("evento_atp_id", "=", eventoAtpId)
      .execute();
  }

  if (grupos.eventoAsistenciaSocialIds.length > 0) {
    await trx
      .updateTable("evento_asistencia_social")
      .set({ evento_atp_id: null })
      .where("id", "in", grupos.eventoAsistenciaSocialIds)
      .where("evento_atp_id", "=", eventoAtpId)
      .where("eliminado_en", "is", null)
      .execute();
  }
}

/**
 * Obtiene el `evento_atp_id` actual de las entidades solicitadas para detectar
 * reasignaciones antes de ejecutar la actualización.
 */
export async function obtenerVinculosActuales(
  trx: KyselyTrx,
  grupos: GruposEntidades
): Promise<FilaEntidadVinculable[]> {
  return obtenerEntidadesExistentes(trx, grupos);
}

/**
 * Ejecuta una transacción completa de vinculación o desvinculación.
 */
export async function ejecutarTransaccionVinculacion<T>(
  callback: (trx: KyselyTrx) => Promise<T>
): Promise<T> {
  return db.transaction().execute(callback);
}
