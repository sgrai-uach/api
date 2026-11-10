import { NextRequest, NextResponse } from "next/server";
import { verificarTerrenoMisiones } from "@/modules/seguridad/auth.guard";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/modules/seguridad/errors";
import { listarMisionesPendientesTerrenoService } from "@/modules/misiones/notificacion-mision.service";

/**
 * GET /api/terreno/misiones/pendientes
 *
 * Consulta las órdenes de misión despachadas cuyas notificaciones se encuentran
 * en estado 'PENDIENTE_ENVIO' o 'ENVIADA' (sin confirmación de recepción).
 *
 * Utilizado por el cliente de terreno (sgrai-pwa) para reconciliar su estado
 * tras experimentar pérdidas de conectividad o modo avión (Arquitectura Offline-First).
 *
 * Requiere:
 * - Autenticación JWT válida (Bearer token).
 * - Permiso RBAC 'misiones:terreno:verificar'.
 * - Pertenencia a la patrulla verificadora correspondiente (salvo Administrador).
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Validar autenticación y permiso RBAC 'misiones:terreno:verificar'
    const usuarioAutenticado = await verificarTerrenoMisiones(request);

    const esAdmin =
      usuarioAutenticado.rolNombre === "Administrador" ||
      usuarioAutenticado.rolCodigo === "ADMIN";

    // 2. Parámetro opcional para filtrado administrativo
    const searchParams = request.nextUrl.searchParams;
    const patrullaIdQuery = searchParams.get("patrullaId");

    // 3. Ejecutar servicio
    const resultado = await listarMisionesPendientesTerrenoService(
      usuarioAutenticado.id,
      esAdmin,
      patrullaIdQuery
    );

    return NextResponse.json(resultado, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error en GET /api/terreno/misiones/pendientes:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al consultar misiones pendientes." },
      { status: 500 }
    );
  }
}

