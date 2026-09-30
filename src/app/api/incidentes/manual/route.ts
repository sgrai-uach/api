import { NextRequest, NextResponse } from "next/server";
import { CrearIncidenteManualInputSchema } from "@/modules/incidentes/aviso-incidente.schema";
import {
  crearIncidenteManual,
  ConflictoDuplicadoError,
} from "@/modules/incidentes/aviso-incidente.service";
import { verificarPermiso } from "@/modules/seguridad/auth.service";
import { extraerUsuarioId } from "@/modules/seguridad/auth.guard";
import { PERMISO_CREAR_INCIDENTE_MANUAL } from "@/modules/seguridad/permisos.constants";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación y permisos de rol (Call Center o Administrador)
    const usuarioId = await extraerUsuarioId(req);
    let usuarioAutenticado;
    try {
      usuarioAutenticado = await verificarPermiso(usuarioId, PERMISO_CREAR_INCIDENTE_MANUAL);
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
    const resultadoValidacion = CrearIncidenteManualInputSchema.safeParse(body);
    if (!resultadoValidacion.success) {
      return NextResponse.json(
        {
          message: "Datos de entrada inválidos para el ingreso manual del incidente.",
          errors: resultadoValidacion.error.issues.map((issue) => ({
            campo: issue.path.join("."),
            mensaje: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    // 4. Ejecutar servicio de negocio
    const respuesta = await crearIncidenteManual(
      resultadoValidacion.data,
      usuarioAutenticado.id
    );

    return NextResponse.json(
      {
        message: respuesta.mensaje,
        data: respuesta,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ConflictoDuplicadoError) {
      return NextResponse.json(
        {
          message: error.message,
          duplicados: error.coincidencias,
          requiereConfirmacion: true,
        },
        { status: 409 }
      );
    }

    console.error("Error al ingresar manualmente el incidente:", error);
    return NextResponse.json(
      { message: "Error interno del servidor al procesar el ingreso manual del incidente." },
      { status: 500 }
    );
  }
}
