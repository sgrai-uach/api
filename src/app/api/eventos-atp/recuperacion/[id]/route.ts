import { NextRequest, NextResponse } from "next/server";
import { RecuperacionIdParamSchema } from "@/modules/eventos-atp/recuperacion.schema";
import {
  obtenerDetalleRecuperacionService,
  verificarAutorizacionLecturaRecuperacion,
  NotFoundError,
} from "@/modules/eventos-atp/recuperacion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/eventos-atp/recuperacion/[id]
 * Consulta el detalle integral de un evento/operativo de recuperación territorial para el drawer lateral (HU-73)
 * y para la visualización del mapa táctico (HU-32).
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado mediante JWT Bearer obligatorio (BUG-H73-API-01: sin bypass)
    const usuarioId = await extraerUsuarioId(req);

    // 2. Extraer y validar parámetro de ruta UUID
    const { id } = await context.params;
    const validacionId = RecuperacionIdParamSchema.safeParse({ id });
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "El identificador del operativo debe ser un UUID válido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Verificar autorización RBAC
    await verificarAutorizacionLecturaRecuperacion(usuarioId);

    // 4. Ejecutar servicio de detalle
    const detalle = await obtenerDetalleRecuperacionService(validacionId.data.id, usuarioId);

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

    if (error instanceof NotFoundError || (error as { name?: string }).name === "NotFoundError") {
      return NextResponse.json({ message: (error as Error).message }, { status: 404 });
    }

    console.error("Error al obtener detalle de evento de recuperación:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la consulta del evento de recuperación." },
      { status: 500 }
    );
  }
}
