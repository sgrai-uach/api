import { NextRequest, NextResponse } from "next/server";
import { PuntoCriticoIdParamSchema } from "@/modules/eventos-atp/punto-critico.schema";
import { eliminarPuntoCritico } from "@/modules/eventos-atp/punto-critico.service";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "@/modules/seguridad/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function extraerUsuarioId(req: NextRequest): string | null {
  let usuarioId = req.headers.get("x-user-id");
  if (!usuarioId) {
    const auth = req.headers.get("authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      usuarioId = auth.substring(7).trim();
    }
  }
  return usuarioId;
}

/**
 * DELETE /api/puntos-criticos/[id]
 * Desactiva (borrado lógico) un punto crítico comunal (HU-56).
 * Bloquea la acción con 409 Conflict si existen misiones preventivas activas en curso o patrullas asignadas.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const usuarioId = extraerUsuarioId(req);
    const { id } = await context.params;

    const validacionId = PuntoCriticoIdParamSchema.safeParse({ id });
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de punto crítico inválido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await eliminarPuntoCritico(id, usuarioId);

    return NextResponse.json(resultado, { status: 200 });
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
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al desactivar punto crítico:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
