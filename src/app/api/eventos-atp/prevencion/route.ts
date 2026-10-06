import { NextRequest, NextResponse } from "next/server";
import { CrearEventoPrevencionInputSchema } from "@/modules/eventos-atp/evento-prevencion.schema";
import {
  crearEventoPrevencionService,
  PatrullaNoDisponibleError,
  NotFoundError,
  StockInsuficienteError,
} from "@/modules/eventos-atp/evento-prevencion.service";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/modules/seguridad/errors";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { seguridadService } from "@/modules/seguridad/service";
import { PERMISO_CREAR_EVENTO_PREVENCION } from "@/modules/seguridad/permisos.constants";

/**
 * POST /api/eventos-atp/prevencion
 * Creación de un nuevo evento de prevención georreferenciado y despacho
 * de misión operativa a una patrulla verificadora disponible (HU-30).
 */
export async function POST(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);

    // Validar autorización RBAC (requiere permiso prevencion:eventos:crear o rol Administrador/Encargado)
    await seguridadService.validarAccesoRoles(usuarioId, [
      PERMISO_CREAR_EVENTO_PREVENCION,
    ]);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const resultadoValidacion = CrearEventoPrevencionInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para el evento de prevención.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const nuevoEvento = await crearEventoPrevencionService(
      resultadoValidacion.data,
      usuarioId!
    );

    return NextResponse.json(
      {
        message: "Evento de prevención creado y patrulla despachada exitosamente.",
        data: nuevoEvento,
      },
      { status: 201 }
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

    if (error instanceof PatrullaNoDisponibleError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    if (error instanceof StockInsuficienteError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al crear evento de prevención:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar la creación del evento de prevención.",
      },
      { status: 500 }
    );
  }
}
