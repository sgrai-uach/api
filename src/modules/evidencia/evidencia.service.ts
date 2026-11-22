import { notificarAdjuntoCreado } from "@/lib/socket";
import type { AdjuntoCreadoResponse, SubirAdjuntoFields } from "./evidencia.schema";
import { guardarArchivoEvidencia } from "./evidencia.storage";
import { insertarAdjuntoRepository } from "./evidencia.repository";

export interface SubirEvidenciaParams {
  buffer: Buffer;
  originalName: string;
  declaredMime: string;
  size: number;
  fields: SubirAdjuntoFields;
}

/**
 * Orquesta la validación, optimización en disco, persistencia en `adjunto`
 * y notificación en tiempo real `adjunto:creado` hacia el Centro de Mando (HU-43).
 */
export async function subirEvidenciaService(
  params: SubirEvidenciaParams
): Promise<AdjuntoCreadoResponse> {
  const archivoProcesado = await guardarArchivoEvidencia({
    buffer: params.buffer,
    originalName: params.originalName,
    declaredMime: params.declaredMime,
    size: params.size,
  });

  const registro = await insertarAdjuntoRepository({
    nombreArchivo: archivoProcesado.nombreArchivo,
    url: archivoProcesado.url,
    tipoMime: archivoProcesado.tipoMime,
    tamanoBytes: archivoProcesado.tamanoBytes,
    incidenteId: params.fields.incidente_id ?? null,
    reporteTerrenoId: params.fields.reporte_terreno_id ?? null,
    sha256Hash: archivoProcesado.sha256Hash,
  });

  const creadoEnIso =
    registro.creado_en instanceof Date
      ? registro.creado_en.toISOString()
      : new Date(registro.creado_en).toISOString();

  const respuesta: AdjuntoCreadoResponse = {
    id: registro.id,
    nombreArchivo: registro.nombre_archivo,
    url: registro.url.startsWith("/") ? registro.url : `/${registro.url}`,
    tipoMime: registro.tipo_mime,
    tamanoBytes: Number(registro.tamano_bytes),
    incidenteId: registro.incidente_id,
    reporteTerrenoId: registro.reporte_terreno_id,
    creadoEn: creadoEnIso,
  };

  notificarAdjuntoCreado({
    id: respuesta.id,
    nombreArchivo: respuesta.nombreArchivo,
    url: respuesta.url,
    tipoMime: respuesta.tipoMime,
    tamanoBytes: respuesta.tamanoBytes,
    incidenteId: respuesta.incidenteId,
    reporteTerrenoId: respuesta.reporteTerrenoId,
    creadoEn: respuesta.creadoEn,
  });

  return respuesta;
}
