import { NextRequest, NextResponse } from "next/server";
import {
  MisionIdParamSchema,
  CerrarMisionCuadrillaInputSchema,
} from "@/modules/misiones/mision.schema";
import { cerrarMisionCuadrillaService } from "@/modules/misiones/mision.service";
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
 * POST /api/misiones/[id]/cerrar (HU-68)
 *
 * Permite al Delegado de Cuadrilla completar y enviar el informe técnico final
 * de resolución de la emergencia al culminar los trabajos en terreno.
 *
 * Reglas de negocio y transacción atómica:
 * 1. Requiere autenticación válida y el permiso RBAC `misiones:terreno:ejecutar`.
 * 2. Valida pertenencia del usuario a la cuadrilla asignada (salvo rol Administrador)
 *    y que la misión se encuentre en estado `EN_CURSO`.
 * 3. Descuenta atómicamente los materiales consumidos del inventario (`recurso` y `cuadrilla_recurso`).
 * 4. Crea el registro en `reporte_terreno` (`tipo_reporte = 'REPORTE_CUADRILLA'`), vinculando
 *    evidencia multimedia opcional (HU-43).
 * 5. Actualiza `mision.estado = 'COMPLETADA'` con `fecha_cierre = CURRENT_TIMESTAMP`.
 * 6. Transiciona `cuadrilla.estado = 'DISPONIBLE'` y libera su dotación humana (si no tiene otra misión activa).
 * 7. Mantiene el incidente asociado abierto para evaluación final del Encargado (H86).
 * 8. Registra el hito `MISION_COMPLETADA` en `mision_hito`.
 * 9. Emite los eventos WebSocket `mision:actualizada`, `incidente:actualizado` (salas `encargado` y `mapa`),
 *    `cuadrilla:actualizada` y `recurso:actualizado`.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Validar autenticación y permiso RBAC `misiones:terreno:ejecutar`
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

    const validacionBody = CerrarMisionCuadrillaInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message:
            "Datos de entrada inválidos para el informe técnico final y cierre de misión.",
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

    // 4. Ejecutar servicio transaccional y notificaciones WebSocket
    const resultado = await cerrarMisionCuadrillaService(
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
              campo: "cierre",
              mensaje: error.message,
            },
          ],
        },
        { status: 400 }
      );
    }

    console.error("Error en POST /api/misiones/[id]/cerrar:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar el informe técnico final de cuadrilla.",
      },
      { status: 500 }
    );
  }
}
