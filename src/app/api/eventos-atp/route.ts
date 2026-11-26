import { NextRequest, NextResponse } from "next/server";
import { CrearEventoAtpInputSchema } from "@/modules/eventos-atp/evento-atp.schema";
import { crearEventoAtpService } from "@/modules/eventos-atp/evento-atp.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";

/**
 * POST /api/eventos-atp
 * Registra un nuevo Evento de Alerta Temprana Preventiva (H61).
 *
 * - Requiere autenticación JWT.
 * - Requiere rol Administrador o el permiso eventos_atp:crear.
 * - Persiste evento_atp y evento_atp_delegacion en una sola transacción.
 * - Emite el evento WebSocket evento_atp:creado.
 */
export async function POST(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    if (!usuarioId) {
      return NextResponse.json(
        {
          message:
            "Se requiere cabecera de autenticación Authorization: Bearer <token>.",
        },
        { status: 401 }
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

    const resultadoValidacion = CrearEventoAtpInputSchema.safeParse(bodyJson);

    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de creación de Evento ATP inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const eventoCreado = await crearEventoAtpService(
      resultadoValidacion.data,
      usuarioId
    );

    return NextResponse.json(
      {
        message: "Evento ATP registrado exitosamente.",
        data: eventoCreado,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error al crear Evento ATP:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar la creación del Evento ATP.",
      },
      { status: 500 }
    );
  }
}
