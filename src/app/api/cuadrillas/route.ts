import { NextRequest, NextResponse } from "next/server";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "@/modules/seguridad/errors";
import { CrearCuadrillaInputSchema } from "@/modules/recursos-y-personal/cuadrilla.schema";
import { crearCuadrilla } from "@/modules/recursos-y-personal/cuadrilla.service";

/**
 * POST /api/cuadrillas
 * Da de alta una nueva cuadrilla operativa en el sistema asignando su nombre,
 * delegación municipal base y delegado responsable (H79).
 */
export async function POST(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const resultadoValidacion = CrearCuadrillaInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const nuevaCuadrilla = await crearCuadrilla(resultadoValidacion.data, usuarioId);

    return NextResponse.json(
      {
        message: "Cuadrilla operativa creada exitosamente",
        data: nuevaCuadrilla,
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

    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error al registrar cuadrilla operativa:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
