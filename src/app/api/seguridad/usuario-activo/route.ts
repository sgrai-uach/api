import { NextRequest, NextResponse } from "next/server";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";
import { seguridadService } from "@/modules/seguridad/service";

/**
 * GET /api/seguridad/usuario-activo
 *
 * Retorna los datos del usuario autenticado, su rol y la lista de todos los
 * permisos asignados dinámicamente en tiempo real (HU-5).
 */
export async function GET(request: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(request);
    const usuarioActivo = await seguridadService.obtenerUsuarioActivo(usuarioId);
    return NextResponse.json({ data: usuarioActivo }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    console.error("Error en GET /api/seguridad/usuario-activo:", error);
    return NextResponse.json(
      { error: "Error interno al consultar usuario activo y permisos" },
      { status: 500 }
    );
  }
}
