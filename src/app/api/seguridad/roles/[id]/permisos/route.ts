import { NextRequest, NextResponse } from "next/server";
import { verificarAdministrador } from "@/modules/seguridad/auth.guard";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";
import { ActualizarPermisosRolInputSchema } from "@/modules/seguridad/schema";
import { seguridadService } from "@/modules/seguridad/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/seguridad/roles/[id]/permisos
 *
 * Actualiza masiva y atómicamente los permisos asociados a un rol específico.
 *
 * Criterio de seguridad: Accesible única y exclusivamente por Administradores activos.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const usuario = await verificarAdministrador(request);
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const parseResult = ActualizarPermisosRolInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Payload de permisos inválido",
          detalles: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const resultado = await seguridadService.actualizarPermisosRol(
      id,
      parseResult.data.permisoIds,
      usuario
    );

    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Error en PUT /api/seguridad/roles/[id]/permisos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al actualizar los permisos del perfil" },
      { status: 500 }
    );
  }
}
