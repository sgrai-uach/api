import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActualizarPrioridadIncidenteInputSchema } from "@/modules/incidentes/prioridad.schema";
import { prioridadService } from "@/modules/incidentes/prioridad.service";
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
 * PATCH /api/incidentes/[id]/prioridad (HU-38)
 *
 * Permite a la patrulla verificadora asignar o modificar la prioridad del incidente
 * basándose en la evaluación técnica en terreno y la sugerencia calculada por el sistema,
 * emitiendo un reporte versionado de evaluación al Centro de Mando.
 *
 * Reglas de negocio:
 * 1. Requiere autenticación y el permiso RBAC `misiones:terreno:verificar`.
 * 2. Requiere que la patrulla haya aceptado la misión (estado `EN_CURSO`).
 * 3. Calcula `prioridad_sugerida` a partir del formulario de evaluación en terreno.
 * 4. Si la prioridad seleccionada difiere de la sugerida, exige `justificacion_prioridad` de al menos 5 caracteres.
 * 5. Actualiza atómicamente `incidente.prioridad`, `incidente.prioridad_sugerida`, `incidente.justificacion_prioridad`,
 *    inserta un nuevo reporte versionado en `reporte_terreno` (`version_reporte = N + 1`) y registra el hito en `mision_hito`.
 * 6. Emite `incidente:actualizado` y `mision:actualizada` por Socket.io al Centro de Mando.
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
          message:
            "El identificador del incidente proporcionado no es un UUID válido.",
          errors: validacionId.error.issues.map((issue) => ({
            campo: "id",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Parsear y validar cuerpo JSON
    let bodyRaw: unknown;
    try {
      bodyRaw = await request.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la petición no es un JSON válido." },
        { status: 400 }
      );
    }

    const validacionBody =
      ActualizarPrioridadIncidenteInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message:
            "Datos de entrada inválidos para la evaluación y asignación de prioridad del incidente.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const esAdmin =
      usuarioAutenticado.rol === "Administrador" ||
      usuarioAutenticado.rol === "ADMIN";

    // 4. Ejecutar servicio de dominio
    const resultado = await prioridadService.actualizarPrioridadIncidente(
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
      return NextResponse.json(
        {
          message: error.message,
          errors: [
            {
              campo: "justificacion_prioridad",
              mensaje: error.message,
            },
          ],
        },
        { status: 400 }
      );
    }

    console.error("Error en PATCH /api/incidentes/[id]/prioridad:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar la asignación de prioridad del incidente.",
      },
      { status: 500 }
    );
  }
}

