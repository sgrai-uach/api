import { NextRequest, NextResponse } from "next/server";
import { RecuperacionIdParamSchema } from "@/modules/eventos-atp/recuperacion.schema";
import {
  obtenerDetalleRecuperacionService,
  NotFoundError,
} from "@/modules/eventos-atp/recuperacion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/eventos-atp/recuperacion/[id]
 * Consulta el detalle estructurado de un operativo de recuperación post-desastre (H73).
 * Alimenta el drawer lateral en 'sgrai-web' con la información de insumos, patrulla e historial.
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
