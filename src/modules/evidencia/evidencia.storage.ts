import crypto from "crypto";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import sharp from "sharp";
import {
  MAX_ADJUNTO_SIZE_BYTES,
  MIME_PERMITIDOS,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  type MimePermitido,
} from "./evidencia.schema";
import { BadRequestError } from "@/modules/seguridad/errors";

const execFileAsync = promisify(execFile);

export interface ArchivoProcesado {
  nombreArchivo: string;
  url: string;
  tipoMime: string;
  tamanoBytes: number;
  sha256Hash: string;
}

export function getUploadRootDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

export function getEvidenciaDir(): string {
  return path.join(getUploadRootDir(), "evidencia");
}

/**
 * Sanitiza el nombre original del archivo conservando una longitud máxima segura.
 */
export function sanitizarNombreArchivo(nombreOriginal: string): string {
  const base = path.basename(nombreOriginal || "evidencia").trim();
  const limpio = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return (limpio || "evidencia").slice(0, 200);
}

/**
 * Detecta el tipo MIME real inspeccionando los magic bytes del buffer.
 */
export function detectarMimePorMagicBytes(buffer: Buffer): MimePermitido | null {
  if (buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  // PDF: %PDF-
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  // WEBM: 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "video/webm";
  }

  // MP4 / QuickTime: box 'ftyp' en offset 4..8
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand === "qt  ") {
      return "video/quicktime";
    }
    return "video/mp4";
  }

  return null;
}

function extensionParaMime(mime: MimePermitido): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    case "application/pdf":
      return "pdf";
  }
}

/**
 * Valida tamaño (<= 10 MB), MIME declarado y firma binaria real (magic bytes).
 */
export function validarArchivoEvidencia(
  buffer: Buffer,
  declaredMime: string,
  size: number
): MimePermitido {
  if (size <= 0 || buffer.length === 0) {
    throw new BadRequestError("El archivo proporcionado está vacío.");
  }

  if (size > MAX_ADJUNTO_SIZE_BYTES || buffer.length > MAX_ADJUNTO_SIZE_BYTES) {
    throw new PayloadTooLargeError();
  }

  if (!MIME_PERMITIDOS.includes(declaredMime as MimePermitido)) {
    throw new UnsupportedMediaTypeError();
  }

  const detectedMime = detectarMimePorMagicBytes(buffer);
  if (!detectedMime) {
    throw new UnsupportedMediaTypeError(
      "No se pudo verificar la firma binaria del archivo. Formato no soportado o corrupto."
    );
  }

  const esContenedorIsoBmff =
    (declaredMime === "video/mp4" || declaredMime === "video/quicktime") &&
    (detectedMime === "video/mp4" || detectedMime === "video/quicktime");

  if (detectedMime !== declaredMime && !esContenedorIsoBmff) {
    throw new UnsupportedMediaTypeError(
      `El contenido binario del archivo (${detectedMime}) no coincide con el tipo declarado (${declaredMime}).`
    );
  }

  return declaredMime as MimePermitido;
}

/**
 * Comprime y redimensiona imágenes (máx. 1920px, sin EXIF, WebP calidad 80) para ahorrar espacio.
 */
export async function optimizarImagen(
  buffer: Buffer
): Promise<{ buffer: Buffer; mime: MimePermitido; ext: string }> {
  const optimizado = await sharp(buffer)
    .rotate()
    .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  return {
    buffer: optimizado,
    mime: "image/webp",
    ext: "webp",
  };
}

/**
 * Comprime videos a MP4 H.264/AAC (máx. 720p, CRF 28, faststart) usando ffmpeg cuando está disponible.
 * Si ffmpeg no está instalado o la compresión no reduce el peso, conserva el original validado.
 */
export async function optimizarVideo(
  buffer: Buffer,
  mimeOriginal: MimePermitido
): Promise<{ buffer: Buffer; mime: MimePermitido; ext: string }> {
  const extOriginal = extensionParaMime(mimeOriginal);
  const tmpId = crypto.randomUUID();
  const inputPath = path.join(os.tmpdir(), `sgrai_in_${tmpId}.${extOriginal}`);
  const outputPath = path.join(os.tmpdir(), `sgrai_out_${tmpId}.mp4`);

  try {
    await execFileAsync("ffmpeg", ["-version"]);
    await fs.writeFile(inputPath, buffer);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const optimizado = await fs.readFile(outputPath);
    if (optimizado.length > 0 && optimizado.length < buffer.length) {
      return {
        buffer: optimizado,
        mime: "video/mp4",
        ext: "mp4",
      };
    }
  } catch {
    // Fallback seguro: si ffmpeg no está disponible en el entorno local o falla, se almacena el video validado
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }

  return {
    buffer,
    mime: mimeOriginal,
    ext: extOriginal,
  };
}

/**
 * Valida, optimiza según tipo y almacena el archivo en disco con deduplicación SHA-256.
 */
export async function guardarArchivoEvidencia(params: {
  buffer: Buffer;
  originalName: string;
  declaredMime: string;
  size: number;
}): Promise<ArchivoProcesado> {
  const mimeValidado = validarArchivoEvidencia(
    params.buffer,
    params.declaredMime,
    params.size
  );

  let finalBuffer = params.buffer;
  let finalMime: MimePermitido = mimeValidado;
  let finalExt = extensionParaMime(mimeValidado);

  if (mimeValidado.startsWith("image/")) {
    const res = await optimizarImagen(params.buffer);
    finalBuffer = res.buffer;
    finalMime = res.mime;
    finalExt = res.ext;
  } else if (mimeValidado.startsWith("video/")) {
    const res = await optimizarVideo(params.buffer, mimeValidado);
    finalBuffer = res.buffer;
    finalMime = res.mime;
    finalExt = res.ext;
  }

  const sha256Hash = crypto.createHash("sha256").update(finalBuffer).digest("hex");
  const diskFilename = `${sha256Hash}.${finalExt}`;
  const evidenciaDir = getEvidenciaDir();
  const targetPath = path.join(evidenciaDir, diskFilename);

  await fs.mkdir(evidenciaDir, { recursive: true });

  // Deduplicación: evitar reescribir si el mismo contenido optimizado ya existe en disco
  try {
    await fs.access(targetPath);
  } catch {
    await fs.writeFile(targetPath, finalBuffer);
  }

  return {
    nombreArchivo: sanitizarNombreArchivo(params.originalName),
    url: `/uploads/evidencia/${diskFilename}`,
    tipoMime: finalMime,
    tamanoBytes: finalBuffer.length,
    sha256Hash,
  };
}
