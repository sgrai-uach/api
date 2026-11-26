import { db } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";

export interface InsertarAdjuntoInput {
  nombreArchivo: string;
  url: string;
  tipoMime: string;
  tamanoBytes: number;
  incidenteId: string | null;
  reporteTerrenoId: string | null;
  sha256Hash: string;
}

export interface AdjuntoRegistro {
  id: string;
  nombre_archivo: string;
  url: string;
  tipo_mime: string;
  tamano_bytes: number | string | bigint;
  incidente_id: string | null;
  reporte_terreno_id: string | null;
  creado_en: Date | string;
}

export interface ValidacionAsociacionAdjuntoResult {
  incidenteId: string | null;
  misionId: string | null;
}

const ESTADOS_INCIDENTE_CERRADOS = new Set(["RESUELTO", "NO_ABORDABLE"]);

/**
 * Valida la existencia de `reporte_terreno` / `incidente`, coherencia relacional,
 * estado ICS abierto y autorización horizontal del usuario respecto a la unidad asignada
 * ANTES de escribir archivos en disco (BUG-H43-API-01, BUG-H43-API-02, BUG-H43-API-04).
 */
export async function validarAsociacionYAutorizacionAdjuntoRepo(params: {
  incidenteId: string | null;
  reporteTerrenoId: string | null;
  usuarioId: string;
  esAdmin: boolean;
}): Promise<ValidacionAsociacionAdjuntoResult> {
  let incidenteIdResuelto = params.incidenteId;
  let misionIdResuelta: string | null = null;
  let misionReporte: {
    id: string;
    incidente_id: string | null;
    patrulla_id: string | null;
    cuadrilla_id: string | null;
  } | null = null;

  if (params.reporteTerrenoId) {
    const reporte = await db
      .selectFrom("reporte_terreno")
      .innerJoin("mision", "mision.id", "reporte_terreno.mision_id")
      .select([
        "reporte_terreno.id",
        "reporte_terreno.mision_id",
        "mision.incidente_id",
        "mision.patrulla_id",
        "mision.cuadrilla_id",
      ])
      .where("reporte_terreno.id", "=", params.reporteTerrenoId)
      .executeTakeFirst();

    if (!reporte) {
      throw new NotFoundError(
        `No existe ningún reporte de terreno con el identificador ${params.reporteTerrenoId}.`
      );
    }

    if (
      params.incidenteId &&
      reporte.incidente_id &&
      reporte.incidente_id !== params.incidenteId
    ) {
      throw new ConflictError(
        "El incidente_id proporcionado no coincide con el incidente asociado al reporte de terreno."
      );
    }

    incidenteIdResuelto = params.incidenteId ?? reporte.incidente_id ?? null;
    misionIdResuelta = reporte.mision_id;
    misionReporte = {
      id: reporte.mision_id,
      incidente_id: reporte.incidente_id,
      patrulla_id: reporte.patrulla_id,
      cuadrilla_id: reporte.cuadrilla_id,
    };
  }

  if (incidenteIdResuelto) {
    const incidente = await db
      .selectFrom("incidente")
      .select(["id", "estado"])
      .where("id", "=", incidenteIdResuelto)
      .executeTakeFirst();

    if (!incidente) {
      throw new NotFoundError(
        `No existe ningún incidente con el identificador ${incidenteIdResuelto}.`
      );
    }

    const estadoNorm = (incidente.estado || "").toUpperCase();
    if (ESTADOS_INCIDENTE_CERRADOS.has(estadoNorm)) {
      throw new ConflictError(
        `No es posible adjuntar evidencia a un incidente en estado cerrado (${estadoNorm}).`
      );
    }
  }

  if (!params.esAdmin) {
    let misionesCandidatas: Array<{
      id: string;
      patrulla_id: string | null;
      cuadrilla_id: string | null;
    }> = [];

    if (misionReporte) {
      misionesCandidatas = [misionReporte];
    } else if (incidenteIdResuelto) {
      misionesCandidatas = await db
        .selectFrom("mision")
        .select(["id", "patrulla_id", "cuadrilla_id"])
        .where("incidente_id", "=", incidenteIdResuelto)
        .where("estado", "not in", ["CANCELADA", "RECHAZADA"])
        .execute();
    }

    const patrullaIds = Array.from(
      new Set(
        misionesCandidatas
          .map((m) => m.patrulla_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const cuadrillaIds = Array.from(
      new Set(
        misionesCandidatas
          .map((m) => m.cuadrilla_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    let autorizado = false;

    if (patrullaIds.length > 0) {
      const esLider = await db
        .selectFrom("patrulla_verificadora")
        .select("id")
        .where("id", "in", patrullaIds)
        .where("usuario_lider_id", "=", params.usuarioId)
        .executeTakeFirst();

      if (esLider) {
        autorizado = true;
      } else {
        const esIntegrantePatrulla = await db
          .selectFrom("patrulla_personal")
          .innerJoin("personal", "personal.id", "patrulla_personal.personal_id")
          .select("patrulla_personal.id")
          .where("patrulla_personal.patrulla_id", "in", patrullaIds)
          .where("personal.usuario_id", "=", params.usuarioId)
          .executeTakeFirst();

        if (esIntegrantePatrulla) {
          autorizado = true;
        }
      }
    }

    if (!autorizado && cuadrillaIds.length > 0) {
      const esDelegado = await db
        .selectFrom("cuadrilla")
        .select("id")
        .where("id", "in", cuadrillaIds)
        .where("usuario_delegado_id", "=", params.usuarioId)
        .executeTakeFirst();

      if (esDelegado) {
        autorizado = true;
      } else {
        const esIntegranteCuadrilla = await db
          .selectFrom("cuadrilla_personal")
          .innerJoin("personal", "personal.id", "cuadrilla_personal.personal_id")
          .select("cuadrilla_personal.id")
          .where("cuadrilla_personal.cuadrilla_id", "in", cuadrillaIds)
          .where("personal.usuario_id", "=", params.usuarioId)
          .where("cuadrilla_personal.activo", "=", true)
          .where("cuadrilla_personal.desvinculado_en", "is", null)
          .executeTakeFirst();

        if (esIntegranteCuadrilla) {
          autorizado = true;
        }
      }
    }

    if (!autorizado) {
      throw new ForbiddenError(
        "No tiene autorización para adjuntar evidencia en un incidente o reporte asignado a otra unidad."
      );
    }
  }

  return {
    incidenteId: incidenteIdResuelto,
    misionId: misionIdResuelta,
  };
}

/**
 * Persiste el registro del archivo en la tabla `adjunto`.
 */
export async function insertarAdjuntoRepository(
  input: InsertarAdjuntoInput
): Promise<AdjuntoRegistro> {
  const insertado = await db
    .insertInto("adjunto")
    .values({
      nombre_archivo: input.nombreArchivo,
      url: input.url,
      tipo_mime: input.tipoMime,
      tamano_bytes: input.tamanoBytes,
      aviso_id: null,
      incidente_id: input.incidenteId,
      reporte_terreno_id: input.reporteTerrenoId,
      sha256_hash: input.sha256Hash,
    })
    .returning([
      "id",
      "nombre_archivo",
      "url",
      "tipo_mime",
      "tamano_bytes",
      "incidente_id",
      "reporte_terreno_id",
      "creado_en",
    ])
    .executeTakeFirstOrThrow();

  return {
    id: insertado.id,
    nombre_archivo: insertado.nombre_archivo,
    url: insertado.url,
    tipo_mime: insertado.tipo_mime,
    tamano_bytes: insertado.tamano_bytes,
    incidente_id: insertado.incidente_id,
    reporte_terreno_id: insertado.reporte_terreno_id ?? null,
    creado_en: insertado.creado_en,
  };
}

/**
 * Lista adjuntos multimedia asociados a un incidente y/o reporte de terreno en orden cronológico.
 */
export async function listarAdjuntosRepository(filtros: {
  incidenteId?: string;
  reporteTerrenoId?: string;
}): Promise<AdjuntoRegistro[]> {
  let query = db
    .selectFrom("adjunto")
    .select([
      "id",
      "nombre_archivo",
      "url",
      "tipo_mime",
      "tamano_bytes",
      "incidente_id",
      "reporte_terreno_id",
      "creado_en",
    ]);

  if (filtros.incidenteId) {
    query = query.where("incidente_id", "=", filtros.incidenteId);
  }
  if (filtros.reporteTerrenoId) {
    query = query.where("reporte_terreno_id", "=", filtros.reporteTerrenoId);
  }

  const filas = await query.orderBy("creado_en", "asc").execute();
  return filas.map((f) => ({
    id: f.id,
    nombre_archivo: f.nombre_archivo,
    url: f.url,
    tipo_mime: f.tipo_mime,
    tamano_bytes: f.tamano_bytes,
    incidente_id: f.incidente_id ?? null,
    reporte_terreno_id: f.reporte_terreno_id ?? null,
    creado_en: f.creado_en,
  }));
}
