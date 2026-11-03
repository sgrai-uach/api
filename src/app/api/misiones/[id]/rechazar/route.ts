import { NextRequest, NextResponse } from "next/server";
import {
  MisionIdParamSchema,
  RechazarMisionInputSchema,
} from "@/modules/misiones/mision.schema";
import { rechazarMisionService } from "@/modules/misiones/mision.service";
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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/misiones/[id]/rechazar (HU-69)
 *
 * Permite a una patrulla verificadora en terreno rechazar una misión de verificación asignada
 * ingresando una justificación obligatoria (mínimo 5 caracteres según Regla Crítica §3.3).
 *
 * Ejecuta una transacción atómica:
 * 1. Actualiza `mision.estado = 'RECHAZADA'`, registra `justificacion_rechazo` y `fecha_cierre`.
 * 2. Transiciona `patrulla.estado = 'DISPONIBLE'` para liberarla en el sistema.
 * 3. Revierte `incidente.estado = 'REPORTADO'` para permitir su reasignación inmediata en el Centro de Mando.
 * 4. Inserta el hito cronológico `'RECHAZADA'` en `mision_hito`.
 * 5. Emite la notificación WebSocket `mision:rechazada` hacia la sala `encargado`.
 *
 * Requiere autenticación de patrulla verificadora (permiso `misiones:terreno:verificar` y pertenencia a la patrulla asignada, o rol Administrador).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado
    const tokenUserId = await extraerUsuarioId(request);
    const headerUserId = request.headers.get("x-user-id");
    const usuarioId = tokenUserId || headerUserId;

    const usuarioAutenticado = await verificarPermiso(
      usuarioId,
      PERMISO_VERIFICAR_MISION_TERRENO
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

    // 3. Parsear cuerpo de la petición (JSON)
    let bodyRaw: unknown = undefined;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const text = await request.text();
      if (text.trim().length > 0) {
        try {
          bodyRaw = JSON.parse(text);
        } catch {
          return NextResponse.json(
            { message: "El cuerpo de la solicitud debe ser un formato JSON válido." },
            { status: 400 }
          );
        }
      }
    } else {
      try {
        bodyRaw = await request.json();
      } catch {
        return NextResponse.json(
          { message: "El cuerpo de la solicitud debe ser un formato JSON válido." },
          { status: 400 }
        );
      }
    }

    // 4. Validar cuerpo con Zod (mínimo 5 caracteres en justificacion_rechazo)
    const validacionBody = RechazarMisionInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para el rechazo de la misión.",
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

    // 5. Ejecutar transacción y notificaciones en servicio
    const resultado = await rechazarMisionService(
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

    console.error("Error en POST /api/misiones/[id]/rechazar:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar el rechazo de la misión." },
      { status: 500 }
    );
  }
}

