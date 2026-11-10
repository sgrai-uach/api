import { NextRequest, NextResponse } from "next/server";
import { verificarTerrenoMisiones } from "@/modules/seguridad/auth.guard";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";
import {
  NotificacionIdParamSchema,
  ActualizarEstadoNotificacionInputSchema,
} from "@/modules/misiones/notificacion-mision.schema";
import { actualizarEstadoNotificacionService } from "@/modules/misiones/notificacion-mision.service";

/**
 * PATCH /api/terreno/notificaciones/[id]/estado
 *
 * Registra de forma idempotente el acuse de recibo técnico automático ('RECIBIDA')
 * o el acuse de lectura operativo ('LEIDA') emitido por el cliente de terreno (sgrai-pwa).
 *
 * Requiere:
 * - Autenticación JWT válida (Bearer token).
 * - Permiso RBAC 'misiones:terreno:verificar'.
 * - Pertenencia a la patrulla verificadora destinataria de la notificación (salvo Administrador).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Validar autenticación y permiso RBAC 'misiones:terreno:verificar'
    const usuarioAutenticado = await verificarTerrenoMisiones(request);

    // 2. Validar parámetro de ruta :id (UUID)
    const { id } = await context.params;
    const validacionId = NotificacionIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "El parámetro de ruta no es un identificador UUID válido.",
          errors: validacionId.error.issues.map((i) => ({
            campo: "id",
            mensaje: i.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Parsear y validar cuerpo de la petición
    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un formato JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody = ActualizarEstadoNotificacionInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de acuse de notificación inválidos.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const esAdmin =
      usuarioAutenticado.rolNombre === "Administrador" ||
      usuarioAutenticado.rolCodigo === "ADMIN";

    // 4. Procesar actualización idempotente
    const resultado = await actualizarEstadoNotificacionService(
      validacionId.data,
      validacionBody.data.estado,
      usuarioAutenticado.id,
      esAdmin
    );

    return NextResponse.json(resultado, { status: 200 });
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

    console.error("Error en PATCH /api/terreno/notificaciones/[id]/estado:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al actualizar acuse de notificación." },
      { status: 500 }
    );
  }
}

