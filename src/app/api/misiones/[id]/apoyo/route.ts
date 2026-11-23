import { NextRequest, NextResponse } from "next/server";
import {
  MisionIdParamSchema,
  SolicitarApoyoMisionInputNormalizedSchema,
} from "@/modules/misiones/mision.schema";
import { solicitarApoyoMisionService } from "@/modules/misiones/mision.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
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
 * POST /api/misiones/[id]/apoyo (HU-44)
 *
 * Permite al Delegado de Cuadrilla indicar en el reporte de terreno si se requiere
 * apoyo adicional de recursos materiales o humanos, alertando de inmediato a la
 * central logística y de operaciones sin interrumpir la faena en curso.
 *
 * Reglas de negocio y transacción atómica:
 * 1. Requiere autenticación válida y el permiso RBAC `reportes:crear`.
 * 2. Exige que la misión esté en estado `EN_CURSO` y pertenezca a la unidad asignada (salvo Administrador).
 * 3. Validación condicional: si `requiereApoyoAdicional === true`, exige `detalleApoyoRequerido` (>= 5 caracteres).
 * 4. Persiste en `reporte_terreno` (`requiere_apoyo_adicional` y `detalle_apoyo_requerido`) y registra
 *    el hito `APOYO_SOLICITADO` en `mision_hito`.
 * 5. Emite alerta prioritaria `"mision:apoyo_solicitado"` hacia la sala `encargado` y actualiza el Kanban.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Validar autenticación y permiso RBAC `reportes:crear`
    const tokenUserId = await extraerUsuarioId(request);
    const headerUserId = request.headers.get("x-user-id");
    const usuarioId = tokenUserId || headerUserId;

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

    // 3. Parsear y validar cuerpo JSON con validación condicional
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
      SolicitarApoyoMisionInputNormalizedSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message:
            "Datos de entrada inválidos para la solicitud de apoyo adicional en terreno.",
          errors: validacionBody.error.issues.map((issue) => ({
            campo: issue.path.join(".") || "requiereApoyoAdicional",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const esAdmin =
      usuarioAutenticado.rol === "Administrador" ||
      usuarioAutenticado.rol === "ADMIN";

    // 4. Ejecutar servicio transaccional y emisión de alerta en tiempo real
    const resultado = await solicitarApoyoMisionService(
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

    console.error("Error en POST /api/misiones/[id]/apoyo:", error);
    return NextResponse.json(
      {
        message:
          "Error interno del servidor al procesar la solicitud de apoyo adicional en terreno.",
      },
      { status: 500 }
    );
  }
}
