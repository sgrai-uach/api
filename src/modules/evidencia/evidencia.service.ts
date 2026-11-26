import { promises as fs } from "fs";
import { notificarAdjuntoCreado } from "@/lib/socket";
import type {
  AdjuntoCreadoResponse,
  ListarAdjuntosQuery,
  SubirAdjuntoFields,
} from "./evidencia.schema";
import {
  guardarArchivoEvidencia,
  validarArchivoEvidencia,
} from "./evidencia.storage";
import {
  insertarAdjuntoRepository,
  listarAdjuntosRepository,
  validarAsociacionYAutorizacionAdjuntoRepo,
  type AdjuntoRegistro,
} from "./evidencia.repository";

export interface SubirEvidenciaParams {
  buffer: Buffer;
  originalName: string;
  declaredMime: string;
  size: number;
  fields: SubirAdjuntoFields;
  usuario: {
    id: string;
    rol: string;
  };
}

function mapearAdjuntoAResponse(
  registro: AdjuntoRegistro,
  misionId?: string | null
): AdjuntoCreadoResponse {
  const creadoEnIso =
    registro.creado_en instanceof Date
      ? registro.creado_en.toISOString()
      : new Date(registro.creado_en).toISOString();

  return {
    id: registro.id,
    nombreArchivo: registro.nombre_archivo,
    url: registro.url.startsWith("/") ? registro.url : `/${registro.url}`,
    tipoMime: registro.tipo_mime,
    tamanoBytes: Number(registro.tamano_bytes),
    incidenteId: registro.incidente_id,
    reporteTerrenoId: registro.reporte_terreno_id,
    ...(misionId !== undefined ? { misionId } : {}),
    creadoEn: creadoEnIso,
  };
}

/**
 * Orquesta la validación, autorización horizontal, optimización en disco, persistencia en `adjunto`
 * y notificación en tiempo real `adjunto:creado` hacia el Centro de Mando (HU-43).
 */
export async function subirEvidenciaService(
  params: SubirEvidenciaParams
): Promise<AdjuntoCreadoResponse> {
  // 1. Validar formato, tamaño y firma binaria en memoria antes de consultar BD o escribir disco
  validarArchivoEvidencia(params.buffer, params.declaredMime, params.size);

  // 2. Validar existencia, coherencia relacional, estado abierto y pertenencia horizontal
  const { incidenteId, misionId } =
    await validarAsociacionYAutorizacionAdjuntoRepo({
      incidenteId: params.fields.incidente_id ?? null,
      reporteTerrenoId: params.fields.reporte_terreno_id ?? null,
      usuarioId: params.usuario.id,
      esAdmin: params.usuario.rol === "Administrador",
    });

  // 3. Procesar y persistir en disco solo tras superar validaciones y autorización
  const archivoProcesado = await guardarArchivoEvidencia({
    buffer: params.buffer,
    originalName: params.originalName,
    declaredMime: params.declaredMime,
    size: params.size,
  });

  // 4. Insertar en BD con rollback del archivo recién creado si la inserción falla
  let registro: AdjuntoRegistro;
  try {
    registro = await insertarAdjuntoRepository({
      nombreArchivo: archivoProcesado.nombreArchivo,
      url: archivoProcesado.url,
      tipoMime: archivoProcesado.tipoMime,
      tamanoBytes: archivoProcesado.tamanoBytes,
      incidenteId,
      reporteTerrenoId: params.fields.reporte_terreno_id ?? null,
      sha256Hash: archivoProcesado.sha256Hash,
    });
  } catch (err) {
    if (archivoProcesado.archivoNuevoEnDisco && archivoProcesado.targetPath) {
      await fs.unlink(archivoProcesado.targetPath).catch(() => {});
    }
    throw err;
  }

  const respuesta = mapearAdjuntoAResponse(registro, misionId ?? undefined);

  try {
    notificarAdjuntoCreado({
      id: respuesta.id,
      nombreArchivo: respuesta.nombreArchivo,
      url: respuesta.url,
      tipoMime: respuesta.tipoMime,
      tamanoBytes: respuesta.tamanoBytes,
      incidenteId: respuesta.incidenteId,
      reporteTerrenoId: respuesta.reporteTerrenoId,
      ...(misionId ? { misionId } : {}),
      creadoEn: respuesta.creadoEn,
    });
  } catch (err) {
    console.warn("[evidencia.service] Error al emitir adjunto:creado:", err);
  }

  return respuesta;
}

/**
 * Consulta la evidencia multimedia asociada a un incidente o reporte de terreno (HU-43).
 */
export async function listarEvidenciaService(
  filtros: ListarAdjuntosQuery
): Promise<AdjuntoCreadoResponse[]> {
  const filas = await listarAdjuntosRepository({
    incidenteId: filtros.incidente_id,
    reporteTerrenoId: filtros.reporte_terreno_id,
  });

  return filas.map((fila) => mapearAdjuntoAResponse(fila));
}
