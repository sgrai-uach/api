import { NextRequest, NextResponse } from "next/server";
import { ListarMisionesQuerySchema } from "@/modules/misiones/mision-listado.schema";
import { listarMisionesService } from "@/modules/misiones/mision-listado.service";
import {
  AsignarCuadrillaMisionInputSchema,
  CrearMisionVerificacionSchema,
} from "@/modules/misiones/mision.schema";
import {
  asignarCuadrillaMisionService,
  asignarPatrullaVerificacionService,
} from "@/modules/misiones/mision.service";
import { extraerUsuarioId, verificarAsignarMision } from "@/modules/seguridad/auth.guard";
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
 * POST /api/misiones
 *
 * Despacho y asignación de misión operativa a terreno:
 * 1. HU-20: Verificación primaria ICS con patrulla verificadora (tipo_mision = 'VERIFICACION').
 * 2. HU-21: Atención operativa con cuadrilla (tipo_mision = 'ATENCION_CUADRILLA') y liberación de patrulla previa.
 *
 * Flujo:
 * 1. Exige permiso RBAC 'misiones:asignar' (Encargado o Administrador) mediante JWT Bearer token validado.
 * 2. Parsea JSON del body.
 * 3. Si incluye cuadrillaId o tipoMision 'ATENCION_CUADRILLA', despacha cuadrilla (HU-21).
 *    De lo contrario, despacha patrulla verificadora (HU-20).
 * 4. Ejecuta transacción atómica y emite notificaciones WebSocket reactivas.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar RBAC 'misiones:asignar' mediante JWT estricto
    const usuarioAutenticado = await verificarAsignarMision(request);

    // 2. Parsear JSON del body
    let bodyRaw: Record<string, unknown>;
    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un formato JSON válido." },
        { status: 400 }
      );
    }

    // 3. Evaluar y despachar según tipo de asignación (Cuadrilla vs Patrulla Verificadora)
    if (bodyRaw && (bodyRaw.cuadrillaId || bodyRaw.tipoMision === "ATENCION_CUADRILLA")) {
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

      const resultado = await asignarCuadrillaMisionService(
        validacion.data,
        usuarioAutenticado.id
      );

      return NextResponse.json(resultado, { status: 201 });
    } else {
      const validacion = CrearMisionVerificacionSchema.safeParse(bodyRaw);
      if (!validacion.success) {
        return NextResponse.json(
          {
            message: "Datos de misión inválidos.",
            errors: validacion.error.issues.map((issue) => ({
              campo: issue.path.join("."),
              mensaje: issue.message,
            })),
          },
          { status: 400 }
        );
      }

      const resultado = await asignarPatrullaVerificacionService(
        validacion.data,
        usuarioAutenticado.id
      );

      return NextResponse.json(resultado, { status: 201 });
    }
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

    console.error("Error en POST /api/misiones:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la misión." },
      { status: 500 }
    );
  }
}
