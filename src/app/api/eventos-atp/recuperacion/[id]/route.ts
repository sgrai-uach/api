import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EditarEventoRecuperacionInputSchema } from "@/modules/eventos-atp/recuperacion.schema";
import {
  editarEventoRecuperacionService,
  NotFoundError,
  StockInsuficienteError,
  RecuperacionNoEditableError,
  FechaEstimadaInvalidaError,
} from "@/modules/eventos-atp/recuperacion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_EDITAR_RECUPERACION } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const IdParamSchema = z.string().uuid("El identificador del operativo debe ser un UUID válido.");

/**
 * PATCH /api/eventos-atp/recuperacion/[id]
 * Modifica la descripción de tareas, fecha estimada de término y dotación de insumos
 * de un operativo de recuperación activo, bloqueando estados COMPLETADA y CANCELADA (HU-74).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado y verificar permiso RBAC recuperacion:editar
    const usuarioId = await extraerUsuarioId(req);
    const usuarioAutenticado = await verificarPermiso(usuarioId, PERMISO_EDITAR_RECUPERACION);

    // 2. Validar parámetro de ruta [id]
    const { id } = await context.params;
    const validacionId = IdParamSchema.safeParse(id);
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
      error instanceof StockInsuficienteError
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
