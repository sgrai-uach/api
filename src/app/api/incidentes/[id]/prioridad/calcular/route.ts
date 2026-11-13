import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CalcularPrioridadInputSchema } from "@/modules/incidentes/prioridad.schema";
import { prioridadService } from "@/modules/incidentes/prioridad.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_VERIFICAR_MISION_TERRENO } from "@/modules/seguridad/permisos.constants";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
} from "@/modules/seguridad/errors";

const IncidenteIdParamSchema = z.string().uuid({
  message: "El identificador del incidente debe ser un UUID válido.",
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/incidentes/[id]/prioridad/calcular (HU-38)
 *
 * Permite a la PWA calcular preliminarmente la `prioridad_sugerida` del incidente
 * a partir de los datos del formulario de evaluación en terreno (tamaño de núcleo familiar,
 * niños, adultos mayores, personas con discapacidad, electrodependientes, mascotas,
 * compromiso de vivienda y riesgos activos), retornando la prioridad sugerida, el puntaje
 * y los factores gatillantes.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenUserId = await extraerUsuarioId(request);
    const headerUserId = request.headers.get("x-user-id");
    const usuarioId = tokenUserId || headerUserId;

    await verificarPermiso(usuarioId, PERMISO_VERIFICAR_MISION_TERRENO);

    const { id } = await context.params;
    const validacionId = IncidenteIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message:
            "El identificador del incidente proporcionado no es un UUID válido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: "id",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la petición no es un JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody = CalcularPrioridadInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message:
            "Datos de entrada inválidos para el cálculo de prioridad sugerida.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await prioridadService.calcularPrioridadSugerida(
      validacionId.data,
      validacionBody.data
    );

    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
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

    console.error("Error en POST /api/incidentes/[id]/prioridad/calcular:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al calcular la prioridad sugerida del incidente.",
      },
      { status: 500 }
    );
  }
}

