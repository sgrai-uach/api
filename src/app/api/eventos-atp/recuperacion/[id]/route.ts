import { NextRequest, NextResponse } from "next/server";
import {
  RecuperacionIdParamSchema,
  EditarEventoRecuperacionInputSchema,
} from "@/modules/eventos-atp/recuperacion.schema";
import {
  obtenerDetalleRecuperacionService,
  editarEventoRecuperacionService,
  NotFoundError,
  StockInsuficienteError,
  PatrullaNoDisponibleError,
  RecuperacionNoEditableError,
  FechaEstimadaInvalidaError,
} from "@/modules/eventos-atp/recuperacion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import {
  PERMISO_EDITAR_RECUPERACION,
} from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/eventos-atp/recuperacion/[id]
 * Consulta el detalle estructurado de un operativo de recuperación post-desastre (H73 / H74).
 * Alimenta el drawer lateral y el modal de edición en 'sgrai-web' con recursos, patrulla e historial.
 * Requiere que el usuario posea el permiso 'recuperacion:leer' (Encargado, Administrador o Supervisor).
 */
export async function GET(req: NextRequest, props: RouteContext) {
  try {
    // 1. Extraer autenticación
    const usuarioId =
      (await extraerUsuarioId(req)) ||
      req.headers.get("x-user-id")?.trim() ||
      null;

    if (!usuarioId) {
      return NextResponse.json(
        { message: "Se requiere cabecera de autenticación Authorization: Bearer <token> o X-User-Id." },
        { status: 401 }
      );
    }

    // 2. Extraer y validar parámetro de ruta UUID
    const { id } = await props.params;
    const resultadoValidacion = RecuperacionIdParamSchema.safeParse(id);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "El identificador del operativo de recuperación no es un UUID válido.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: "id",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Consultar servicio de negocio
    const detalle = await obtenerDetalleRecuperacionService(
      resultadoValidacion.data,
      usuarioId
    );

    return NextResponse.json(
      {
        message: "Detalle de operativo de recuperación obtenido exitosamente.",
        data: detalle,
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

    if (
      error instanceof NotFoundError ||
      (typeof error === "object" && error !== null && (error as { name?: string }).name === "NotFoundError")
    ) {
      return NextResponse.json({ message: (error as Error).message }, { status: 404 });
    }

    console.error("Error al obtener detalle de operativo de recuperación:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar el detalle del operativo de recuperación." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/eventos-atp/recuperacion/[id]
 * Modifica la descripción de tareas, fecha estimada de término, dotación de insumos
 * y/o patrulla verificadora asignada a un operativo de recuperación activo,
 * bloqueando estados COMPLETADA y CANCELADA (HU-74).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado y verificar permiso RBAC recuperacion:editar
    const usuarioId = await extraerUsuarioId(req);
    const usuarioAutenticado = await verificarPermiso(usuarioId, PERMISO_EDITAR_RECUPERACION);

    // 2. Validar parámetro de ruta [id]
    const { id } = await context.params;
    const validacionId = RecuperacionIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "El identificador del operativo de recuperación no es un UUID válido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: "id",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Extraer y validar cuerpo de la petición con Zod
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud (payload JSON) es requerido." },
        { status: 400 }
      );
    }

    const resultadoValidacion = EditarEventoRecuperacionInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para editar el operativo de recuperación.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 4. Ejecutar servicio de negocio
    const operativoActualizado = await editarEventoRecuperacionService(
      validacionId.data,
      resultadoValidacion.data,
      usuarioAutenticado.id
    );

    return NextResponse.json(
      {
        message: "Planificación del operativo de recuperación actualizada exitosamente.",
        data: operativoActualizado,
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

    if (error instanceof FechaEstimadaInvalidaError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (
      error instanceof RecuperacionNoEditableError ||
      error instanceof StockInsuficienteError ||
      error instanceof PatrullaNoDisponibleError
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al editar operativo de recuperación:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar la edición del operativo de recuperación.",
      },
      { status: 500 }
    );
  }
}
