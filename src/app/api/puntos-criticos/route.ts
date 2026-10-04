import { NextRequest, NextResponse } from "next/server";
import { ListarPuntosCriticosQuerySchema } from "@/modules/eventos-atp/punto-critico.schema";
import { listarPuntosCriticos } from "@/modules/eventos-atp/punto-critico.service";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/modules/seguridad/errors";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";

/**
 * GET /api/puntos-criticos
 * Consulta y monitoreo de la lista de puntos críticos en Valdivia (HU-57).
 * Acceso restringido exclusivamente al perfil Administrador del SGRAI.
 */
export async function GET(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    // Parsear parámetros de consulta (query params)
    const searchParams = req.nextUrl.searchParams;
    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const resultadoValidacion = ListarPuntosCriticosQuerySchema.safeParse(queryParams);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros de consulta inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const respuestaPaginada = await listarPuntosCriticos(
      resultadoValidacion.data,
      usuarioId
    );

    return NextResponse.json(respuestaPaginada, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error al consultar listado de puntos críticos:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}
