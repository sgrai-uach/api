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
import { seguridadService } from "@/modules/seguridad/service";
import {
  PERMISO_CREAR_RECUPERACION,
  PERMISO_EDITAR_RECUPERACION,
} from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/eventos-atp/recuperacion/[id]
 * Consulta el detalle estructurado de un operativo de recuperación post-desastre (H73 / H74).
 * Autentica estrictamente vía JWT (extraerUsuarioId) y requiere permiso 'recuperacion:leer'.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    const { id } = await context.params;
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

    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    console.error("Error al obtener detalle de operativo de recuperación:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al obtener el detalle del operativo de recuperación.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/eventos-atp/recuperacion/[id]
 * Modifica la descripción de tareas, fecha estimada de término, dotación de insumos
 * y/o patrulla verificadora asignada a un operativo de recuperación activo (HU-74).
 * Requiere permiso 'recuperacion:crear', 'recuperacion:editar' o rol Encargado/Administrador.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado por JWT y verificar permiso RBAC (CA-5 / BUG-H74-API-03)
    const usuarioId = await extraerUsuarioId(req);
    await seguridadService.validarAccesoRoles(
      usuarioId,
      [PERMISO_CREAR_RECUPERACION, PERMISO_EDITAR_RECUPERACION],
      "Acceso denegado. Se requiere permiso 'recuperacion:crear', 'recuperacion:editar' o rol Encargado."
    );

    // 2. Validar parámetro de ruta [id]
    const { id } = await context.params;
    const validacionId = RecuperacionIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de operativo inválido.",
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
      usuarioId!
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
