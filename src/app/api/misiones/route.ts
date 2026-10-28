import { NextRequest, NextResponse } from "next/server";
import { ListarMisionesQuerySchema } from "@/modules/misiones/mision-listado.schema";
import { listarMisionesService } from "@/modules/misiones/mision-listado.service";
import { extraerUsuarioId, verificarAsignarMision } from "@/modules/seguridad/auth.guard";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";
import { CrearMisionVerificacionSchema } from "@/modules/misiones/mision.schema";
import { asignarPatrullaVerificacionService } from "@/modules/misiones/mision.service";

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
 * Despacho y asignación de misión operativa a terreno (HU-20: Verificación primaria ICS).
 *
 * Flujo:
 * 1. Exige permiso RBAC 'misiones:asignar' (Encargado o Administrador).
 * 2. Valida payload Zod: incidenteId (UUID), patrullaId (UUID), opcionales (titulo, descripcion, prioridad).
 * 3. Ejecuta transacción atómica:
 *    - Bloqueo y verificación de incidente en estado 'REPORTADO'.
 *    - Bloqueo y actualización atómica de patrulla a 'EN_VERIFICACION' si está 'DISPONIBLE'.
 *    - Si la patrulla ya fue asignada concurrentemente, aborta con 409 Conflict.
 *    - Inserción de registro en 'mision' con tipo 'VERIFICACION' y estado 'DESPACHADA'.
 *    - Actualización de 'incidente.estado' a 'VERIFICANDO'.
 *    - Registro de hito inicial en 'mision_hito'.
 * 4. Emite eventos WebSocket a 'patrulla:{id}', 'encargado' y 'mapa'.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validar RBAC 'misiones:asignar'
    const usuarioAutenticado = await verificarAsignarMision(request);

    // 2. Parsear JSON del body
    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un formato JSON válido." },
        { status: 400 }
      );
    }

    // 3. Validar con Zod
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

    // 4. Ejecutar servicio de asignación
    const resultado = await asignarPatrullaVerificacionService(
      validacion.data,
      usuarioAutenticado.id
    );

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
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error en POST /api/misiones:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al crear y despachar la misión." },
      { status: 500 }
    );
  }
}

