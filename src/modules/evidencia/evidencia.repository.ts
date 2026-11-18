import { db } from "@/lib/db";
import { NotFoundError } from "@/modules/seguridad/errors";

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

/**
 * Verifica la existencia de las entidades referenciadas y persiste el registro en `adjunto`.
 */
export async function insertarAdjuntoRepository(
  input: InsertarAdjuntoInput
): Promise<AdjuntoRegistro> {
  if (input.incidenteId) {
    const incidente = await db
      .selectFrom("incidente")
      .select("id")
      .where("id", "=", input.incidenteId)
      .executeTakeFirst();

    if (!incidente) {
      throw new NotFoundError(
        `No existe ningún incidente con el identificador ${input.incidenteId}.`
      );
    }
  }

  if (input.reporteTerrenoId) {
    const reporte = await db
      .selectFrom("reporte_terreno")
      .select("id")
      .where("id", "=", input.reporteTerrenoId)
      .executeTakeFirst();

    if (!reporte) {
      throw new NotFoundError(
        `No existe ningún reporte de terreno con el identificador ${input.reporteTerrenoId}.`
      );
    }
  }

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
