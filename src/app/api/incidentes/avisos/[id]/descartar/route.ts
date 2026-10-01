import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { DescartarAvisoInputSchema } from "@/modules/incidentes/schema";
import {
  ConflictError,
  incidentesService,
  NotFoundError,
} from "@/modules/incidentes/service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/incidentes/avisos/:id/descartar
 * Acción "Descartar": rechaza un aviso falso o duplicado con justificación obligatoria.
 * Requiere permiso incidentes:avisos:descartar.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const usuarioId = await extraerUsuarioId(request);
    const operador = await verificarPermiso(usuarioId, "incidentes:avisos:descartar");

    const body = await request.json();
    const parsedInput = DescartarAvisoInputSchema.parse(body);

    const resultado = await incidentesService.descartarAviso(
      id,
      parsedInput,
      operador.id
    );

    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Datos de descarte inválidos",
          detalles: error.issues,
        },
        { status: 400 }
      );
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Error en POST /api/incidentes/avisos/[id]/descartar:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al descartar el aviso" },
      { status: 500 }
    );
  }
}

export const PATCH = POST;
