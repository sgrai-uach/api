import { NextRequest, NextResponse } from "next/server";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "@/modules/seguridad/errors";
import {
  CuadrillaIdParamSchema,
  EditarCuadrillaInputSchema,
} from "@/modules/recursos-y-personal/cuadrilla.schema";
import { editarCuadrilla } from "@/modules/recursos-y-personal/cuadrilla.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/cuadrillas/[id]
 * Modifica los datos de una cuadrilla, reasigna su delegado y ajusta los trabajadores
 * y recursos logísticos que conforman su dotación operativa (H81).
 * 
 * Requiere permiso RBAC 'recursos:editar' o rol Administrador.
 * Si la cuadrilla está EN_MISION o tiene misiones activas en curso, bloquea con 409 Conflict.
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const usuarioId = await extraerUsuarioId(req);
    const { id } = await context.params;

    // 1. Validar formato UUID del parámetro de ruta
    const validacionId = CuadrillaIdParamSchema.safeParse({ id });
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de cuadrilla inválido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 2. Parsear cuerpo de la solicitud JSON
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    // 3. Validar payload contra el esquema Zod
    const validacionBody = EditarCuadrillaInputSchema.safeParse(body);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 4. Invocar servicio de dominio
    const cuadrillaActualizada = await editarCuadrilla(
      id,
      validacionBody.data,
      usuarioId
    );

    return NextResponse.json(
      {
        message: "Cuadrilla operativa actualizada exitosamente",
        data: cuadrillaActualizada,
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

    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error al actualizar cuadrilla operativa:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
