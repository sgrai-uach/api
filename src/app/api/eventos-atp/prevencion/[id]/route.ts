import { NextRequest, NextResponse } from "next/server";
import {
  EditarEventoPrevencionInputSchema,
  EventoPrevencionIdParamSchema,
} from "@/modules/eventos-atp/evento-prevencion.schema";
import {
  editarEventoPrevencionService,
  obtenerDetalleEventoPrevencionService,
  EventoPrevencionNoEditableError,
  NotFoundError,
  StockInsuficienteError,
} from "@/modules/eventos-atp/evento-prevencion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";
import {
  PERMISO_ASIGNAR_MISION,
  PERMISO_CREAR_EVENTO_PREVENCION,
  PERMISO_LEER_EVENTOS_PREVENCION,
  PERMISO_LEER_MISION,
} from "@/modules/seguridad/permisos.constants";
import { seguridadService } from "@/modules/seguridad/service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/eventos-atp/prevencion/[id]
 * Consulta el detalle integral de un evento de prevención comunal,
 * incluyendo punto crítico PostGIS, misiones tácticas desplegadas y recursos asignados (HU-33).
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    // Permitir lectura a usuarios con permisos de prevención o misiones
    await seguridadService.validarAccesoRoles(
      usuarioId,
      [
        PERMISO_LEER_EVENTOS_PREVENCION,
        PERMISO_CREAR_EVENTO_PREVENCION,
        PERMISO_LEER_MISION,
        PERMISO_ASIGNAR_MISION,
      ],
      "Acceso denegado. Se requiere permiso 'prevencion:eventos:leer', 'prevencion:eventos:crear', 'misiones:leer' o 'misiones:asignar'."
    );

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

    const detalle = await obtenerDetalleEventoPrevencionService(paramValidacion.data.id);

    return NextResponse.json(
      {
        message: "Detalle del evento de prevención obtenido exitosamente.",
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

    console.error("Error al obtener detalle de evento de prevención:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar la consulta del evento de prevención.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/eventos-atp/prevencion/[id]
 * Modifica tareas planificadas, nombre, prioridad, fecha estimada de finalización
 * y recursos materiales vinculados a un evento de prevención activo (H77).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    // Validar autorización RBAC (requiere permiso prevencion:eventos:crear)
    await seguridadService.validarAccesoRoles(usuarioId, [
      PERMISO_CREAR_EVENTO_PREVENCION,
    ]);

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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const bodyValidacion = EditarEventoPrevencionInputSchema.safeParse(body);
    if (!bodyValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para editar el evento de prevención.",
          errors: bodyValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const eventoActualizado = await editarEventoPrevencionService(
      paramValidacion.data.id,
      bodyValidacion.data,
      usuarioId!
    );

    return NextResponse.json(
      {
        message: "Evento de prevención actualizado exitosamente.",
        data: eventoActualizado,
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

    if (
      error instanceof EventoPrevencionNoEditableError ||
      error instanceof StockInsuficienteError
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al editar evento de prevención:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al actualizar el evento de prevención.",
      },
      { status: 500 }
    );
  }
}
