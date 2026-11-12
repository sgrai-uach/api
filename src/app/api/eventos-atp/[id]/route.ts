import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { obtenerEventoAtpDetalleService } from "@/modules/eventos-atp/evento-atp.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";

const UuidParamSchema = z.string().uuid();

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/eventos-atp/{id}
 * Detalle de un Evento ATP con sus entidades vinculadas (H60).
 */
export async function GET(req: NextRequest, props: RouteContext) {
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

    const { id } = await props.params;
    const validacion = UuidParamSchema.safeParse(id);

    if (!validacion.success) {
      return NextResponse.json(
        {
          message:
            "El identificador del Evento ATP proporcionado no es un UUID válido.",
        },
        { status: 400 }
      );
    }

    const detalle = await obtenerEventoAtpDetalleService(validacion.data, usuarioId);

    return NextResponse.json(
      {
        message: "Evento ATP obtenido exitosamente.",
        data: detalle,
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

    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    console.error("Error al obtener Evento ATP:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar el detalle del Evento ATP.",
      },
      { status: 500 }
    );
  }
}
