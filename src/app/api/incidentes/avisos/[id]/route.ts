import { NextRequest, NextResponse } from "next/server";
import {
  ConflictError,
  incidentesService,
  NotFoundError,
} from "@/modules/incidentes/service";

import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/incidentes/avisos/:id
 * Consulta el detalle completo de un aviso por su UUID.
 * Requiere permiso incidentes:avisos:leer.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const usuarioId = await extraerUsuarioId(request);
    await verificarPermiso(usuarioId, "incidentes:avisos:leer");

    const aviso = await incidentesService.obtenerDetalleAviso(id);
    return NextResponse.json(aviso, { status: 200 });
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
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Error en GET /api/incidentes/avisos/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar el detalle del aviso" },
      { status: 500 }
    );
  }
}
