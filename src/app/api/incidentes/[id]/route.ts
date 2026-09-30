import { NextRequest, NextResponse } from "next/server";
import { obtenerDetalleIncidenteService } from "@/modules/incidentes/incidente-kanban.service";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { PERMISO_KANBAN_INCIDENTES } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";
import { z } from "zod";

const UuidParamSchema = z.string().uuid();

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, props: RouteContext) {
  try {
    // 1. Extraer cabecera y validar autorización RBAC
    const usuarioId = await extraerUsuarioId(req);
    await verificarPermiso(usuarioId, PERMISO_KANBAN_INCIDENTES);

    // 2. Extraer y validar parámetro de ruta
    const { id } = await props.params;
    const resultadoValidacion = UuidParamSchema.safeParse(id);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        { message: "El identificador de incidente proporcionado no es un UUID válido." },
        { status: 400 }
      );
    }

    // 3. Consultar detalle del incidente
    const detalle = await obtenerDetalleIncidenteService(resultadoValidacion.data);
    if (!detalle) {
      return NextResponse.json(
        { message: "No se encontró ningún incidente con el identificador proporcionado." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "Detalle de incidente obtenido exitosamente.",
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

    console.error("Error al obtener detalle del incidente:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al obtener el detalle del incidente." },
      { status: 500 }
    );
  }
}
