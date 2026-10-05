import { NextRequest, NextResponse } from "next/server";
import { IncidentesKpisQuerySchema } from "@/modules/incidentes/incidente-kpi.schema";
import { obtenerIncidentesKpisService } from "@/modules/incidentes/incidente-kpi.service";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { PERMISO_KANBAN_INCIDENTES } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

export async function GET(req: NextRequest) {
  try {
    // 1. Validar autenticación y permisos RBAC
    const usuarioId = await extraerUsuarioId(req);
    await verificarPermiso(usuarioId, PERMISO_KANBAN_INCIDENTES);

    // 2. Extraer parámetros de consulta
    const { searchParams } = new URL(req.url);
    const queryRaw: Record<string, string | undefined> = {};

    if (searchParams.has("fecha")) {
      queryRaw.fecha = searchParams.get("fecha") ?? undefined;
    }
    if (searchParams.has("delegacionId")) {
      queryRaw.delegacionId = searchParams.get("delegacionId") ?? undefined;
    }

    // 3. Validar con Zod
    const resultadoValidacion = IncidentesKpisQuerySchema.safeParse(queryRaw);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros de consulta inválidos.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 4. Invocar servicio
    const respuesta = await obtenerIncidentesKpisService(resultadoValidacion.data);

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error al obtener KPIs de incidentes del día:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar los KPIs de incidentes." },
      { status: 500 }
    );
  }
}
