import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { VerificarAvisoInputSchema } from "@/modules/incidentes/schema";
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
 * POST /api/incidentes/avisos/:id/verificar
 * Acción "Verificar y Enviar": transforma atómicamente el aviso a Incidente formal.
 * Requiere permiso incidentes:avisos:verificar.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const operadorId = await extraerUsuarioId(request);
    await verificarPermiso(operadorId, "incidentes:avisos:verificar");

    const body = await request.json();
    const parsedInput = VerificarAvisoInputSchema.parse(body);

    const resultado = await incidentesService.verificarAviso(
      id,
      parsedInput,
      operadorId
    );

    return NextResponse.json(resultado, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Datos de verificación inválidos",
          detalles: error.issues,
        },
        { status: 400 }
      );
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Error en POST /api/incidentes/avisos/[id]/verificar:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al verificar el aviso" },
      { status: 500 }
    );
  }
}

export const PATCH = POST;
