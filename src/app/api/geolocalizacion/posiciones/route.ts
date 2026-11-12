import { NextRequest, NextResponse } from "next/server";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError } from "@/modules/seguridad/errors";
import { obtenerTodasLasPosicionesActivas } from "@/modules/geolocalizacion/telemetria-cache.service";

/**
 * GET /api/geolocalizacion/posiciones
 *
 * Retorna la lista de últimas posiciones GPS conocidas de todas las unidades
 * en terreno (patrullas y cuadrillas) que se encuentren vigentes en la caché de telemetría.
 * Permite hidratar de forma instantánea el mapa del Centro de Mando en sgrai-web.
 */
export async function GET(request: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(request);
    if (!usuarioId) {
      return NextResponse.json(
        { message: "Se requiere cabecera de autenticación Authorization: Bearer <token>." },
        { status: 401 }
      );
    }

    const posiciones = await obtenerTodasLasPosicionesActivas();

    return NextResponse.json(
      {
        message: "Posiciones activas obtenidas exitosamente.",
        data: posiciones,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    console.error("[GET /api/geolocalizacion/posiciones] Error:", error);
    return NextResponse.json(
      { message: "Error interno al obtener posiciones de telemetría." },
      { status: 500 }
    );
  }
}
