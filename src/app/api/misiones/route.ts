import { NextRequest, NextResponse } from "next/server";
import { ListarMisionesQuerySchema } from "@/modules/misiones/mision-listado.schema";
import { listarMisionesService } from "@/modules/misiones/mision-listado.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/errors";

/**
 * GET /api/misiones
 *
 * Listado paginado de misiones operativas del SGRAI para el Encargado.
 * Admite filtros multicriterio combinados con lógica conjuntiva (AND):
 * - estado: PLANIFICADA | DESPACHADA | EN_CURSO | COMPLETADA | CANCELADA | RECHAZADA
 * - tipoMision: VERIFICACION | ATENCION_CUADRILLA | PREVENCION | RECUPERACION | ASISTENCIA_SOCIAL
 * - prioridad: BAJA | MEDIA | ALTA | CRITICA
 * - delegacionId: UUID de delegación territorial
 * - incidenteId: UUID de incidente asociado
 * - cuadrillaId: UUID de cuadrilla asignada
 * - patrullaId: UUID de patrulla verificadora asignada
 * - busqueda: Búsqueda textual sobre código, título o descripción
 * - page, limit: Paginación estándar SGRAI
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

    const searchParams = request.nextUrl.searchParams;
    const queryRaw = Object.fromEntries(searchParams.entries());

    const validacion = ListarMisionesQuerySchema.safeParse(queryRaw);
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

    const resultado = await listarMisionesService(validacion.data);
    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    console.error("Error en GET /api/misiones:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al consultar misiones." },
      { status: 500 }
    );
  }
}
