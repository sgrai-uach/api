import { NextRequest, NextResponse } from "next/server";
import { verificarAdministrador } from "@/modules/seguridad/auth.guard";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";
import { seguridadService } from "@/modules/seguridad/service";

/**
 * GET /api/seguridad/permisos
 *
 * Retorna el catálogo completo de permisos registrados en la base de datos,
 * clasificados por módulo funcional.
 *
 * Criterio de seguridad: Accesible única y exclusivamente por Administradores activos.
 */
export async function GET(request: NextRequest) {
  try {
    await verificarAdministrador(request);

    const resultado = await seguridadService.listarPermisos();
    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("Error en GET /api/seguridad/permisos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar el catálogo de permisos" },
      { status: 500 }
    );
  }
}
