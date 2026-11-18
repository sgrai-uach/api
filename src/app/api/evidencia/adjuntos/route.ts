import { NextRequest, NextResponse } from "next/server";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_CREAR_REPORTES } from "@/modules/seguridad/permisos.constants";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";
import {
  MAX_ADJUNTO_SIZE_BYTES,
  PayloadTooLargeError,
  SubirAdjuntoFieldsSchema,
  UnsupportedMediaTypeError,
} from "@/modules/evidencia/evidencia.schema";
import { subirEvidenciaService } from "@/modules/evidencia/evidencia.service";

/**
 * POST /api/evidencia/adjuntos (HU-43)
 *
 * Recibe un archivo multimedia (imagen, video o PDF) en formato multipart/form-data
 * junto con `incidente_id` o `reporte_terreno_id`, valida tamaño (<= 10 MB) y magic bytes,
 * optimiza el archivo en disco, persiste en `adjunto` y emite `adjunto:creado`.
 *
 * Requiere permiso RBAC `reportes:crear`.
 */
export async function POST(request: NextRequest) {
  try {
    const tokenUserId = await extraerUsuarioId(request);
    const headerUserId = request.headers.get("x-user-id");
    const usuarioId = tokenUserId || headerUserId;

    await verificarPermiso(usuarioId, PERMISO_CREAR_REPORTES);

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { message: "La solicitud debe enviarse en formato multipart/form-data." },
        { status: 400 }
      );
    }

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      // Margen de 1 MB para cabeceras multipart sobre el límite de 10 MB del archivo
      if (Number.isFinite(contentLength) && contentLength > MAX_ADJUNTO_SIZE_BYTES + 1024 * 1024) {
        return NextResponse.json(
          { message: "El archivo excede el tamaño máximo permitido de 10 MB." },
          { status: 413 }
        );
      }
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { message: "No se pudo parsear el cuerpo multipart/form-data." },
        { status: 400 }
      );
    }

    const fileEntry = formData.get("file");
    if (!fileEntry || typeof fileEntry === "string") {
      return NextResponse.json(
        { message: "Debe adjuntar un archivo en el campo 'file'." },
        { status: 400 }
      );
    }

    const incidenteIdRaw = formData.get("incidente_id");
    const reporteTerrenoIdRaw = formData.get("reporte_terreno_id");

    const validacionCampos = SubirAdjuntoFieldsSchema.safeParse({
      incidente_id:
        typeof incidenteIdRaw === "string" && incidenteIdRaw.trim().length > 0
          ? incidenteIdRaw.trim()
          : undefined,
      reporte_terreno_id:
        typeof reporteTerrenoIdRaw === "string" && reporteTerrenoIdRaw.trim().length > 0
          ? reporteTerrenoIdRaw.trim()
          : undefined,
    });

    if (!validacionCampos.success) {
      return NextResponse.json(
        {
          message: "Datos de asociación inválidos para el adjunto.",
          errors: validacionCampos.error.issues.map((issue) => ({
            campo: issue.path.join(".") || "asociacion",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const resultado = await subirEvidenciaService({
      buffer,
      originalName: fileEntry.name || "evidencia",
      declaredMime: fileEntry.type || "",
      size: fileEntry.size ?? buffer.length,
      fields: validacionCampos.data,
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ message: error.message }, { status: 413 });
    }
    if (error instanceof UnsupportedMediaTypeError) {
      return NextResponse.json({ message: error.message }, { status: 415 });
    }
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("[POST /api/evidencia/adjuntos] Error inesperado:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar el archivo adjunto." },
      { status: 500 }
    );
  }
}
