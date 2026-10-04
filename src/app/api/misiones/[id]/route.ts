import { NextRequest, NextResponse } from "next/server";
import { obtenerDetalleMisionService } from "@/modules/misiones/mision.service";
import { MisionIdParamSchema } from "@/modules/misiones/mision.schema";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { PERMISO_LEER_MISION } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/misiones/[id]
 * Consulta el detalle estructurado de una misión específica mediante su ID.
 * Requiere que el usuario posea el permiso 'misiones:leer' (Encargado, Administrador o Supervisor).
 */
export async function GET(req: NextRequest, props: RouteContext) {
  try {
    // 1. Extraer cabecera y validar autorización RBAC
    const usuarioId = req.headers.get("x-user-id");
    await verificarPermiso(usuarioId, PERMISO_LEER_MISION);

    // 2. Extraer y validar parámetro de ruta UUID
    const { id } = await props.params;
    const resultadoValidacion = MisionIdParamSchema.safeParse(id);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "El identificador de la misión proporcionado no es un UUID válido.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: "id",
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 3. Consultar servicio de detalle de misión
    const detalle = await obtenerDetalleMisionService(resultadoValidacion.data);
    if (!detalle) {
      return NextResponse.json(
        { message: "No se encontró ninguna misión con el identificador proporcionado." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "Detalle de misión obtenido exitosamente.",
        data: detalle,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    console.error("Error al obtener detalle de misión:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar el detalle de la misión." },
      { status: 500 }
    );
  }
}
