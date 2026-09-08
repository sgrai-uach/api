import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { VerificarAvisoInputSchema } from "@/modules/incidentes/schema";
import {
  ConflictError,
  incidentesService,
  NotFoundError,
} from "@/modules/incidentes/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/incidentes/avisos/:id/verificar
 * Acción "Verificar y Enviar": transforma atómicamente el aviso a Incidente formal.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const operadorId = request.headers.get("x-user-id");
    if (!operadorId) {
      return NextResponse.json(
        { error: "Cabecera X-User-Id obligatoria para auditar al operador responsable" },
        { status: 401 }
      );
    }

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
