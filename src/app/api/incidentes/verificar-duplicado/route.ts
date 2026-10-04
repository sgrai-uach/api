import { NextRequest, NextResponse } from "next/server";
import { VerificarDuplicadoInputSchema } from "@/modules/incidentes/aviso-incidente.schema";
import { verificarDuplicadosManual } from "@/modules/incidentes/aviso-incidente.service";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { PERMISO_CREAR_INCIDENTE_MANUAL } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación y permiso de Call Center
    const usuarioId = await extraerUsuarioId(req);
    try {
      await verificarPermiso(usuarioId, PERMISO_CREAR_INCIDENTE_MANUAL);
    } catch (authError) {
      if (authError instanceof UnauthorizedError) {
        return NextResponse.json({ message: authError.message }, { status: 401 });
      }
      if (authError instanceof ForbiddenError) {
        return NextResponse.json({ message: authError.message }, { status: 403 });
      }
      throw authError;
    }

    // 2. Parsear el cuerpo de la solicitud JSON
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: "El cuerpo de la solicitud debe ser un JSON válido." },
        { status: 400 }
      );
    }

    // 3. Validar esquema Zod
    const resultadoValidacion = VerificarDuplicadoInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Parámetros inválidos para la verificación de duplicados.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 4. Consultar servicio de verificación espacial
    const resultado = await verificarDuplicadosManual(resultadoValidacion.data);

    return NextResponse.json(
      {
        message: resultado.hayDuplicados
          ? `Se encontraron ${resultado.coincidencias.length} posible(s) reporte(s) o incidente(s) cercano(s).`
          : "No se registran incidentes duplicados cercanos en la ventana reciente.",
        data: resultado,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al verificar duplicados de incidente:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al consultar duplicados." },
      { status: 500 }
    );
  }
}
