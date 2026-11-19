import { NextRequest, NextResponse } from "next/server";
import {
  MisionIdParamSchema,
  RechazarMisionInputSchema,
} from "@/modules/misiones/mision.schema";
import { rechazarMisionService } from "@/modules/misiones/mision.service";
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
 * POST /api/misiones/[id]/rechazar (HU-41)
 *
 * Permite al Delegado de cuadrilla rechazar la solicitud de asignación a una misión
 * ingresando una justificación técnica obligatoria (mínimo 5 caracteres según Regla §3.3).
 *
 * Ejecuta una transacción atómica:
 * 1. Actualiza `mision.estado = 'RECHAZADA'`, registra `justificacion_rechazo` y `fecha_cierre`.
 * 2. Devuelve la cuadrilla a estado `DISPONIBLE` y libera su dotación humana.
 * 3. Retorna el incidente asociado a `VERIFICANDO` (si tuvo verificación previa) o `REPORTADO`.
 * 4. Inserta el hito `'RECHAZADA'` con la justificación en `mision_hito`.
 * 5. Emite la alerta prioritaria WebSocket `mision:rechazada` hacia la sala `encargado`.
 *
 * Requiere el permiso RBAC `misiones:terreno:ejecutar` y pertenencia a la cuadrilla asignada (o rol Administrador).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario autenticado y verificar permiso RBAC
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

    // 3. Parsear cuerpo JSON
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

    // 4. Validar cuerpo con Zod (Regla §3.3: mínimo 5 caracteres en justificacion_rechazo)
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

    // 5. Ejecutar transacción atómica y notificaciones WebSocket
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
