import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import {
  detectarMimePorMagicBytes,
  validarArchivoEvidencia,
  guardarArchivoEvidencia,
} from "../evidencia.storage";
import {
  MAX_ADJUNTO_SIZE_BYTES,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from "../evidencia.schema";
import { BadRequestError } from "@/modules/seguridad/errors";

describe("evidencia.storage (HU-43)", () => {
  let tempUploadDir: string;
  const originalUploadDir = process.env.UPLOAD_DIR;

  beforeEach(async () => {
    tempUploadDir = await fs.mkdtemp(path.join(os.tmpdir(), "sgrai-evidencia-test-"));
    process.env.UPLOAD_DIR = tempUploadDir;
  });

  afterEach(async () => {
    process.env.UPLOAD_DIR = originalUploadDir;
    await fs.rm(tempUploadDir, { recursive: true, force: true });
  });

  it("debe detectar magic bytes de JPEG, PNG, WebP, PDF, MP4, MOV y WebM", () => {
    expect(detectarMimePorMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      "image/jpeg"
    );
    expect(
      detectarMimePorMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))
    ).toBe("image/png");
    expect(
      detectarMimePorMagicBytes(Buffer.from("RIFF1234WEBP", "ascii"))
    ).toBe("image/webp");
    expect(
      detectarMimePorMagicBytes(Buffer.from("%PDF-1.7\n1 0 obj", "ascii"))
    ).toBe("application/pdf");
    expect(
      detectarMimePorMagicBytes(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, ...Buffer.from("webm")]))
    ).toBe("video/webm");
    expect(
      detectarMimePorMagicBytes(Buffer.from("\x00\x00\x00\x18ftypisom", "latin1"))
    ).toBe("video/mp4");
    expect(
      detectarMimePorMagicBytes(Buffer.from("\x00\x00\x00\x14ftypqt  ", "latin1"))
    ).toBe("video/quicktime");
  });

  it("debe rechazar marcas ISO BMFF no permitidas (ftypheic, ftypavif, ftypM4A) y EBML sin DocType webm (BUG-H43-API-04)", () => {
    expect(
      detectarMimePorMagicBytes(Buffer.from("\x00\x00\x00\x18ftypheic\x00\x00\x00\x00", "latin1"))
    ).toBeNull();
    expect(
      detectarMimePorMagicBytes(Buffer.from("\x00\x00\x00\x18ftypavif\x00\x00\x00\x00", "latin1"))
    ).toBeNull();
    expect(
      detectarMimePorMagicBytes(Buffer.from("\x00\x00\x00\x18ftypM4A \x00\x00\x00\x00", "latin1"))
    ).toBeNull();
    expect(
      detectarMimePorMagicBytes(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))
    ).toBeNull();

    const heicFake = Buffer.from("\x00\x00\x00\x18ftypheic\x00\x00\x00\x00", "latin1");
    expect(() => validarArchivoEvidencia(heicFake, "video/mp4", heicFake.length)).toThrow(
      UnsupportedMediaTypeError
    );

    const webmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82, 0x84, ...Buffer.from("webm"), 0, 0]);
    expect(validarArchivoEvidencia(webmHeader, "video/webm;codecs=vp8", webmHeader.length)).toBe(
      "video/webm"
    );
  });

  it("debe devolver UnsupportedMediaTypeError (415) ante imágenes JPEG truncadas o corruptas (BUG-H43-API-04)", async () => {
    const jpegCorrupto = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    ]);

    await expect(
      guardarArchivoEvidencia({
        buffer: jpegCorrupto,
        originalName: "corrupta.jpg",
        declaredMime: "image/jpeg",
        size: jpegCorrupto.length,
      })
    ).rejects.toThrow(UnsupportedMediaTypeError);
  });

  it("debe rechazar archivos vacíos, mayores a 10 MB, MIME no permitidos y magic bytes falsificados", () => {
    const pdfBuffer = Buffer.from("%PDF-1.7\n1 0 obj", "ascii");

    expect(() => validarArchivoEvidencia(Buffer.alloc(0), "application/pdf", 0)).toThrow(
      BadRequestError
    );

    expect(() =>
      validarArchivoEvidencia(pdfBuffer, "application/pdf", MAX_ADJUNTO_SIZE_BYTES + 1)
    ).toThrow(PayloadTooLargeError);

    expect(() =>
      validarArchivoEvidencia(pdfBuffer, "application/x-msdownload", pdfBuffer.length)
    ).toThrow(UnsupportedMediaTypeError);

    // Suplantación: dice ser image/jpeg pero contiene cabecera PDF
    expect(() =>
      validarArchivoEvidencia(pdfBuffer, "image/jpeg", pdfBuffer.length)
    ).toThrow(UnsupportedMediaTypeError);
  });

  it("debe comprimir una imagen grande a WebP y deduplicar en disco por SHA-256", async () => {
    const imagenGrande = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 220, g: 80, b: 40 },
      },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();

    const primero = await guardarArchivoEvidencia({
      buffer: imagenGrande,
      originalName: "foto terreno (1).png",
      declaredMime: "image/png",
      size: imagenGrande.length,
    });

    expect(primero.tipoMime).toBe("image/webp");
    expect(primero.url).toMatch(/^\/uploads\/evidencia\/[a-f0-9]{64}\.webp$/);
    expect(primero.tamanoBytes).toBeLessThan(imagenGrande.length);
    expect(primero.nombreArchivo).toBe("foto_terreno__1_.png");

    // Subir exactamente la misma imagen de nuevo debe reutilizar el mismo archivo en disco
    const segundo = await guardarArchivoEvidencia({
      buffer: imagenGrande,
      originalName: "copia.png",
      declaredMime: "image/png",
      size: imagenGrande.length,
    });

    expect(segundo.sha256Hash).toBe(primero.sha256Hash);
    expect(segundo.url).toBe(primero.url);

    const archivosEnDisco = await fs.readdir(path.join(tempUploadDir, "evidencia"));
    expect(archivosEnDisco).toHaveLength(1);
  });

  it("debe aceptar y guardar un video MP4 válido", async () => {
    const mp4Mock = Buffer.from("\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2", "latin1");
    const resultado = await guardarArchivoEvidencia({
      buffer: mp4Mock,
      originalName: "recorrido.mp4",
      declaredMime: "video/mp4",
      size: mp4Mock.length,
    });

    expect(resultado.tipoMime).toBe("video/mp4");
    expect(resultado.url).toMatch(/^\/uploads\/evidencia\/[a-f0-9]{64}\.mp4$/);
  });
});
