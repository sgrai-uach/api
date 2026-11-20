import { NextRequest, NextResponse } from "next/server";
import {
  RecuperacionIdParamSchema,
  CerrarRecuperacionInputSchema,
} from "@/modules/eventos-atp/recuperacion.schema";
import {
  cerrarRecuperacionService,
  NotFoundError,
  ConsumoInvalidoError,
  RecuperacionNoCerrableError,
} from "@/modules/eventos-atp/recuperacion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_CERRAR_RECUPERACION } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/eventos-atp/recuperacion/[id]/cerrar
 * Decreta la conclusión formal de un operativo de recuperación en estado EN_EJECUCION,
 * reintegra remanentes no consumidos al inventario, cierra la misión táctica y libera
 * la patrulla verificadora si no posee otras misiones activas (HU-75).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado y verificar permiso RBAC recuperacion:cerrar
    const usuarioId = await extraerUsuarioId(req);
    const usuarioAutenticado = await verificarPermiso(usuarioId, PERMISO_CERRAR_RECUPERACION);

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

    const resultadoValidacion = CerrarRecuperacionInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para concluir el operativo de recuperación.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 4. Ejecutar servicio transaccional de cierre
    const data = await cerrarRecuperacionService(
      validacionId.data,
      resultadoValidacion.data,
      usuarioAutenticado.id
    );

    return NextResponse.json(
      {
        message: "Operativo de recuperación concluido exitosamente.",
        data,
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

    if (error instanceof ConsumoInvalidoError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof RecuperacionNoCerrableError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al concluir operativo de recuperación:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar el cierre del operativo de recuperación.",
      },
      { status: 500 }
    );
  }
}
