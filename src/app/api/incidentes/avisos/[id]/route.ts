import { NextRequest, NextResponse } from "next/server";
import {
  ConflictError,
  incidentesService,
  NotFoundError,
} from "../../../../../modules/incidentes/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/incidentes/avisos/:id
 * Consulta el detalle completo de un aviso por su UUID.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const aviso = await incidentesService.obtenerDetalleAviso(id);
    return NextResponse.json(aviso, { status: 200 });
  } catch (error: unknown) {
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
