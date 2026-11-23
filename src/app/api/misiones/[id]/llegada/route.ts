import { NextRequest, NextResponse } from "next/server";
import { MisionIdParamSchema } from "@/modules/misiones/mision.schema";
import { ReportarLlegadaBodySchema } from "@/modules/misiones/mision-llegada.schema";
import { reportarLlegadaCuadrillaService } from "@/modules/misiones/mision.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_EJECUTAR_MISION_TERRENO } from "@/modules/seguridad/permisos.constants";
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
 * POST /api/misiones/[id]/llegada (HU-42)
 *
 * Permite al Delegado de cuadrilla reportar el arribo a terreno de la brigada operativa
 * capturando las coordenadas GPS y hora actual mediante la Geolocation API.
 *
 * Transición y reglas aplicadas:
 * 1. Registra el hito 'LLEGADA_TERRENO' en la bitácora 'mision_hito'.
 * 2. Transiciona 'mision.estado' a 'EN_CURSO' e inicializa 'mision.fecha_inicio' (si estaba en null).
 * 3. Actualiza 'personal.ultima_ubicacion' y 'personal.ultima_actualizacion_ubicacion' de los miembros de la cuadrilla y su delegado.
 * 4. Emite el evento WebSocket 'mision:hito_registrado' hacia la línea de tiempo del Encargado (H23).
 *
 * Requiere el permiso RBAC 'misiones:terreno:ejecutar' y valida que el usuario sea el delegado asignado (o Administrador).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado (Bearer Token o cabecera interna x-user-id)
    const tokenUserId = await extraerUsuarioId(request);
    const headerUserId = request.headers.get("x-user-id");
    const usuarioId = tokenUserId || headerUserId;

    const usuarioAutenticado = await verificarPermiso(
      usuarioId,
      PERMISO_EJECUTAR_MISION_TERRENO
    );

    // 2. Validar parámetro de ruta UUID
    const { id } = await context.params;
    const validacionId = MisionIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "El identificador de la misión proporcionado no es un UUID válido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: "id",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Validar cuerpo de la petición (coordenadas GPS obligatorias)
    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la petición debe ser un objeto JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody = ReportarLlegadaBodySchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de geolocalización o cuerpo de petición inválidos.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const esAdmin =
      usuarioAutenticado.rol === "Administrador" || usuarioAutenticado.rol === "ADMIN";

    // 4. Ejecutar servicio de dominio con persistencia atómica y WebSockets
    const resultado = await reportarLlegadaCuadrillaService(
      validacionId.data,
      usuarioAutenticado.id,
      esAdmin,
      validacionBody.data
    );

    return NextResponse.json(resultado, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error al reportar llegada a terreno (POST /api/misiones/[id]/llegada):", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar el reporte de llegada a terreno." },
      { status: 500 }
    );
  }
}

