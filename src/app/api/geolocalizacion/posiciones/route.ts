import { NextRequest, NextResponse } from "next/server";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/errors";
import { ListarPosicionesQuerySchema } from "@/modules/geolocalizacion/telemetria.schema";
import { listarPosicionesActivasService } from "@/modules/geolocalizacion/telemetria.service";

/**
 * GET /api/geolocalizacion/posiciones
 *
 * Retorna la lista de últimas posiciones GPS conocidas de todas las unidades
 * en terreno (patrullas y cuadrillas) vigentes en la caché de telemetría (Redis).
 * Requiere sesión autenticada y permiso RBAC 'misiones:leer' (o perfil Administrador).
 * Admite filtros opcionales por query params: ?tipoUnidad=PATRULLA|CUADRILLA&unidadId=<UUID>.
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

    const queryRaw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const validacionQuery = ListarPosicionesQuerySchema.safeParse(queryRaw);
    if (!validacionQuery.success) {
      return NextResponse.json(
        {
          message: "Parámetros de consulta inválidos para posiciones de telemetría.",
          errors: validacionQuery.error.issues.map((issue) => ({
            campo: issue.path.join(".") || "query",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const posiciones = await listarPosicionesActivasService(usuarioId, validacionQuery.data);

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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    console.error("[GET /api/geolocalizacion/posiciones] Error:", error);
    return NextResponse.json(
      { message: "Error interno al obtener posiciones de telemetría." },
      { status: 500 }
    );
  }
}
