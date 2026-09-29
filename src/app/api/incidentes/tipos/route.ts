import { NextResponse } from "next/server";
import { incidentesService } from "@/modules/incidentes/service";

/**
 * GET /api/incidentes/tipos
 * Devuelve el catálogo oficial de tipos de incidentes habilitados.
 */
export async function GET() {
  try {
    const tipos = await incidentesService.listarTiposIncidentes();
    return NextResponse.json({ data: tipos }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error en GET /api/incidentes/tipos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al consultar tipos de incidentes" },
      { status: 500 }
    );
  }
}
