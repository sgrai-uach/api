import { NextRequest, NextResponse } from "next/server";
import {
  AsignarRecursosPrevencionInputSchema,
  EventoPrevencionIdParamSchema,
} from "@/modules/eventos-atp/evento-prevencion.schema";
import {
  asignarRecursosPrevencionService,
  BadRequestError,
  ConflictoEstadoError,
  NotFoundError,
  PatrullaNoDisponibleError,
  RecursoNoDisponibleError,
  StockInsuficienteError,
} from "@/modules/eventos-atp/evento-prevencion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";
import { PERMISO_ASIGNAR_MISION } from "@/modules/seguridad/permisos.constants";
import { seguridadService } from "@/modules/seguridad/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/eventos-atp/prevencion/[id]/recursos
 * Endpoint operativo para asignar una patrulla verificadora disponible e insumos/activos
 * del inventario logístico a un evento programado de prevención comunal (HU-33).
 *
 * Requiere el permiso RBAC 'misiones:asignar'.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado y validar permiso RBAC estricto misiones:asignar
    const usuarioId = await extraerUsuarioId(req);
    const usuarioAutenticado = await seguridadService.validarAccesoRoles(
      usuarioId,
      [PERMISO_ASIGNAR_MISION],
      "Acceso denegado. Se requiere el permiso 'misiones:asignar' para asignar patrullas y recursos a eventos de prevención."
    );
    const autenticadoId = usuarioAutenticado?.id || usuarioId!;

    // 2. Extraer y validar parámetro de ruta UUID
    const params = await context.params;
    const paramValidacion = EventoPrevencionIdParamSchema.safeParse(params);
    if (!paramValidacion.success) {
      return NextResponse.json(
        {
          message: "Identificador de evento de prevención inválido.",
          errors: paramValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Parsear y validar cuerpo JSON con Zod
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud (payload JSON) es requerido." },
        { status: 400 }
      );
    }

    const bodyValidacion = AsignarRecursosPrevencionInputSchema.safeParse(body);
    if (!bodyValidacion.success) {
      return NextResponse.json(
        {
          message:
            "Datos de entrada inválidos para la asignación de recursos a prevención.",
          errors: bodyValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 4. Ejecutar servicio de negocio transaccional FOR UPDATE (§3.6)
    const asignacionRealizada = await asignarRecursosPrevencionService(
      paramValidacion.data.id,
      bodyValidacion.data,
      autenticadoId
    );

    return NextResponse.json(
      {
        message:
          "Patrulla y recursos logísticos asignados exitosamente al evento de prevención.",
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

    console.error("Error al asignar recursos al evento de prevención:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar la asignación de recursos a prevención.",
      },
      { status: 500 }
    );
  }
}
