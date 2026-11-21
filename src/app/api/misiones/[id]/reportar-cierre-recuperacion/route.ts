import { NextRequest, NextResponse } from "next/server";
import {
  MisionIdParamSchema,
  ReportarCierreRecuperacionInputSchema,
} from "@/modules/misiones/mision.schema";
import { reportarCierreRecuperacionService } from "@/modules/misiones/mision.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_VERIFICAR_MISION_TERRENO } from "@/modules/seguridad/permisos.constants";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "@/modules/seguridad/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/misiones/[id]/reportar-cierre-recuperacion
 * Registra el reporte de término en terreno y consumo de insumos de una patrulla
 * para un operativo de recuperación en curso, dejando el cierre listo para confirmación
 * formal en el Centro de Mando.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const usuarioId = await extraerUsuarioId(req);
    const usuarioAutenticado = await verificarPermiso(
      usuarioId,
      PERMISO_VERIFICAR_MISION_TERRENO
    );
    const esAdmin =
      usuarioAutenticado.rol === "Administrador" ||
      usuarioAutenticado.rol === "ADMIN";

    const { id } = await context.params;
    const validacionId = MisionIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "El identificador de la misión no es un UUID válido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: "id",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud (payload JSON) es requerido." },
        { status: 400 }
      );
    }

    const validacion = ReportarCierreRecuperacionInputSchema.safeParse(body);
    if (!validacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para el reporte de cierre.",
          errors: validacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultado = await reportarCierreRecuperacionService(
      validacionId.data,
      usuarioAutenticado.id,
      esAdmin,
      validacion.data
    );

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al registrar reporte de cierre de recuperación:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al registrar el reporte de cierre." },
      { status: 500 }
    );
  }
}
