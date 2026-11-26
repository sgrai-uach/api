import { NextRequest, NextResponse } from "next/server";
import {
  MisionIdParamSchema,
  CrearReporteVerificacionInputSchema,
} from "@/modules/misiones/mision.schema";
import { enviarReporteVerificacionService } from "@/modules/misiones/mision.service";
import { exigirUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_CREAR_REPORTE } from "@/modules/seguridad/permisos.constants";
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
 * POST /api/misiones/[id]/reporte (HU-39 / HU-86)
 *
 * Permite a la patrulla verificadora enviar el informe técnico consolidado de verificación
 * en terreno y cerrar su misión inicial de patrullaje.
 *
 * Reglas de negocio y transacción atómica:
 * 1. Requiere autenticación válida y el permiso RBAC `reportes:crear`.
 * 2. Requiere que la misión se encuentre en estado `EN_CURSO` y pertenezca a la patrulla asignada.
 * 3. Persiste el informe en `reporte_terreno` con `evaluador_id = usuario.id`, `tipo_reporte = 'VERIFICACION_CIERRE'`,
 *    rescatando `personas_afectadas` desde el reporte previo de prioridad (HU-38) si no fue modificado.
 * 4. Permite indicar `requiere_asistencia_social` (Ficha FIBE) y vincular evidencia fotográfica (sección preparada para HU-43).
 * 5. Actualiza `mision.estado = 'COMPLETADA'` con `fecha_cierre = CURRENT_TIMESTAMP`, libera a la patrulla
 *    (`patrulla_verificadora.estado = 'DISPONIBLE'`) y registra el hito `VERIFICACION_COMPLETADA` en `mision_hito`.
 * 6. Si el dictamen es `NO_ABORDABLE` (requiere `motivo_no_abordable` >= 15 caracteres), transiciona
 *    `incidente.estado = 'NO_ABORDABLE'` con `fecha_cierre = CURRENT_TIMESTAMP` y motivo fundado.
 * 7. Emite `mision:actualizada`, `incidente:actualizado` y `patrulla:actualizada` / `patrulla:liberada` por Socket.io / Redis.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Validar autenticación JWT Bearer estricta y permiso RBAC `reportes:crear`
    const usuarioId = await exigirUsuarioId(request);

    const usuarioAutenticado = await verificarPermiso(
      usuarioId,
      PERMISO_CREAR_REPORTE
    );

    // 2. Validar parámetro de ruta UUID
    const { id } = await context.params;
    const validacionId = MisionIdParamSchema.safeParse(id);
    if (!validacionId.success) {
      return NextResponse.json(
        {
          message:
            "El identificador de la misión proporcionado no es un UUID válido.",
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
      CrearReporteVerificacionInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message:
            "Datos de entrada inválidos para el informe técnico de verificación en terreno.",
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

    // 4. Ejecutar servicio transaccional y notificaciones en tiempo real
    const resultado = await enviarReporteVerificacionService(
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
      return NextResponse.json(
        {
          message: error.message,
          errors: [
            {
              campo: "reporte",
              mensaje: error.message,
            },
          ],
        },
        { status: 400 }
      );
    }

    console.error("Error en POST /api/misiones/[id]/reporte:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar el informe técnico de verificación.",
      },
      { status: 500 }
    );
  }
}
