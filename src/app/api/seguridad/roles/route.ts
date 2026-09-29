import { NextRequest, NextResponse } from "next/server";
import { verificarAdministrador } from "@/modules/seguridad/auth.guard";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";
import { seguridadService } from "@/modules/seguridad/service";

/**
 * GET /api/seguridad/roles
 *
 * Retorna el listado completo de perfiles/roles registrados en el sistema
 * y las acciones/permisos a los que cada uno tiene acceso.
 *
 * Criterio de seguridad: Accesible única y exclusivamente por Administradores.
 */
export async function GET(request: NextRequest) {
  try {
    await verificarAdministrador(request);

    const resultado = await seguridadService.listarRoles();
    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("Error en GET /api/seguridad/roles:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar roles y permisos" },
      { status: 500 }
    );
  }
}
