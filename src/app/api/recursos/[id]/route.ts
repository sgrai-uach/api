import { NextRequest, NextResponse } from "next/server";
import {
  RecursoIdParamSchema,
  ActualizarRecursoInputSchema,
} from "@/modules/recursos-y-personal/recurso.schema";
import {
  obtenerRecursoDetalle,
  editarRecurso,
  eliminarRecurso,
} from "@/modules/recursos-y-personal/recurso.service";
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
 * GET /api/recursos/[id]
 * Retorna la información completa pre-cargada de un recurso específico para el formulario de edición (HU-8).
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const usuarioId = extraerUsuarioId(req);
    const { id } = await context.params;

    const validacionId = RecursoIdParamSchema.safeParse({ id });
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de recurso inválido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const recurso = await obtenerRecursoDetalle(id, usuarioId);

    return NextResponse.json(recurso, { status: 200 });
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

    console.error("Error al obtener detalle del recurso:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/recursos/[id]
 * Modifica las características, inventario y estado operativo de un recurso (HU-8).
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const usuarioId = extraerUsuarioId(req);
    const { id } = await context.params;

    const validacionId = RecursoIdParamSchema.safeParse({ id });
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de recurso inválido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody = ActualizarRecursoInputSchema.safeParse(body);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para la actualización del recurso.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const recursoActualizado = await editarRecurso(
      id,
      validacionBody.data,
      usuarioId
    );

    return NextResponse.json(
      {
        message: "Recurso actualizado exitosamente",
        data: recursoActualizado,
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
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al actualizar recurso:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/recursos/[id]
 * Da de baja lógica a un recurso del sistema (HU-9).
 * Bloquea la eliminación con 409 Conflict si el recurso está en uso en terreno o asignado a misiones activas.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const usuarioId = extraerUsuarioId(req);
    const { id } = await context.params;

    const validacionId = RecursoIdParamSchema.safeParse({ id });
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de recurso inválido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await eliminarRecurso(id, usuarioId);

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

    console.error("Error al eliminar recurso:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}

