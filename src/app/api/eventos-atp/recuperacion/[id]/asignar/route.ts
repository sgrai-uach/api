import { NextRequest, NextResponse } from "next/server";
import {
  RecuperacionIdParamSchema,
  AsignarRecursosRecuperacionInputSchema,
} from "@/modules/eventos-atp/recuperacion.schema";
import {
  asignarRecursosRecuperacionService,
  PatrullaNoDisponibleError,
  StockInsuficienteError,
  RecursoNoDisponibleError,
  BadRequestError,
  ConflictoEstadoError,
  NotFoundError,
} from "@/modules/eventos-atp/recuperacion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_ASIGNAR_MISION } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/eventos-atp/recuperacion/[id]/asignar
 * Endpoint operativo para asignar patrulla verificadora e inventario logístico
 * a un evento de recuperación territorial comunal (HU-32).
 * 
 * Requiere el permiso RBAC 'misiones:asignar' (Encargado o Administrador).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado y verificar permiso RBAC misiones:asignar
    const usuarioId = await extraerUsuarioId(req);
    const usuarioAutenticado = await verificarPermiso(usuarioId, PERMISO_ASIGNAR_MISION);

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

    // 3. Extraer y validar cuerpo de la petición con Zod
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud (payload JSON) es requerido." },
        { status: 400 }
      );
    }

    const resultadoValidacion = AsignarRecursosRecuperacionInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para la asignación de recursos a recuperación.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 4. Ejecutar servicio de negocio con control transaccional FOR UPDATE
    const asignacionRealizada = await asignarRecursosRecuperacionService(
      validacionId.data.id,
      resultadoValidacion.data,
      usuarioAutenticado.id
    );

    return NextResponse.json(
      {
        message: "Patrulla y recursos logísticos asignados exitosamente al evento de recuperación.",
        data: asignacionRealizada,
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

    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (
      error instanceof PatrullaNoDisponibleError ||
      error instanceof StockInsuficienteError ||
      error instanceof RecursoNoDisponibleError ||
      error instanceof ConflictoEstadoError
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al asignar recursos al evento de recuperación:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la asignación de recursos a recuperación." },
      { status: 500 }
    );
  }
}

