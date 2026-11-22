import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getEvidenciaDir } from "@/modules/evidencia/evidencia.storage";

interface RouteContext {
  params: Promise<{ filename: string }>;
}

const MIME_POR_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
};

const NOMBRE_ARCHIVO_SEGURO_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * GET /uploads/evidencia/[filename]
 *
 * Sirve archivos de evidencia almacenados en disco con protección contra path traversal
 * y soporte para Range requests (HTTP 206) necesario para streaming de video en navegadores.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { filename } = await context.params;

  if (!filename || !NOMBRE_ARCHIVO_SEGURO_REGEX.test(filename) || filename.includes("..")) {
    return NextResponse.json({ message: "Nombre de archivo inválido." }, { status: 400 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_POR_EXTENSION[ext];
  if (!contentType) {
    return NextResponse.json({ message: "Tipo de archivo no soportado." }, { status: 404 });
  }

  const evidenciaDir = path.resolve(getEvidenciaDir());
  const filePath = path.resolve(evidenciaDir, filename);
  if (!filePath.startsWith(evidenciaDir + path.sep)) {
    return NextResponse.json({ message: "Ruta de archivo inválida." }, { status: 400 });
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return NextResponse.json({ message: "Archivo no encontrado." }, { status: 404 });
    }

    const totalSize = stat.size;
    const rangeHeader = request.headers.get("range");

    if (rangeHeader) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
      if (!match) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }

      const start = parseInt(match[1], 10);
      const end = match[2] ? Math.min(parseInt(match[2], 10), totalSize - 1) : totalSize - 1;

      if (start >= totalSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }

      const chunkSize = end - start + 1;
      const handle = await fs.open(filePath, "r");
      try {
        const buffer = Buffer.alloc(chunkSize);
        await handle.read(buffer, 0, chunkSize, start);
        return new NextResponse(buffer, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${start}-${end}/${totalSize}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } finally {
        await handle.close();
      }
    }

    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(totalSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ message: "Archivo no encontrado." }, { status: 404 });
  }
}
