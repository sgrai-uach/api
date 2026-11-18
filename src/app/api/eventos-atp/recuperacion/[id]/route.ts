import { NextRequest, NextResponse } from "next/server";
import { RecuperacionIdParamSchema } from "@/modules/eventos-atp/recuperacion.schema";
import {
  obtenerDetalleRecuperacionService,
  NotFoundError,
} from "@/modules/eventos-atp/recuperacion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import {
  PERMISO_LEER_MISION,
  PERMISO_CREAR_RECUPERACION,
  PERMISO_ASIGNAR_MISION,
} from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/eventos-atp/recuperacion/[id]
 * Consulta el detalle integral de un evento de recuperación territorial,
 * incluyendo sus misiones operativas desplegadas y los insumos logísticos asignados.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado y verificar autorización RBAC
    const usuarioId = await extraerUsuarioId(req);
    
    // Permitir lectura a usuarios con 'misiones:leer', 'recuperacion:crear' o 'misiones:asignar'
    try {
      await verificarPermiso(usuarioId, PERMISO_LEER_MISION);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        try {
          await verificarPermiso(usuarioId, PERMISO_CREAR_RECUPERACION);
        } catch {
          await verificarPermiso(usuarioId, PERMISO_ASIGNAR_MISION);
        }
      } else {
        throw err;
      }
    }

    // 2. Extraer y validar parámetro de ruta UUID
    const { id } = await context.params;
    const validacionId = RecuperacionIdParamSchema.safeParse({ id });
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "Identificador de evento de recuperación inválido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Ejecutar servicio de detalle
    const detalle = await obtenerDetalleRecuperacionService(validacionId.data.id);

    return NextResponse.json(
      {
        message: "Detalle del evento de recuperación obtenido exitosamente.",
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

    console.error("Error al obtener detalle de evento de recuperación:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la consulta del evento de recuperación." },
      { status: 500 }
    );
  }
}

