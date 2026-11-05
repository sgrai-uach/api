import { NextRequest, NextResponse } from "next/server";
import { MisionIdParamSchema, AceptarMisionInputSchema } from "@/modules/misiones/mision.schema";
import { aceptarMisionService } from "@/modules/misiones/mision.service";
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
 * POST /api/misiones/[id]/aceptar (HU-36)
 *
 * Permite a la patrulla verificadora confirmar y aceptar la misión asignada desde el dispositivo móvil (PWA).
 * Ejecuta una transición atómica:
 * 1. Actualiza `mision.estado` de `DESPACHADA` a `EN_CURSO`.
 * 2. Fija `mision.fecha_inicio = CURRENT_TIMESTAMP`.
 * 3. Registra el hito `'MISION_ACEPTADA'` (`'Misión Aceptada por Patrulla'`) en `mision_hito`.
 * 4. Mantiene la patrulla en `EN_VERIFICACION` y el incidente en `VERIFICANDO`.
 * 5. Emite el evento WebSocket `mision:actualizada` hacia la sala `encargado`.
 *
 * Requiere el permiso RBAC `misiones:terreno:verificar`.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario en sesión (Bearer token o cabecera x-user-id para compatibilidad interna)
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

    // 3. Parsear cuerpo opcional (ej. coordenadas GPS al momento de aceptar en la PWA)
    let bodyRaw: unknown = undefined;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const text = await request.text();
      if (text.trim().length > 0) {
        try {
          bodyRaw = JSON.parse(text);
        } catch {
          return NextResponse.json(
            { message: "El cuerpo de la petición no es un JSON válido." },
            { status: 400 }
          );
        }
      }
    }

    const validacionBody = AceptarMisionInputSchema.safeParse(bodyRaw);
    if (!validacionBody.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos.",
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

    // 4. Ejecutar transición atómica y notificación en tiempo real
    const resultado = await aceptarMisionService(
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

    console.error("Error en POST /api/misiones/[id]/aceptar:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar la aceptación de la misión." },
      { status: 500 }
    );
  }
}

