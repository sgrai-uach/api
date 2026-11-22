import { NextRequest, NextResponse } from "next/server";
import {
  IncidenteAsistenciaSocialParamSchema,
  DerivarAsistenciaSocialIncidenteInputSchema,
} from "@/modules/eventos-atp/asistencia-social.schema";
import {
  derivarIncidenteAAsistenciaSocialService,
  IncidenteNoEncontradoError,
  IncidenteNoElegibleAsistenciaSocialError,
  AsistenteSocialNotFoundError,
  AsistenteSocialNoDisponibleError,
  EventoAsistenciaSocialEnProcesoError,
} from "@/modules/eventos-atp/asistencia-social.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

/**
 * POST /api/incidentes/[id]/asistencia-social
 * Deriva un incidente resuelto (RESUELTO) con afectación a personas o marca social
 * hacia Asistencia Social (DGRD / FIBE), asignando un profesional disponible en
 * estado inicial ASIGNADO y dejando trazabilidad en mision_hito (HU-25 / Issue #59).
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const usuarioId = await extraerUsuarioId(req);
    if (!usuarioId) {
      return NextResponse.json(
        {
          message:
            "Se requiere cabecera de autenticación Authorization: Bearer <token> o X-User-Id.",
        },
        { status: 401 }
      );
    }

    const params = await context.params;
    const validacionParams = IncidenteAsistenciaSocialParamSchema.safeParse(params);
    if (!validacionParams.success) {
      return NextResponse.json(
        {
          message: "Identificador de incidente inválido.",
          errors: validacionParams.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud no es un JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody =
      DerivarAsistenciaSocialIncidenteInputSchema.safeParse(bodyJson);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de derivación a asistencia social inválidos.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await derivarIncidenteAAsistenciaSocialService(
      validacionParams.data.id,
      validacionBody.data,
      usuarioId
    );

    const status = resultado.accion === "CREADO" ? 201 : 200;
    return NextResponse.json(resultado, { status });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof IncidenteNoEncontradoError ||
      error instanceof AsistenteSocialNotFoundError
    ) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (
      error instanceof IncidenteNoElegibleAsistenciaSocialError ||
      error instanceof AsistenteSocialNoDisponibleError ||
      error instanceof EventoAsistenciaSocialEnProcesoError
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al derivar incidente a asistencia social:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al derivar el incidente a asistencia social.",
      },
      { status: 500 }
    );
  }
}
