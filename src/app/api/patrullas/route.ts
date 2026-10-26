import { NextRequest, NextResponse } from "next/server";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";
import { ListarPatrullasQuerySchema } from "@/modules/recursos-y-personal/patrulla.schema";
import { listarPatrullasService } from "@/modules/recursos-y-personal/patrulla.service";

/**
 * GET /api/patrullas
 *
 * Consulta paginada y filtrada del estado operativo de las patrullas verificadoras
 * para el Centro de Mando del Encargado (HU-16).
 *
 * Filtros admitidos en query parameters:
 * - delegacionId: UUID de la delegación territorial adscrita.
 * - estado: DISPONIBLE | EN_VERIFICACION | EN_PREVENCION | EN_RECUPERACION | EN_MISION | NO_DISPONIBLE
 * - busqueda: Filtro textual sobre el nombre de patrulla o líder.
 * - page: Número de página (default 1).
 * - limit: Tamaño de página (default 20, max 100).
 *
 * Requiere autorización RBAC: permiso 'misiones:leer' (Encargado, Administrador, Supervisor).
 */
export async function GET(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    const searchParams = req.nextUrl.searchParams;
    const queryParams: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const validacion = ListarPatrullasQuerySchema.safeParse(queryParams);
    if (!validacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros de consulta inválidos.",
          errors: validacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await listarPatrullasService(validacion.data, usuarioId);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error en GET /api/patrullas:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al consultar patrullas verificadoras." },
      { status: 500 }
    );
  }
}
