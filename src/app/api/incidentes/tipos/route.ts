import { NextRequest, NextResponse } from "next/server";
import { TIPOS_AFECTACION } from "@/modules/incidentes/aviso-incidente.schema";
import { tipologiaService } from "@/modules/incidentes/tipologia.service";

/**
 * GET /api/incidentes/tipos
 *
 * Retorna el catálogo oficial de tipos de incidente.
 * - Sin parámetros: retorna el arreglo canónico de nombres (compatibilidad con Chatbot y tests existentes).
 * - Con `?catalogo=true` o `?detallado=true`: consulta la tabla `tipo_incidente` y retorna los registros completos
 *   con { id, nombre, descripcion, activo } para poblar el selector de reclasificación en la PWA (HU-37).
 */
export async function GET(request?: NextRequest) {
  try {
    const searchParams = request?.nextUrl?.searchParams;
    const esCatalogoDetallado =
      searchParams?.get("catalogo") === "true" ||
      searchParams?.get("detallado") === "true";

    if (esCatalogoDetallado) {
      const tipos = await tipologiaService.listarTipos();
      return NextResponse.json(
        {
          message: "Catálogo oficial de tipos de incidente obtenido exitosamente.",
          data: tipos,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message: "Tipos de afectación obtenidos exitosamente.",
        data: TIPOS_AFECTACION,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al consultar tipos de incidente:", error);
    return NextResponse.json(
      { message: "Error interno al obtener los tipos de incidente." },
      { status: 500 }
    );
  }
}
