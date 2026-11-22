import { NextRequest, NextResponse } from "next/server";
import { MisionIdParamSchema, AceptarMisionInputSchema } from "@/modules/misiones/mision.schema";
import { aceptarMisionService } from "@/modules/misiones/mision.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { verificarPermiso, type UsuarioAutenticado } from "@/modules/seguridad/auth.service";
import {
  PERMISO_EJECUTAR_MISION_TERRENO,
  PERMISO_VERIFICAR_MISION_TERRENO,
} from "@/modules/seguridad/permisos.constants";
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
 * POST /api/misiones/[id]/aceptar (HU-36 / HU-40)
 *
 * Permite al Delegado de cuadrilla (HU-40) o a la patrulla verificadora (HU-36)
 * confirmar y aceptar la misión asignada desde el dispositivo móvil (PWA).
 *
 * Para Cuadrilla (`ATENCION_CUADRILLA` — permiso `misiones:terreno:ejecutar`):
 * 1. Actualiza `mision.estado` de `DESPACHADA` a `EN_CURSO` fijando `fecha_inicio = CURRENT_TIMESTAMP`.
 * 2. Actualiza `cuadrilla.estado = 'EN_MISION'` y sincroniza dotación humana.
 * 3. Actualiza `incidente.estado = 'EN_ATENCION'`.
 * 4. Registra el hito `'MISION_ACEPTADA'` (`'Asignación Aceptada por Cuadrilla'`) en `mision_hito`.
 * 5. Emite los eventos WebSocket `incidente:actualizado` y `mision:actualizada` al Centro de Mando.
 *
 * Para Patrulla Verificadora (`VERIFICACION` — permiso `misiones:terreno:verificar`):
 * Mantiene `patrulla.estado = 'EN_VERIFICACION'`, `incidente.estado = 'VERIFICANDO'` y registra
 * el hito `'Misión Aceptada por Patrulla'`.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // 1. Extraer usuario en sesión y verificar permiso RBAC (misiones:terreno:ejecutar o misiones:terreno:verificar)
    const tokenUserId = await extraerUsuarioId(request);
    const headerUserId = request.headers.get("x-user-id");
    const usuarioId = tokenUserId || headerUserId;

    let usuarioAutenticado: UsuarioAutenticado;
    let soloVerificacionPatrulla = false;

    try {
      usuarioAutenticado = await verificarPermiso(
        usuarioId,
        PERMISO_EJECUTAR_MISION_TERRENO
      );
    } catch (errorPermiso: unknown) {
      if (errorPermiso instanceof ForbiddenError) {
        let fallbackPatrulla: UsuarioAutenticado | undefined;
        try {
          fallbackPatrulla = await verificarPermiso(
            usuarioId,
            PERMISO_VERIFICAR_MISION_TERRENO
          );
        } catch (errorFallback: unknown) {
          if (
            errorFallback instanceof UnauthorizedError ||
            errorFallback instanceof ForbiddenError
          ) {
            throw errorFallback;
          }
          throw errorPermiso;
        }

        if (!fallbackPatrulla) {
          throw errorPermiso;
        }

        usuarioAutenticado = fallbackPatrulla;
        soloVerificacionPatrulla = true;
      } else {
        throw errorPermiso;
      }
    }

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
    const resultado = soloVerificacionPatrulla
      ? await aceptarMisionService(
          validacionId.data,
          usuarioAutenticado.id,
          esAdmin,
          validacionBody.data,
          { puedeEjecutarCuadrilla: false, puedeVerificarPatrulla: true }
        )
      : await aceptarMisionService(
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

