import { NextRequest, NextResponse } from "next/server";
import { CrearEventoRecuperacionInputSchema } from "@/modules/eventos-atp/recuperacion.schema";
import {
  crearEventoRecuperacionService,
  PatrullaNoDisponibleError,
  StockInsuficienteError,
  NotFoundError,
} from "@/modules/eventos-atp/recuperacion.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_CREAR_RECUPERACION } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

/**
 * POST /api/eventos-atp/recuperacion
 * Endpoint operativo para que el Encargado registre eventos de recuperación directos
 * y despache patrullas verificadoras con recursos logísticos a terreno sin incidente previo (HU-29).
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Extraer usuario autenticado y verificar permiso RBAC
    const usuarioId = await extraerUsuarioId(req);
    const usuarioAutenticado = await verificarPermiso(usuarioId, PERMISO_CREAR_RECUPERACION);

    // 2. Extraer y validar cuerpo de la petición con Zod
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud (payload JSON) es requerido." },
        { status: 400 }
      );
    }

    const resultadoValidacion = CrearEventoRecuperacionInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para el evento de recuperación.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Ejecutar servicio de negocio
    const eventoCreado = await crearEventoRecuperacionService(
      resultadoValidacion.data,
      usuarioAutenticado.id
    );

    return NextResponse.json(
      {
        message: "Evento de recuperación registrado y patrulla despachada exitosamente.",
        data: eventoCreado,
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

    if (error instanceof PatrullaNoDisponibleError || error instanceof StockInsuficienteError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("Error al registrar evento de recuperación:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la creación del evento de recuperación." },
      { status: 500 }
    );
  }
}
