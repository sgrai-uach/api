import { NextRequest, NextResponse } from "next/server";
import { ListarMisionesQuerySchema } from "@/modules/misiones/mision-listado.schema";
import { listarMisionesService } from "@/modules/misiones/mision-listado.service";
import { AsignarCuadrillaMisionInputSchema } from "@/modules/misiones/mision.schema";
import { asignarCuadrillaMisionService } from "@/modules/misiones/mision.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_ASIGNAR_MISION } from "@/modules/seguridad/permisos.constants";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "@/modules/seguridad/errors";

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

/**
 * POST /api/misiones (HU-21)
 *
 * Asigna y despacha una cuadrilla operativa a un incidente en estado REPORTADO o VERIFICANDO,
 * ejecutando una transacción atómica que:
 * 1. Crea la misión con tipo_mision = 'ATENCION_CUADRILLA', cuadrilla_id y estado = 'DESPACHADA'.
 * 2. Actualiza cuadrilla.estado = 'EN_MISION'.
 * 3. Actualiza incidente.estado = 'EN_ATENCION'.
 * 4. Aplica la Regla de Negocio Crítica §3.2 (ICS): Si el incidente tenía una patrulla verificadora
 *    asignada en terreno, su misión de verificación concluye (COMPLETADA) con hito 'VERIFICACION_FINALIZADA'
 *    y la patrulla queda automáticamente liberada a estado 'DISPONIBLE'.
 * 5. Registra el hito 'CUADRILLA_DESPACHADA' en mision_hito.
 * 6. Emite notificaciones WebSocket reactivas a cuadrilla, patrulla liberada y Centro de Mando.
 *
 * Requiere el permiso RBAC 'misiones:asignar'.
 */
export async function POST(request: NextRequest) {
  try {
    const tokenUserId = await extraerUsuarioId(request);
    const headerUserId = request.headers.get("x-user-id");
    const usuarioId = tokenUserId || headerUserId;

    if (!usuarioId) {
      return NextResponse.json(
        { message: "Se requiere cabecera de autenticación Authorization: Bearer <token>." },
        { status: 401 }
      );
    }

    // Validación de permisos RBAC
    await verificarPermiso(usuarioId, PERMISO_ASIGNAR_MISION);

    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la petición debe ser un formato JSON válido." },
        { status: 400 }
      );
    }

    const validacion = AsignarCuadrillaMisionInputSchema.safeParse(bodyRaw);
    if (!validacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros de entrada inválidos para asignar cuadrilla a la misión.",
          errors: validacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await asignarCuadrillaMisionService(validacion.data, usuarioId);

    return NextResponse.json(resultado, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      if (error.codigo) {
        return NextResponse.json(
          {
            statusCode: 409,
            error: "Conflict",
            codigo: error.codigo,
            message: error.message,
            detalles: error.detalles,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error inesperado en POST /api/misiones:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al asignar la cuadrilla a la misión." },
      { status: 500 }
    );
  }
}
