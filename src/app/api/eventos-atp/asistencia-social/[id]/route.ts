import { NextRequest, NextResponse } from "next/server";
import {
  EventoAsistenciaSocialIdParamSchema,
  AsignarAsistenteSocialInputSchema,
} from "@/modules/eventos-atp/asistencia-social.schema";
import {
  asignarAsistenteSocialService,
  EventoAsistenciaSocialNotFoundError,
  AsistenteSocialNotFoundError,
  EstadoEventoAsistenciaSocialInvalidoError,
  AsistenteSocialNoDisponibleError,
} from "@/modules/eventos-atp/asistencia-social.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

/**
 * PATCH /api/eventos-atp/asistencia-social/[id]
 * Asigna un asistente social disponible a un evento de asistencia social en estado PENDIENTE (H31).
 * Transiciona atómicamente de PENDIENTE a ASIGNADO y emite notificación WebSocket `asistencia_social:actualizada`.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const usuarioId = await extraerUsuarioId(req);
    if (!usuarioId) {
      return NextResponse.json(
        { message: "Se requiere cabecera de autenticación Authorization: Bearer <token> o X-User-Id." },
        { status: 401 }
      );
    }

    const params = await context.params;
    const validacionParams = EventoAsistenciaSocialIdParamSchema.safeParse(params);
    if (!validacionParams.success) {
      return NextResponse.json(
        {
          message: "Identificador de evento de asistencia social inválido.",
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

    const validacionBody = AsignarAsistenteSocialInputSchema.safeParse(bodyJson);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de asignación de asistente social inválidos.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const eventoActualizado = await asignarAsistenteSocialService(
      validacionParams.data.id,
      validacionBody.data,
      usuarioId
    );

    return NextResponse.json(
      {
        message: "Asistente social asignado exitosamente al evento de asistencia social.",
        data: eventoActualizado,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof EventoAsistenciaSocialNotFoundError ||
      error instanceof AsistenteSocialNotFoundError
    ) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (
      error instanceof EstadoEventoAsistenciaSocialInvalidoError ||
      error instanceof AsistenteSocialNoDisponibleError
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al asignar asistente social al evento:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al asignar asistente social." },
      { status: 500 }
    );
  }
}
