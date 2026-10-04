import { NextRequest, NextResponse } from "next/server";
import {
  PuntoCriticoIdParamSchema,
  ActualizarPuntoCriticoBodySchema,
} from "@/modules/eventos-atp/punto-critico.schema";
import {
  obtenerDetallePuntoCritico,
  editarPuntoCritico,
} from "@/modules/eventos-atp/punto-critico.service";
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
 * GET /api/puntos-criticos/[id]
 * Obtiene el detalle consolidado de un punto crítico para precarga en formularios de edición.
 */
export async function GET(req: NextRequest, context: RouteContext) {
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

    const detalle = await obtenerDetallePuntoCritico(id, usuarioId);
    return NextResponse.json(detalle, { status: 200 });
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

    console.error("Error al obtener detalle de punto crítico:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/puntos-criticos/[id]
 * Modifica las características, factores de riesgo y ubicación geográfica de un punto crítico (HU-55).
 * Valida rol Administrador, inmutabilidad del código institucional y restricción de reubicación con misiones activas.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
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

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud no es un JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody = ActualizarPuntoCriticoBodySchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Parámetros de edición de punto crítico inválidos.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const puntoActualizado = await editarPuntoCritico(
      id,
      validacionBody.data,
      usuarioId
    );

    return NextResponse.json(puntoActualizado, { status: 200 });
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

    console.error("Error al actualizar punto crítico:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
