import { db } from "@/lib/db";
import { EmpleadoNotFoundError } from "./actualizar-empleado.service";

/**
 * Servicio para la eliminación lógica (soft-delete) de un empleado en SGRAI.
 *
 * Realiza las siguientes operaciones dentro de una transacción atómica:
 * 1. Resuelve si el identificador corresponde a 'personal.id' o a 'usuarios.id'.
 * 2. Actualiza la tabla 'usuarios' marcando 'activo = false' y registrando 'fecha_salida' si no existe.
 * 3. Si el usuario cuenta con ficha en la tabla 'personal', actualiza 'estado_operativo = inactivo'
 *    y 'disponible_terreno = false' para prevenir futuras asignaciones territoriales.
 * 4. Registra la auditoría en 'log_cambios_usuarios'.
 */
export async function eliminarEmpleadoLogico(
  id: string,
  modificadoPorId?: string | null
) {
  return await db.transaction().execute(async (trx) => {
    // 1. Identificar si 'id' corresponde a 'personal.id' o 'usuarios.id'
    let usuarioId = id;
    let personalRecord = await trx
      .selectFrom("personal")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (personalRecord) {
      usuarioId = personalRecord.usuario_id;
    } else {
      const userExists = await trx
        .selectFrom("usuarios")
        .select(["id", "activo", "fecha_salida"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!userExists) {
        throw new EmpleadoNotFoundError("Empleado no encontrado para dar de baja");
      }

      personalRecord = await trx
        .selectFrom("personal")
        .selectAll()
        .where("usuario_id", "=", id)
        .executeTakeFirst();
    }

    const fechaHoy = new Date().toISOString().slice(0, 10);

    // 2. Desactivar usuario y establecer fecha de salida si no existe
    const usuarioActual = await trx
      .selectFrom("usuarios")
      .select(["fecha_salida"])
      .where("id", "=", usuarioId)
      .executeTakeFirst();

    const fechaSalidaFinal = usuarioActual?.fecha_salida || fechaHoy;

    await trx
      .updateTable("usuarios")
      .set({
        activo: false,
        fecha_salida: fechaSalidaFinal,
      })
      .where("id", "=", usuarioId)
      .execute();

    // 3. Si tiene ficha operativa en personal, marcar inactivo y no disponible para terreno
    if (personalRecord) {
      await trx
        .updateTable("personal")
        .set({
          estado_operativo: "inactivo",
          disponible_terreno: false,
        })
        .where("id", "=", personalRecord.id)
        .execute();
    }

    // 4. Registrar en log de auditoría
    await trx
      .insertInto("log_cambios_usuarios")
      .values({
        usuario_modificado_id: usuarioId,
        modificado_por_id: modificadoPorId || null,
        campos_modificados: JSON.stringify({
          activo: false,
          fecha_salida: fechaSalidaFinal,
          estado_operativo: "inactivo",
          disponible_terreno: false,
          tipo_operacion: "BAJA_LOGICA_H13",
        }),
      })
      .execute();

    return {
      usuario_id: usuarioId,
      activo: false,
      fecha_salida: fechaSalidaFinal,
    };
  });
}
