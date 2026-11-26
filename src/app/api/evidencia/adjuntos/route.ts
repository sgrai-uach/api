import { NextRequest, NextResponse } from "next/server";
import { exigirUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  verificarAlgunPermiso,
  verificarPermiso,
} from "@/modules/seguridad/auth.service";
import {
  PERMISO_CREAR_REPORTES,
  PERMISO_KANBAN_INCIDENTES,
  PERMISO_LEER_MISION,
} from "@/modules/seguridad/permisos.constants";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";
import {
  ListarAdjuntosQuerySchema,
  MAX_ADJUNTO_SIZE_BYTES,
  PayloadTooLargeError,
  SubirAdjuntoFieldsSchema,
  UnsupportedMediaTypeError,
} from "@/modules/evidencia/evidencia.schema";
import {
  listarEvidenciaService,
  subirEvidenciaService,
} from "@/modules/evidencia/evidencia.service";

function mapearErrorHttpEvidencia(error: unknown, contexto: string): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ message: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ message: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ message: error.message }, { status: 404 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ message: error.message }, { status: 409 });
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

  console.error(`[${contexto}] Error inesperado:`, error);
  return NextResponse.json(
    { message: "Error interno del servidor al procesar el archivo adjunto." },
    { status: 500 }
  );
}

/**
 * GET /api/evidencia/adjuntos (HU-43)
 *
 * Lista la evidencia multimedia asociada a un `incidente_id` o `reporte_terreno_id`.
 * Requiere JWT válido y al menos uno de `reportes:crear`, `misiones:leer` o `incidentes:kanban`.
 */
export async function GET(request: NextRequest) {
  try {
    const usuarioId = await exigirUsuarioId(request);
    await verificarAlgunPermiso(usuarioId, [
      PERMISO_CREAR_REPORTES,
      PERMISO_LEER_MISION,
      PERMISO_KANBAN_INCIDENTES,
    ]);

    const { searchParams } = new URL(request.url);
    const validacion = ListarAdjuntosQuerySchema.safeParse({
      incidente_id: searchParams.get("incidente_id")?.trim() || undefined,
      reporte_terreno_id: searchParams.get("reporte_terreno_id")?.trim() || undefined,
    });

    if (!validacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros de consulta inválidos.",
          errors: validacion.error.issues.map((issue) => ({
            campo: issue.path.join(".") || "query",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const data = await listarEvidenciaService(validacion.data);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    return mapearErrorHttpEvidencia(error, "GET /api/evidencia/adjuntos");
  }
}

/**
 * POST /api/evidencia/adjuntos (HU-43)
 *
 * Recibe un archivo multimedia (imagen, video o PDF) en formato multipart/form-data
 * junto con `incidente_id` o `reporte_terreno_id`, valida tamaño (<= 10 MB) y magic bytes,
 * optimiza el archivo en disco, persiste en `adjunto` y emite `adjunto:creado`.
 *
 * Requiere token JWT válido, permiso RBAC `reportes:crear` y pertenencia a la unidad asignada.
 */
export async function POST(request: NextRequest) {
  try {
    const usuarioId = await exigirUsuarioId(request);
    const usuario = await verificarPermiso(usuarioId, PERMISO_CREAR_REPORTES);

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
    } catch (err) {
      const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
      const errMsg = err instanceof Error ? err.message : "";
      if (
        (Number.isFinite(contentLength) && contentLength > MAX_ADJUNTO_SIZE_BYTES) ||
        /exceed|too large|body size/i.test(errMsg)
      ) {
        return NextResponse.json(
          { message: "El archivo excede el tamaño máximo permitido de 10 MB." },
          { status: 413 }
        );
      }
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
      usuario: {
        id: usuario.id,
        rol: usuario.rol,
      },
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error: unknown) {
    return mapearErrorHttpEvidencia(error, "POST /api/evidencia/adjuntos");
  }
}
