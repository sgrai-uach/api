import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
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
import { EstadoOperativoInvalidoError } from "@/modules/recursos-y-personal/estado-operativo";
import { extraerUsuarioId, verificarAdministrador, verificarAccesoPersonal } from "@/modules/seguridad/auth.guard";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/personal/[id]
 *
 * Consulta los datos detallados de un empleado por ID (usuario_id o personal_id).
 * Requiere sesión autenticada con permiso 'personal:leer', 'personal:gestionar' o
 * 'personal:crear' (o rol Administrador).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await verificarAccesoPersonal(request);

    const { id } = await params;

    const idValido = z.string().uuid().safeParse(id);
    if (!idValido.success) {
      return NextResponse.json(
        {
          error: "El identificador del empleado debe ser un UUID válido",
          message: "El identificador del empleado debe ser un UUID válido",
        },
        { status: 400 }
      );
    }

    const empleado = await db
      .selectFrom("usuario")
      .leftJoin("rol", "rol.id", "usuario.rol_id")
      .leftJoin("delegacion", "delegacion.id", "usuario.delegacion_id")
      .leftJoin("personal", "personal.usuario_id", "usuario.id")
      .select([
        "usuario.id as usuario_id",
        "usuario.rut",
        "usuario.nombres",
        "usuario.apellidos",
        "usuario.email",
        "usuario.telefono",
        "usuario.activo as usuario_activo",
        "usuario.estado_operativo",
        "usuario.fecha_ingreso",
        "usuario.fecha_salida",
        "rol.id as rol_id",
        "rol.codigo as rol_codigo",
        "rol.nombre as rol_nombre",
        "delegacion.id as delegacion_id",
        "delegacion.codigo as delegacion_codigo",
        "delegacion.nombre as delegacion_nombre",
        "personal.id as personal_id",
        "personal.especialidad",
        "personal.cargo",
        "personal.disponible_terreno",
        "personal.observaciones",
        "personal.updated_at as personal_updated_at",
      ])
      .where((eb) => eb.or([eb("usuario.id", "=", id), eb("personal.id", "=", id)]))
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
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message, message: error.message }, { status: 401 });
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message, message: error.message }, { status: 403 });
    }

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

    const idValido = z.string().uuid().safeParse(id);
    if (!idValido.success) {
      return NextResponse.json(
        {
          error: "El identificador del empleado debe ser un UUID válido",
          message: "El identificador del empleado debe ser un UUID válido",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const datosValidados = ModificarEmpleadoSchema.parse(body);
    const modificadoPorId = await extraerUsuarioId(request);

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

    if (error instanceof EstadoOperativoInvalidoError) {
      return NextResponse.json(
        { error: error.message, message: error.message },
        { status: 422 }
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

    const idValido = z.string().uuid().safeParse(id);
    if (!idValido.success) {
      return NextResponse.json(
        {
          error: "El identificador del empleado debe ser un UUID válido",
          message: "El identificador del empleado debe ser un UUID válido",
        },
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

