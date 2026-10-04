import { NextRequest, NextResponse } from "next/server";
import { ListarIncidentesQuerySchema } from "@/modules/incidentes/incidente-kanban.schema";
import { listarIncidentesKanbanService } from "@/modules/incidentes/incidente-kanban.service";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { PERMISO_KANBAN_INCIDENTES } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

export async function GET(req: NextRequest) {
  try {
    // 1. Extraer cabecera de autenticación y verificar permiso RBAC
    const usuarioId = await extraerUsuarioId(req);
    await verificarPermiso(usuarioId, PERMISO_KANBAN_INCIDENTES);

    // 2. Extraer parámetros de búsqueda de la URL
    const { searchParams } = new URL(req.url);
    const queryRaw: Record<string, string | undefined> = {};

    if (searchParams.has("page")) queryRaw.page = searchParams.get("page") ?? undefined;
    if (searchParams.has("limit")) queryRaw.limit = searchParams.get("limit") ?? undefined;
    if (searchParams.has("estado")) queryRaw.estado = searchParams.get("estado") ?? undefined;
    if (searchParams.has("prioridad")) queryRaw.prioridad = searchParams.get("prioridad") ?? undefined;
    if (searchParams.has("tipoAfectacion")) queryRaw.tipoAfectacion = searchParams.get("tipoAfectacion") ?? undefined;
    if (searchParams.has("busqueda")) queryRaw.busqueda = searchParams.get("busqueda") ?? undefined;
    if (searchParams.has("fecha")) queryRaw.fecha = searchParams.get("fecha") ?? undefined;
    if (searchParams.has("soloHoy")) queryRaw.soloHoy = searchParams.get("soloHoy") ?? undefined;
    if (searchParams.has("delegacionId")) queryRaw.delegacionId = searchParams.get("delegacionId") ?? undefined;

    // 3. Validar con Zod
    const resultadoValidacion = ListarIncidentesQuerySchema.safeParse(queryRaw);
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

    // 4. Invocar servicio de negocio
    const respuesta = await listarIncidentesKanbanService(resultadoValidacion.data);

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error al listar incidentes para tablero kanban:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar el listado de incidentes." },
      { status: 500 }
    );
  }
}
