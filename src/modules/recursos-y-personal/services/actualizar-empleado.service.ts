import { z } from "zod";
import { db } from "@/lib/db";
import type { EstadoOperativo } from "@/lib/db/types";
import type { ModificarEmpleadoDTO } from "../schemas/modificar-empleado.schema";
import {
  esEstadoOperativoDeTerreno,
  esRolTerreno,
  resolverEstadoOperativo,
} from "../estado-operativo";

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

export class RutDuplicadoError extends Error {
  constructor(message = "El RUT ya se encuentra registrado por otro usuario") {
    super(message);
    this.name = "RutDuplicadoError";
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
 * Servicio para actualizar la información de un empleado.
 *
 * Desde H11 el estado operativo (disponibilidad actual) reside en `usuario.estado_operativo`
 * y la tabla `personal` queda como ficha opcional de terreno, cuya única capacidad
 * persistida es `disponible_terreno`.
 */
export async function actualizarEmpleado(
  id: string,
  dto: ModificarEmpleadoDTO,
  modificadoPorId?: string | null
) {
  return await db.transaction().execute(async (trx) => {
    // 1. Identificar si 'id' corresponde a un 'personal.id' o 'usuario.id'
    let usuarioId = id;
    let personalRecord = await trx
      .selectFrom("personal")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (personalRecord) {
      usuarioId = personalRecord.usuario_id;
    } else {
      // Verificar si id corresponde directamente a usuario.id
      const userExists = await trx
        .selectFrom("usuario")
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

    // 2. Estado actual del usuario (disponibilidad vigente y vigencia de la cuenta)
    const usuarioActual = await trx
      .selectFrom("usuario")
      .select(["id", "activo", "estado_operativo", "fecha_salida", "delegacion_id"])
      .where("id", "=", usuarioId)
      .executeTakeFirstOrThrow();

    const estadoOperativoActual = (usuarioActual.estado_operativo ??
      "disponible") as EstadoOperativo;

    // 3. Validar que el rol exista si se intenta actualizar y obtener su código
    let rolCodigoDestino: string | undefined;
    if (dto.rol_id) {
      const rol = await trx
        .selectFrom("rol")
        .select(["id", "codigo"])
        .where("id", "=", dto.rol_id)
        .executeTakeFirst();
      if (!rol) {
        throw new RolNotFoundError();
      }
      rolCodigoDestino = rol.codigo;
    } else {
      const userActual = await trx
        .selectFrom("usuario")
        .innerJoin("rol", "rol.id", "usuario.rol_id")
        .select(["rol.codigo as rol_codigo"])
        .where("usuario.id", "=", usuarioId)
        .executeTakeFirst();
      rolCodigoDestino = userActual?.rol_codigo;
    }

    const esRolTerrenoDestino = esRolTerreno(rolCodigoDestino);

    // 4. Validar que la delegación exista si se especifica
    if (dto.delegacion_id) {
      const delegacion = await trx
        .selectFrom("delegacion")
        .select(["id"])
        .where("id", "=", dto.delegacion_id)
        .executeTakeFirst();
      if (!delegacion) {
        throw new DelegacionNotFoundError();
      }
    }

    // 5. Validar unicidad de email y rut si se intentan cambiar
    if (dto.email) {
      const emailExistente = await trx
        .selectFrom("usuario")
        .select(["id"])
        .where("email", "=", dto.email)
        .where("id", "!=", usuarioId)
        .executeTakeFirst();

      if (emailExistente) {
        throw new EmailDuplicadoError();
      }
    }

    if (dto.rut) {
      const rutExistente = await trx
        .selectFrom("usuario")
        .select(["id"])
        .where("rut", "=", dto.rut)
        .where("id", "!=", usuarioId)
        .executeTakeFirst();

      if (rutExistente) {
        throw new RutDuplicadoError();
      }
    }

    // 6. Preparar datos para actualizar tabla 'usuario'
    const datosUsuario: Record<string, unknown> = {};
    if (dto.rut !== undefined) datosUsuario.rut = dto.rut;
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
        if (!usuarioActual.fecha_salida) {
          datosUsuario.fecha_salida = new Date().toISOString().slice(0, 10);
        }
      }
    }
    if (dto.fecha_ingreso !== undefined) datosUsuario.fecha_ingreso = dto.fecha_ingreso;
    if (dto.fecha_salida !== undefined) datosUsuario.fecha_salida = dto.fecha_salida;

    // 6.1. Estado operativo (disponibilidad actual) - siempre se persiste en 'usuario'
    const activoFinal = (dto.activo ?? usuarioActual.activo) as boolean;
    const disponibleTerrenoFinal =
      dto.disponible_terreno ??
      (personalRecord ? personalRecord.disponible_terreno : esRolTerrenoDestino ? true : null);

    let estadoOperativoFinal: EstadoOperativo;

    if (!activoFinal) {
      // Una cuenta deshabilitada sólo puede estar 'inactivo'
      estadoOperativoFinal = "inactivo";
    } else if (dto.estado_operativo !== undefined) {
      estadoOperativoFinal = resolverEstadoOperativo({
        estadoSolicitado: dto.estado_operativo,
        esRolTerreno: esRolTerrenoDestino,
        disponibleTerreno: disponibleTerrenoFinal,
        activo: activoFinal,
        estadoActual: estadoOperativoActual,
      });
    } else if (!esRolTerrenoDestino && esEstadoOperativoDeTerreno(estadoOperativoActual)) {
      // El rol deja de ser de terreno: se reasigna la disponibilidad a un estado válido
      estadoOperativoFinal = "disponible";
    } else {
      estadoOperativoFinal = estadoOperativoActual;
    }

    datosUsuario.estado_operativo = estadoOperativoFinal;

    if (Object.keys(datosUsuario).length > 0) {
      await trx
        .updateTable("usuario")
        .set(datosUsuario)
        .where("id", "=", usuarioId)
        .execute();
    }

    // 7. Preparar datos para actualizar tabla 'personal' (ficha opcional de terreno)
    const datosPersonal: Record<string, unknown> = {};
    if (dto.especialidad !== undefined) datosPersonal.especialidad = dto.especialidad;
    if (dto.cargo !== undefined) datosPersonal.cargo = dto.cargo;
    if (dto.disponible_terreno !== undefined) datosPersonal.disponible_terreno = dto.disponible_terreno;
    if (dto.observaciones !== undefined) datosPersonal.observaciones = dto.observaciones;

    // Si también se modificó la delegación y existe personal, sincronizar delegacion_id en personal
    if (dto.delegacion_id !== undefined && dto.delegacion_id !== null) {
      datosPersonal.delegacion_id = dto.delegacion_id;
    }

    // Una cuenta deshabilitada no puede estar disponible para terreno
    if (!activoFinal && personalRecord) {
      datosPersonal.disponible_terreno = false;
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
        const delegacionFicha =
          (datosPersonal.delegacion_id as string) ||
          (dto.delegacion_id ?? usuarioActual.delegacion_id);
        if (delegacionFicha) {
          await trx
            .insertInto("personal")
            .values({
              usuario_id: usuarioId,
              delegacion_id: delegacionFicha,
              especialidad: (datosPersonal.especialidad as string) || null,
              cargo: (datosPersonal.cargo as string) || null,
              disponible_terreno:
                datosPersonal.disponible_terreno !== undefined
                  ? (datosPersonal.disponible_terreno as boolean)
                  : activoFinal,
              observaciones: (datosPersonal.observaciones as string) || null,
            })
            .execute();
        }
      }
    }

    // 8. Registrar trazabilidad en log de cambios de usuarios
    const cambios = { ...datosUsuario, ...datosPersonal };
    if (Object.keys(cambios).length > 0) {
      let adminValido: string | null = null;
      if (modificadoPorId && z.string().uuid().safeParse(modificadoPorId).success) {
        const adminExists = await trx
          .selectFrom("usuario")
          .select("id")
          .where("id", "=", modificadoPorId)
          .executeTakeFirst();
        if (adminExists) {
          adminValido = modificadoPorId;
        }
      }

      await trx
        .insertInto("log_cambios_usuarios")
        .values({
          usuario_modificado_id: usuarioId,
          modificado_por_id: adminValido,
          campos_modificados: JSON.stringify(cambios),
        })
        .execute();
    }

    // 9. Retornar el registro consolidado del empleado
    const empleadoActualizado = await trx
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
        "usuario.actualizado_en as usuario_updated_at",
        "personal.updated_at as personal_updated_at",
      ])
      .where("usuario.id", "=", usuarioId)
      .executeTakeFirstOrThrow();

    return empleadoActualizado;
  });
}
