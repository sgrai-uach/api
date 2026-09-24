import { db } from "@/lib/db";
import type { ModificarEmpleadoDTO } from "../schemas/modificar-empleado.schema";

export class EmpleadoNotFoundError extends Error {
  constructor(message = "Empleado no encontrado") {
    super(message);
    this.name = "EmpleadoNotFoundError";
  }
}

export class EmailDuplicadoError extends Error {
  constructor(message = "El correo electrónico ya se encuentra registrado por otro usuario") {
    super(message);
    this.name = "EmailDuplicadoError";
  }
}

export class DelegacionNotFoundError extends Error {
  constructor(message = "La delegación especificada no existe") {
    super(message);
    this.name = "DelegacionNotFoundError";
  }
}

export class RolNotFoundError extends Error {
  constructor(message = "El rol especificado no existe") {
    super(message);
    this.name = "RolNotFoundError";
  }
}

/**
 * Servicio para actualizar la información de un empleado (tanto en la tabla 'usuarios' como en 'personal').
 *
 * El parámetro `id` puede ser:
 * 1. El ID del registro en 'personal'
 * 2. El ID del registro en 'usuarios'
 */
export async function actualizarEmpleado(
  id: string,
  dto: ModificarEmpleadoDTO,
  modificadoPorId?: string | null
) {
  return await db.transaction().execute(async (trx) => {
    // 1. Identificar si 'id' corresponde a un 'personal.id' o 'usuarios.id'
    let usuarioId = id;
    let personalRecord = await trx
      .selectFrom("personal")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (personalRecord) {
      usuarioId = personalRecord.usuario_id;
    } else {
      // Verificar si id corresponde directamente a usuarios.id
      const userExists = await trx
        .selectFrom("usuarios")
        .select(["id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!userExists) {
        throw new EmpleadoNotFoundError();
      }

      // Buscar si este usuario tiene ficha en personal
      personalRecord = await trx
        .selectFrom("personal")
        .selectAll()
        .where("usuario_id", "=", id)
        .executeTakeFirst();
    }

    // 2. Validar que el rol exista si se intenta actualizar y obtener su código
    let rolCodigoDestino: string | undefined;
    if (dto.rol_id) {
      const rol = await trx
        .selectFrom("roles")
        .select(["id", "codigo"])
        .where("id", "=", dto.rol_id)
        .executeTakeFirst();
      if (!rol) {
        throw new RolNotFoundError();
      }
      rolCodigoDestino = rol.codigo;
    } else {
      const userActual = await trx
        .selectFrom("usuarios")
        .innerJoin("roles", "roles.id", "usuarios.rol_id")
        .select(["roles.codigo as rol_codigo"])
        .where("usuarios.id", "=", usuarioId)
        .executeTakeFirst();
      rolCodigoDestino = userActual?.rol_codigo;
    }

    const esRolTerrenoDestino = ["PATRULLA_VERIFICADORA", "DELEGADO_CUADRILLA", "BRIGADISTA"].includes(
      rolCodigoDestino || ""
    );

    // 3. Validar que la delegación exista si se especifica
    if (dto.delegacion_id) {
      const delegacion = await trx
        .selectFrom("delegaciones")
        .select(["id"])
        .where("id", "=", dto.delegacion_id)
        .executeTakeFirst();
      if (!delegacion) {
        throw new DelegacionNotFoundError();
      }
    }

    // 4. Validar unicidad de email si se intenta cambiar
    if (dto.email) {
      const emailExistente = await trx
        .selectFrom("usuarios")
        .select(["id"])
        .where("email", "=", dto.email)
        .where("id", "!=", usuarioId)
        .executeTakeFirst();

      if (emailExistente) {
        throw new EmailDuplicadoError();
      }
    }

    // 5. Preparar datos para actualizar tabla 'usuarios'
    const datosUsuario: Record<string, unknown> = {};
    if (dto.nombres !== undefined) datosUsuario.nombres = dto.nombres;
    if (dto.apellidos !== undefined) datosUsuario.apellidos = dto.apellidos;
    if (dto.email !== undefined) datosUsuario.email = dto.email;
    if (dto.telefono !== undefined) datosUsuario.telefono = dto.telefono;
    if (dto.rol_id !== undefined) datosUsuario.rol_id = dto.rol_id;
    if (dto.delegacion_id !== undefined) datosUsuario.delegacion_id = dto.delegacion_id;
    if (dto.activo !== undefined) {
      datosUsuario.activo = dto.activo;
      // Si se desactiva la cuenta y no se envió explícitamente fecha_salida, registrar la fecha actual si no tenía una
      if (dto.activo === false && dto.fecha_salida === undefined) {
        const usuarioActual = await trx
          .selectFrom("usuarios")
          .select(["fecha_salida"])
          .where("id", "=", usuarioId)
          .executeTakeFirst();
        if (!usuarioActual?.fecha_salida) {
          datosUsuario.fecha_salida = new Date().toISOString().slice(0, 10);
        }
      }
    }
    if (dto.fecha_ingreso !== undefined) datosUsuario.fecha_ingreso = dto.fecha_ingreso;
    if (dto.fecha_salida !== undefined) datosUsuario.fecha_salida = dto.fecha_salida;

    if (Object.keys(datosUsuario).length > 0) {
      await trx
        .updateTable("usuarios")
        .set(datosUsuario)
        .where("id", "=", usuarioId)
        .execute();
    }

    // 6. Preparar datos para actualizar tabla 'personal' (si existe ficha operativa o se promueve a terreno)
    const datosPersonal: Record<string, unknown> = {};
    if (dto.especialidad !== undefined) datosPersonal.especialidad = dto.especialidad;
    if (dto.cargo !== undefined) datosPersonal.cargo = dto.cargo;
    if (dto.estado_operativo !== undefined) datosPersonal.estado_operativo = dto.estado_operativo;
    if (dto.disponible_terreno !== undefined) datosPersonal.disponible_terreno = dto.disponible_terreno;
    if (dto.observaciones !== undefined) datosPersonal.observaciones = dto.observaciones;

    // Si también se modificó la delegación y existe personal, sincronizar delegacion_id en personal
    if (dto.delegacion_id !== undefined && dto.delegacion_id !== null) {
      datosPersonal.delegacion_id = dto.delegacion_id;
    }

    if (!esRolTerrenoDestino) {
      // Si el rol nuevo NO es de terreno (ej. Call Center, Encargado, Supervisor, Admin),
      // se eliminan sus atributos de personal de terreno si los tenía
      if (personalRecord) {
        await trx
          .deleteFrom("personal")
          .where("id", "=", personalRecord.id)
          .execute();
      }
    } else {
      // Si el rol nuevo SÍ es de terreno (Patrulla Verificadora, Delegado Cuadrilla, Brigadista)
      if (personalRecord) {
        if (Object.keys(datosPersonal).length > 0) {
          await trx
            .updateTable("personal")
            .set(datosPersonal)
            .where("id", "=", personalRecord.id)
            .execute();
        }
      } else {
        // No tenía ficha previa en 'personal', crearla ahora
        const userFinal = await trx
          .selectFrom("usuarios")
          .select(["delegacion_id"])
          .where("id", "=", usuarioId)
          .executeTakeFirst();

        const delegacionFicha = (datosPersonal.delegacion_id as string) || userFinal?.delegacion_id;
        if (delegacionFicha) {
          await trx
            .insertInto("personal")
            .values({
              usuario_id: usuarioId,
              delegacion_id: delegacionFicha,
              especialidad: (datosPersonal.especialidad as string) || null,
              cargo: (datosPersonal.cargo as string) || null,
              estado_operativo: (datosPersonal.estado_operativo as any) || "disponible",
              disponible_terreno: datosPersonal.disponible_terreno !== undefined ? (datosPersonal.disponible_terreno as boolean) : true,
              observaciones: (datosPersonal.observaciones as string) || null,
            })
            .execute();
        }
      }
    }

    // 7. Registrar trazabilidad en log de cambios de usuarios
    const cambios = { ...datosUsuario, ...datosPersonal };
    if (Object.keys(cambios).length > 0) {
      await trx
        .insertInto("log_cambios_usuarios")
        .values({
          usuario_modificado_id: usuarioId,
          modificado_por_id: modificadoPorId || null,
          campos_modificados: JSON.stringify(cambios),
        })
        .execute();
    }

    // 8. Retornar el registro consolidado del empleado
    const empleadoActualizado = await trx
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
        "usuarios.updated_at as usuario_updated_at",
        "personal.updated_at as personal_updated_at",
      ])
      .where("usuarios.id", "=", usuarioId)
      .executeTakeFirstOrThrow();

    return empleadoActualizado;
  });
}
