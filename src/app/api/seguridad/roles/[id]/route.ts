import { NextRequest, NextResponse } from "next/server";
import { verificarAdministrador } from "@/modules/seguridad/auth.guard";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";
import { seguridadService } from "@/modules/seguridad/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/seguridad/roles/[id]
 *
 * Retorna el detalle interactivo de un rol específico con todos sus permisos asignados.
 *
 * Criterio de seguridad: Accesible única y exclusivamente por Administradores.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await verificarAdministrador(request);
    const { id } = await context.params;

    const resultado = await seguridadService.obtenerDetalleRol(id);
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

    console.error("Error en GET /api/seguridad/roles/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar el detalle del perfil" },
      { status: 500 }
    );
  }
}
