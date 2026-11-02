import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { RegistrarEmpleadoDTO } from "../schemas/registrar-empleado.schema";
import {
  RutDuplicadoError,
  EmailDuplicadoError,
  RolNotFoundError,
  DelegacionNotFoundError,
} from "./actualizar-empleado.service";
import { esRolTerreno, resolverEstadoOperativo } from "../estado-operativo";

export {
  RutDuplicadoError,
  EmailDuplicadoError,
  RolNotFoundError,
  DelegacionNotFoundError,
};

/**
 * Servicio para registrar un nuevo funcionario o empleado municipal en el sistema SGRAI (HU-10).
 *
 * Realiza las siguientes operaciones dentro de una transacción atómica Kysely:
 * 1. Normaliza RUT y Email.
 * 2. Verifica unicidad anti-colisión en la tabla 'usuario'.
 * 3. Valida existencia de Rol y Delegación en sus respectivos catálogos.
 * 4. Cifra la contraseña provista con bcrypt (factor de costo 10).
 * 5. Inserta el registro en 'usuario' incluyendo siempre su estado operativo.
 * 6. Si el rol es de terreno o se enviaron atributos operativos, inserta en 'personal'.
 * 7. Inserta registro de auditoría en 'log_cambios_usuarios'.
 * 8. Retorna la entidad consolidada del empleado, omitiendo 'password_hash'.
 */
export async function registrarEmpleado(
  dto: RegistrarEmpleadoDTO,
  modificadoPorId: string
) {
  return await db.transaction().execute(async (trx) => {
    // 1. Normalización de RUT (sin puntos ni espacios, DV en mayúscula) y email (minúsculas)
    const rutNormalizado = dto.rut.replace(/[\.\s]/g, "").toUpperCase();
    const emailNormalizado = dto.email.trim().toLowerCase();

    // 2. Verificación de unicidad anti-colisión
    const rutExistente = await trx
      .selectFrom("usuario")
      .select(["id"])
      .where("rut", "=", rutNormalizado)
      .executeTakeFirst();

    if (rutExistente) {
      throw new RutDuplicadoError("El RUT ingresado ya pertenece a un funcionario registrado");
    }

    const emailExistente = await trx
      .selectFrom("usuario")
      .select(["id"])
      .where("email", "=", emailNormalizado)
      .executeTakeFirst();

    if (emailExistente) {
      throw new EmailDuplicadoError("El correo electrónico ya está en uso");
    }

    // 3. Verificación de rol y delegación
    const rol = await trx
      .selectFrom("rol")
      .select(["id", "codigo", "nombre"])
      .where("id", "=", dto.rol_id)
      .executeTakeFirst();

    if (!rol) {
      throw new RolNotFoundError("El rol especificado no existe");
    }

    const delegacion = await trx
      .selectFrom("delegacion")
      .select(["id", "codigo", "nombre"])
      .where("id", "=", dto.delegacion_id)
      .executeTakeFirst();

    if (!delegacion) {
      throw new DelegacionNotFoundError("La delegación especificada no existe");
    }

    // 4. Hasheo criptográfico de la contraseña
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 5. Inserción atómica en la tabla 'usuario'
    const fechaIngreso = dto.fecha_ingreso ?? new Date().toISOString().slice(0, 10);
    const activo = dto.activo ?? true;

    // La disponibilidad (estado operativo) es un atributo de toda cuenta del sistema.
    // Default: cuenta activa => 'disponible'; cuenta inactiva => 'inactivo'.
    const esRolTerrenoUsuario = esRolTerreno(rol.codigo);
    const estadoOperativo = resolverEstadoOperativo({
      estadoSolicitado: dto.estado_operativo,
      esRolTerreno: esRolTerrenoUsuario,
      disponibleTerreno: dto.disponible_terreno,
      activo,
    });

    const [nuevoUsuario] = await trx
      .insertInto("usuario")
      .values({
        rut: rutNormalizado,
        nombres: dto.nombres.trim(),
        apellidos: dto.apellidos.trim(),
        email: emailNormalizado,
        telefono: dto.telefono.trim(),
        password_hash: passwordHash,
        rol_id: dto.rol_id,
        delegacion_id: dto.delegacion_id,
        activo,
        estado_operativo: estadoOperativo,
        fecha_ingreso: fechaIngreso,
      })
      .returning(["id"])
      .execute();

    const nuevoUsuarioId = nuevoUsuario.id;

    // 6. Inserción condicional en la tabla 'personal' (roles de terreno o atributos de terreno)
    const tieneDatosTerreno =
      dto.cargo !== undefined ||
      dto.especialidad !== undefined ||
      dto.observaciones !== undefined ||
      dto.disponible_terreno !== undefined;

    let personalId: string | null = null;
    if (esRolTerrenoUsuario || tieneDatosTerreno) {
      const [nuevoPersonal] = await trx
        .insertInto("personal")
        .values({
          usuario_id: nuevoUsuarioId,
          delegacion_id: dto.delegacion_id,
          cargo: dto.cargo ?? null,
          especialidad: dto.especialidad ?? null,
          disponible_terreno: dto.disponible_terreno ?? true,
          observaciones: dto.observaciones ?? null,
        })
        .returning(["id"])
        .execute();

      personalId = nuevoPersonal.id;
    }

    // 7. Registro inmutable en log_cambios_usuarios
    await trx
      .insertInto("log_cambios_usuarios")
      .values({
        usuario_modificado_id: nuevoUsuarioId,
        modificado_por_id: modificadoPorId,
        campos_modificados: JSON.stringify({
          evento: "ALTA_FUNCIONARIO",
          fecha: new Date().toISOString(),
          datos_creados: {
            rut: rutNormalizado,
            email: emailNormalizado,
            rol_id: dto.rol_id,
            delegacion_id: dto.delegacion_id,
            es_terreno: esRolTerrenoUsuario || Boolean(personalId),
            estado_operativo: estadoOperativo,
          },
        }),
      })
      .execute();

    // 8. Consulta de la entidad consolidada (sin password_hash)
    const empleadoCreado = await trx
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
      .where("usuario.id", "=", nuevoUsuarioId)
      .executeTakeFirstOrThrow();

    return {
      ...empleadoCreado,
      es_personal: empleadoCreado.personal_id !== null,
    };
  });
}
