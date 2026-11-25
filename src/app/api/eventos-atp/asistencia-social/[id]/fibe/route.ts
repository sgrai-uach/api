import { NextRequest, NextResponse } from "next/server";
import {
  EventoAsistenciaSocialIdParamSchema,
  RegistrarFichaFibeInputSchema,
} from "@/modules/eventos-atp/asistencia-social.schema";
import {
  registrarFichaFibeService,
  EventoAsistenciaSocialNotFoundError,
  EstadoEventoAsistenciaSocialInvalidoError,
  FolioFibeDuplicadoError,
} from "@/modules/eventos-atp/asistencia-social.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

/**
 * PATCH /api/eventos-atp/asistencia-social/[id]/fibe
 * Registra o actualiza los datos oficiales recopilados en terreno de la Ficha Básica de Emergencia (FIBE)
 * para un caso de asistencia social asignado o en evaluación FIBE (HU-71).
 */
export async function PATCH(
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

    const validacionBody = RegistrarFichaFibeInputSchema.safeParse(bodyJson);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de Ficha FIBE inválidos.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const eventoActualizado = await registrarFichaFibeService(
      validacionParams.data.id,
      validacionBody.data,
      usuarioId
    );

    return NextResponse.json(
      {
        message: "Ficha FIBE registrada exitosamente en el expediente de asistencia social.",
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

    if (error instanceof EventoAsistenciaSocialNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (
      error instanceof EstadoEventoAsistenciaSocialInvalidoError ||
      error instanceof FolioFibeDuplicadoError
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al registrar Ficha FIBE en evento de asistencia social:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al registrar Ficha FIBE." },
      { status: 500 }
    );
  }
}
