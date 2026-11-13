import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ReclasificarTipologiaInputSchema } from "@/modules/incidentes/tipologia.schema";
import { tipologiaService } from "@/modules/incidentes/tipologia.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_VERIFICAR_MISION_TERRENO } from "@/modules/seguridad/permisos.constants";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "@/modules/seguridad/errors";

const IncidenteIdParamSchema = z.string().uuid({
  message: "El identificador del incidente debe ser un UUID válido.",
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/incidentes/[id]/tipologia (HU-37)
 *
 * Permite a la patrulla verificadora reclasificar técnicamente la tipología del incidente
 * tras la evaluación presencial en terreno.
 *
 * Reglas de negocio:
 * 1. Requiere autenticación y el permiso RBAC `misiones:terreno:verificar`.
 * 2. Solo se puede reclasificar si la patrulla ha aceptado la misión asignada (misión en estado `EN_CURSO`).
 * 3. Se debe proporcionar una justificación obligatoria del cambio.
 * 4. Actualiza atómicamente `incidente.tipo_incidente_id` y `incidente.tipo_afectacion`.
 * 5. Registra el hito cronológico en `mision_hito`.
 * 6. Emite el evento WebSocket `incidente:actualizado` al Centro de Mando (sala `sala:encargados`).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    // 1. Validar autenticación y permiso RBAC
    const tokenUserId = await extraerUsuarioId(request);
    const headerUserId = request.headers.get("x-user-id");
    const usuarioId = tokenUserId || headerUserId;

    const usuarioAutenticado = await verificarPermiso(
      usuarioId,
      PERMISO_VERIFICAR_MISION_TERRENO
    );

    // 2. Validar parámetro de ruta (UUID del incidente)
    const { id } = await context.params;
    const validacionId = IncidenteIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message: "El identificador del incidente proporcionado no es un UUID válido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: "id",
            mensaje: issue.message,
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
        { message: "El cuerpo de la petición no es un JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody = ReclasificarTipologiaInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para la reclasificación de tipología.",
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

    // 4. Ejecutar servicio de dominio con transacción y notificación WebSocket
    const resultado = await tipologiaService.reclasificarTipologia(
      validacionId.data,
      usuarioAutenticado.id,
      esAdmin,
      validacionBody.data
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
    if (error instanceof ConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    if (error instanceof BadRequestError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    console.error("Error en PATCH /api/incidentes/[id]/tipologia:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la reclasificación de tipología." },
      { status: 500 }
    );
  }
}

