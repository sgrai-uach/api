import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ModificarEmpleadoSchema } from "@/modules/recursos-y-personal/schemas/modificar-empleado.schema";
import {
  actualizarEmpleado,
  EmpleadoNotFoundError,
  EmailDuplicadoError,
  RutDuplicadoError,
  RolNotFoundError,
  DelegacionNotFoundError,
} from "@/modules/recursos-y-personal/services/actualizar-empleado.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/personal/[id]
 *
 * Modifica los datos de un empleado en el sistema SGRAI,
 * actualizando tanto la tabla general 'usuarios' como la tabla
 * especializada 'personal' (si corresponde).
 *
 * El parámetro [id] puede ser el UUID de 'personal' o el UUID de 'usuarios'.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "El identificador del empleado es requerido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const datosValidados = ModificarEmpleadoSchema.parse(body);
    const modificadoPorId = request.headers.get("x-user-id");

    const empleado = await actualizarEmpleado(id, datosValidados, modificadoPorId);

    return NextResponse.json({
      mensaje: "Datos del empleado actualizados exitosamente",
      data: empleado,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Datos de entrada inválidos",
          detalles: error.issues.map((i) => ({
            campo: i.path.join("."),
            mensaje: i.message,
          })),
        },
        { status: 422 }
      );
    }

    if (error instanceof EmpleadoNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof EmailDuplicadoError || error instanceof RutDuplicadoError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof RolNotFoundError || error instanceof DelegacionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Error no controlado al actualizar empleado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar la solicitud" },
      { status: 500 }
    );
  }
}
