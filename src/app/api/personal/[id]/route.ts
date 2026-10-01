import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { ModificarEmpleadoSchema } from "@/modules/recursos-y-personal/schemas/modificar-empleado.schema";
import {
  actualizarEmpleado,
  EmpleadoNotFoundError,
  EmailDuplicadoError,
  RutDuplicadoError,
  RolNotFoundError,
  DelegacionNotFoundError,
} from "@/modules/recursos-y-personal/services/actualizar-empleado.service";
import {
  eliminarEmpleadoLogico,
  EmpleadoEnMisionActivaError,
} from "@/modules/recursos-y-personal/services/eliminar-empleado.service";
import { verificarAdministrador } from "@/modules/seguridad/auth.guard";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/personal/[id]
 *
 * Consulta los datos detallados de un empleado por ID (usuario_id o personal_id).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "El identificador del empleado es requerido", message: "El identificador del empleado es requerido" },
        { status: 400 }
      );
    }

    const empleado = await db
      .selectFrom("usuarios")
      .leftJoin("roles", "roles.id", "usuarios.rol_id")
      .leftJoin("delegaciones", "delegaciones.id", "usuarios.delegacion_id")
      .leftJoin("personal", "personal.usuario_id", "usuarios.id")
      .select([
        "usuarios.id as usuario_id",
        "usuarios.rut",
        "usuarios.nombres",
        "usuarios.apellidos",
        "usuarios.email",
        "usuarios.telefono",
        "usuarios.activo as usuario_activo",
        "usuarios.fecha_ingreso",
        "usuarios.fecha_salida",
        "roles.id as rol_id",
        "roles.codigo as rol_codigo",
        "roles.nombre as rol_nombre",
        "delegaciones.id as delegacion_id",
        "delegaciones.codigo as delegacion_codigo",
        "delegaciones.nombre as delegacion_nombre",
        "personal.id as personal_id",
        "personal.especialidad",
        "personal.cargo",
        "personal.estado_operativo",
        "personal.disponible_terreno",
        "personal.observaciones",
        "personal.updated_at as personal_updated_at",
      ])
      .where((eb) => eb.or([eb("usuarios.id", "=", id), eb("personal.id", "=", id)]))
      .executeTakeFirst();

    if (!empleado) {
      return NextResponse.json(
        { error: "Empleado no encontrado", message: "Empleado no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        ...empleado,
        es_personal: empleado.personal_id !== null,
      },
    });
  } catch (error) {
    console.error("Error al obtener empleado:", error);
    return NextResponse.json(
      { error: "Error interno al consultar el empleado", message: "Error interno al consultar el empleado" },
      { status: 500 }
    );
  }
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
        { error: "El identificador del empleado es requerido", message: "El identificador del empleado es requerido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const datosValidados = ModificarEmpleadoSchema.parse(body);
    const modificadoPorId = request.headers.get("x-user-id");

    const empleado = await actualizarEmpleado(id, datosValidados, modificadoPorId);

    return NextResponse.json({
      message: "Datos del empleado actualizados exitosamente",
      mensaje: "Datos del empleado actualizados exitosamente",
      data: empleado,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const detalles = error.issues.map((i) => ({
        campo: i.path.join("."),
        mensaje: i.message,
      }));
      return NextResponse.json(
        {
          error: "Datos de entrada inválidos",
          message: "Datos de entrada inválidos",
          detalles,
          errors: detalles,
        },
        { status: 422 }
      );
    }

    if (error instanceof EmpleadoNotFoundError) {
      return NextResponse.json(
        { error: error.message, message: error.message },
        { status: 404 }
      );
    }

    if (error instanceof EmailDuplicadoError || error instanceof RutDuplicadoError) {
      return NextResponse.json(
        { error: error.message, message: error.message },
        { status: 409 }
      );
    }

    if (error instanceof RolNotFoundError || error instanceof DelegacionNotFoundError) {
      return NextResponse.json(
        { error: error.message, message: error.message },
        { status: 400 }
      );
    }

    console.error("Error no controlado al actualizar empleado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar la solicitud", message: "Error interno del servidor al procesar la solicitud" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/personal/[id]
 *
 * Ejecuta la baja lógica (soft-delete) de un empleado o funcionario en SGRAI.
 * Desactiva al usuario, registra la fecha de salida y pasa el personal operativo a inactivo.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const usuarioAutenticado = await verificarAdministrador(request);

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "El identificador del empleado es requerido", message: "El identificador del empleado es requerido" },
        { status: 400 }
      );
    }

    const resultado = await eliminarEmpleadoLogico(id, usuarioAutenticado.id);

    return NextResponse.json({
      message: "Empleado dado de baja exitosamente",
      mensaje: "Empleado dado de baja exitosamente",
      data: resultado,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: error.message, message: error.message },
        { status: 401 }
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: error.message, message: error.message },
        { status: 403 }
      );
    }

    if (error instanceof EmpleadoNotFoundError) {
      return NextResponse.json(
        { error: error.message, message: error.message },
        { status: 404 }
      );
    }

    if (error instanceof EmpleadoEnMisionActivaError) {
      return NextResponse.json(
        { error: error.message, message: error.message },
        { status: 409 }
      );
    }

    console.error("Error no controlado al dar de baja empleado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al dar de baja al empleado", message: "Error interno del servidor al dar de baja al empleado" },
      { status: 500 }
    );
  }
}

