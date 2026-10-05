import { NextRequest, NextResponse } from "next/server";
import {
  CrearEventoAsistenciaSocialInputSchema,
  ListarEventosAsistenciaSocialQuerySchema,
} from "@/modules/eventos-atp/asistencia-social.schema";
import {
  crearEventoAsistenciaSocialService,
  listarEventosAsistenciaSocialService,
} from "@/modules/eventos-atp/asistencia-social.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

/**
 * GET /api/eventos-atp/asistencia-social
 * Lista los eventos de asistencia social con filtros (ej. estado=PENDIENTE) y paginación (H28).
 * Diseñado para alimentar el panel de eventos pendientes para asignación de asistentes sociales.
 */
export async function GET(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);
    if (!usuarioId) {
      return NextResponse.json(
        { message: "Se requiere cabecera de autenticación Authorization: Bearer <token> o X-User-Id." },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const resultadoValidacion = ListarEventosAsistenciaSocialQuerySchema.safeParse(queryParams);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros de consulta inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const resultadoPaginado = await listarEventosAsistenciaSocialService(
      resultadoValidacion.data,
      usuarioId
    );

    return NextResponse.json(resultadoPaginado, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error al listar eventos de asistencia social:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la solicitud." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/eventos-atp/asistencia-social
 * Registra un nuevo evento de asistencia social excepcional enfocado en FIBE (H28).
 * No requiere vinculación obligatoria a un registro previo en la entidad Incidente.
 * Emite notificación reactiva vía Socket.io para actualización instantánea del panel de pendientes.
 */
export async function POST(req: NextRequest) {
  try {
    const usuarioId = await extraerUsuarioId(req);
    if (!usuarioId) {
      return NextResponse.json(
        { message: "Se requiere cabecera de autenticación Authorization: Bearer <token> o X-User-Id." },
        { status: 401 }
      );
    }

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud no es un JSON válido." },
        { status: 400 }
      );
    }

    const resultadoValidacion = CrearEventoAsistenciaSocialInputSchema.safeParse(bodyJson);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de creación de evento de asistencia social inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const eventoCreado = await crearEventoAsistenciaSocialService(
      resultadoValidacion.data,
      usuarioId
    );

    return NextResponse.json(
      {
        message: "Evento de asistencia social registrado exitosamente.",
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

    console.error("Error al registrar evento de asistencia social:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la creación del evento de asistencia social." },
      { status: 500 }
    );
  }
}
