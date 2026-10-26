import { db } from "@/lib/db";
import { sql } from "kysely";

export interface FilaCuadrillaParaEdicion {
  id: string;
  nombre: string;
  estado: "DISPONIBLE" | "EN_MISION" | "NO_DISPONIBLE";
  delegacion_id: string | null;
  usuario_delegado_id: string | null;
  eliminado_en: Date | null;
}

export interface FilaCuadrillaDetalleConsolidado {
  id: string;
  nombre: string;
  estado: "DISPONIBLE" | "EN_MISION" | "NO_DISPONIBLE";
  creado_en: Date;
  actualizado_en: Date | null;
  creado_por_id: string | null;
  actualizado_por_id: string | null;
  delegacion_id: string;
  delegacion_nombre: string;
  delegado_id: string;
  delegado_nombre: string;
  delegado_email: string;
  delegado_rut: string | null;
  recursos: Array<{
    id: string;
    recurso_id: string;
    nombre: string;
    cantidad_asignada: number;
    es_individual: boolean;
  }>;
  trabajadores: Array<{
    id: string;
    personal_id: string;
    usuario_id: string;
    nombre: string;
    rut: string | null;
    cargo: string | null;
    especialidad: string | null;
    asignado_en: Date;
  }>;
}

export interface DatosActualizarCuadrilla {
  id: string;
  nombre: string;
  delegacionId: string;
  usuarioDelegadoId: string;
  delegadoAnteriorId: string | null;
  actualizadoPorId: string;
  recursos: Array<{ recursoId: string; cantidad: number }>;
  trabajadores: Array<{ personalId: string }>;
}

/**
 * Consulta la cuadrilla por ID para validación de estado y existencia en operaciones de edición.
 */
export async function obtenerCuadrillaPorIdParaEdicion(
  id: string
): Promise<FilaCuadrillaParaEdicion | undefined> {
  return await db
    .selectFrom("cuadrilla")
    .select([
      "id",
      "nombre",
      "estado",
      "delegacion_id",
      "usuario_delegado_id",
      "eliminado_en",
    ])
    .where("id", "=", id)
    .where("eliminado_en", "is", null)
    .executeTakeFirst();
}

/**
 * Verifica si la cuadrilla posee misiones activas en curso en el sistema.
 */
export async function verificarMisionesActivasCuadrilla(
  cuadrillaId: string
): Promise<boolean> {
  const misionActiva = await db
    .selectFrom("mision")
    .select(["id", "codigo", "estado"])
    .where("cuadrilla_id", "=", cuadrillaId)
    .where("estado", "in", ["PLANIFICADA", "DESPACHADA", "EN_CURSO"])
    .executeTakeFirst();

  return Boolean(misionActiva);
}

/**
 * Valida si existe otra cuadrilla activa con el mismo nombre (insensible a mayúsculas y espacios).
 */
export async function buscarCuadrillaPorNombreExcluyendoId(
  nombre: string,
  cuadrillaId: string
) {
  const nombreLimpio = nombre.trim().toLowerCase();
  return await db
    .selectFrom("cuadrilla")
    .select(["id", "nombre"])
    .where(sql`LOWER(TRIM(nombre))`, "=", nombreLimpio)
    .where("id", "!=", cuadrillaId)
    .where("eliminado_en", "is", null)
    .executeTakeFirst();
}

/**
 * Consulta la delegación por ID y verifica si está activa.
 */
export async function obtenerDelegacionPorId(delegacionId: string) {
  return await db
    .selectFrom("delegacion")
    .select(["id", "nombre", "activo"])
    .where("id", "=", delegacionId)
    .executeTakeFirst();
}

/**
 * Consulta un usuario por ID con su información de rol y estado activo.
 */
export async function obtenerUsuarioPorId(usuarioId: string) {
  return await db
    .selectFrom("usuario")
    .leftJoin("rol", "rol.id", "usuario.rol_id")
    .select([
      "usuario.id as id",
      "usuario.nombre as nombre",
      "usuario.email as email",
      "usuario.rut as rut",
      "usuario.activo as activo",
      "usuario.rol_id as rol_id",
      "usuario.delegacion_id as delegacion_id",
      "rol.codigo as rol_codigo",
    ])
    .where("usuario.id", "=", usuarioId)
    .executeTakeFirst();
}

/**
 * Cuenta cuántas otras cuadrillas activas lidera un usuario.
 */
export async function contarOtrasCuadrillasActivasPorDelegado(
  usuarioId: string,
  excluirCuadrillaId: string
): Promise<number> {
  const resultado = await db
    .selectFrom("cuadrilla")
    .select((eb) => eb.fn.count("id").as("total"))
    .where("usuario_delegado_id", "=", usuarioId)
    .where("id", "!=", excluirCuadrillaId)
    .where("eliminado_en", "is", null)
    .executeTakeFirst();

  return Number(resultado?.total ?? 0);
}

/**
 * Obtiene el rol correspondiente a un código (ej. DELEGADO_CUADRILLA o BRIGADISTA).
 */
export async function obtenerRolPorCodigo(codigo: string) {
  return await db
    .selectFrom("rol")
    .select(["id", "codigo", "nombre"])
    .where("codigo", "=", codigo)
    .executeTakeFirst();
}

/**
 * Obtiene y valida las fichas de personal solicitadas para verificar su estado operativo.
 */
export async function obtenerPersonalParaAsignacion(personalIds: string[]) {
  if (personalIds.length === 0) return [];

  return await db
    .selectFrom("personal")
    .innerJoin("usuario", "usuario.id", "personal.usuario_id")
    .select([
      "personal.id as id",
      "personal.usuario_id as usuario_id",
      "usuario.nombre as nombre",
      "usuario.rut as rut",
      "usuario.activo as usuario_activo",
      "personal.cargo as cargo",
      "personal.especialidad as especialidad",
      "personal.estado_operativo as estado_operativo",
      "personal.disponible_terreno as disponible_terreno",
    ])
    .where("personal.id", "in", personalIds)
    .execute();
}

/**
 * Obtiene y valida los recursos logísticos solicitados en bodega/inventario.
 */
export async function obtenerRecursosParaAsignacion(recursoIds: string[]) {
  if (recursoIds.length === 0) return [];

  return await db
    .selectFrom("recurso")
    .select([
      "id",
      "nombre",
      "es_individual",
      "estado",
      "cantidad_inventario",
      "cantidad_en_uso",
    ])
    .where("id", "in", recursoIds)
    .execute();
}

/**
 * Verifica si algún recurso individual ya está asignado a otra cuadrilla activa.
 */
export async function obtenerRecursosIndividualesAsignadosAOtrasCuadrillas(
  recursoIds: string[],
  excluirCuadrillaId: string
) {
  if (recursoIds.length === 0) return [];

  return await db
    .selectFrom("cuadrilla_recurso")
    .innerJoin("recurso", "recurso.id", "cuadrilla_recurso.recurso_id")
    .innerJoin("cuadrilla", "cuadrilla.id", "cuadrilla_recurso.cuadrilla_id")
    .select([
      "recurso.id as recurso_id",
      "recurso.nombre as recurso_nombre",
      "cuadrilla.nombre as cuadrilla_nombre",
    ])
    .where("cuadrilla_recurso.recurso_id", "in", recursoIds)
    .where("recurso.es_individual", "=", true)
    .where("cuadrilla.id", "!=", excluirCuadrillaId)
    .where("cuadrilla.eliminado_en", "is", null)
    .execute();
}

/**
 * Ejecuta atómicamente la actualización de la cuadrilla, reasignación de roles y su dotación completa.
 */
export async function actualizarCuadrillaConDotacionTransaccional(
  datos: DatosActualizarCuadrilla,
  rolDelegadoId: string,
  rolBrigadistaId: string | null
): Promise<FilaCuadrillaDetalleConsolidado> {
  return await db.transaction().execute(async (trx) => {
    // 1. Actualizar datos base de la cuadrilla y registrar auditoría
    await trx
      .updateTable("cuadrilla")
      .set({
        nombre: datos.nombre.trim(),
        delegacion_id: datos.delegacionId,
        usuario_delegado_id: datos.usuarioDelegadoId,
        actualizado_por_id: datos.actualizadoPorId,
        actualizado_en: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", datos.id)
      .execute();

    // 2. Gestión de roles ante cambio de delegado
    if (datos.delegadoAnteriorId && datos.delegadoAnteriorId !== datos.usuarioDelegadoId) {
      // Verificar si el delegado saliente lidera otra cuadrilla activa
      const otrasCuadrillas = await trx
        .selectFrom("cuadrilla")
        .select((eb) => eb.fn.count("id").as("total"))
        .where("usuario_delegado_id", "=", datos.delegadoAnteriorId)
        .where("id", "!=", datos.id)
        .where("eliminado_en", "is", null)
        .executeTakeFirst();

      const tieneOtras = Number(otrasCuadrillas?.total ?? 0) > 0;

      // Si no lidera otra cuadrilla y existe el rol brigadista, revertir rol
      if (!tieneOtras && rolBrigadistaId) {
        await trx
          .updateTable("usuario")
          .set({ rol_id: rolBrigadistaId })
          .where("id", "=", datos.delegadoAnteriorId)
          .execute();

        await trx
          .insertInto("log_cambios_usuarios")
          .values({
            usuario_modificado_id: datos.delegadoAnteriorId,
            modificado_por_id: datos.actualizadoPorId,
            campos_modificados: JSON.stringify({
              rol_id: rolBrigadistaId,
              rol_codigo: "BRIGADISTA",
              motivo: `Reversión automática de rol al dejar liderazgo de cuadrilla ${datos.nombre.trim()}`,
            }),
          })
          .execute();
      }

      // Al nuevo delegado, verificar si necesita promoción al rol DELEGADO_CUADRILLA
      const nuevoDelegadoActual = await trx
        .selectFrom("usuario")
        .leftJoin("rol", "rol.id", "usuario.rol_id")
        .select(["usuario.id", "rol.codigo as rol_codigo"])
        .where("usuario.id", "=", datos.usuarioDelegadoId)
        .executeTakeFirst();

      if (nuevoDelegadoActual && nuevoDelegadoActual.rol_codigo !== "DELEGADO_CUADRILLA") {
        await trx
          .updateTable("usuario")
          .set({ rol_id: rolDelegadoId })
          .where("id", "=", datos.usuarioDelegadoId)
          .execute();

        await trx
          .insertInto("log_cambios_usuarios")
          .values({
            usuario_modificado_id: datos.usuarioDelegadoId,
            modificado_por_id: datos.actualizadoPorId,
            campos_modificados: JSON.stringify({
              rol_id: rolDelegadoId,
              rol_codigo: "DELEGADO_CUADRILLA",
              motivo: `Promoción automática a Delegado al asumir liderazgo de cuadrilla ${datos.nombre.trim()}`,
            }),
          })
          .execute();
      }
    }

    // 3. Reconciliación de trabajadores (cuadrilla_personal)
    await trx
      .deleteFrom("cuadrilla_personal")
      .where("cuadrilla_id", "=", datos.id)
      .execute();

    if (datos.trabajadores.length > 0) {
      await trx
        .insertInto("cuadrilla_personal")
        .values(
          datos.trabajadores.map((t) => ({
            cuadrilla_id: datos.id,
            personal_id: t.personalId,
          }))
        )
        .execute();
    }

    // 4. Reconciliación de recursos asignados (cuadrilla_recurso)
    await trx
      .deleteFrom("cuadrilla_recurso")
      .where("cuadrilla_id", "=", datos.id)
      .execute();

    if (datos.recursos.length > 0) {
      await trx
        .insertInto("cuadrilla_recurso")
        .values(
          datos.recursos.map((r) => ({
            cuadrilla_id: datos.id,
            recurso_id: r.recursoId,
            cantidad_asignada: r.cantidad,
          }))
        )
        .execute();
    }

    // 5. Consultar entidad consolidada para la respuesta
    const cuadrillaFila = await trx
      .selectFrom("cuadrilla")
      .innerJoin("delegacion", "delegacion.id", "cuadrilla.delegacion_id")
      .innerJoin("usuario", "usuario.id", "cuadrilla.usuario_delegado_id")
      .select([
        "cuadrilla.id as id",
        "cuadrilla.nombre as nombre",
        "cuadrilla.estado as estado",
        "cuadrilla.creado_en as creado_en",
        "cuadrilla.actualizado_en as actualizado_en",
        "cuadrilla.creado_por_id as creado_por_id",
        "cuadrilla.actualizado_por_id as actualizado_por_id",
        "delegacion.id as delegacion_id",
        "delegacion.nombre as delegacion_nombre",
        "usuario.id as delegado_id",
        "usuario.nombre as delegado_nombre",
        "usuario.email as delegado_email",
        "usuario.rut as delegado_rut",
      ])
      .where("cuadrilla.id", "=", datos.id)
      .executeTakeFirstOrThrow();

    // Obtener recursos asignados
    const recursosAsignados = await trx
      .selectFrom("cuadrilla_recurso")
      .innerJoin("recurso", "recurso.id", "cuadrilla_recurso.recurso_id")
      .select([
        "cuadrilla_recurso.id as id",
        "cuadrilla_recurso.recurso_id as recurso_id",
        "recurso.nombre as nombre",
        "cuadrilla_recurso.cantidad_asignada as cantidad_asignada",
        "recurso.es_individual as es_individual",
      ])
      .where("cuadrilla_recurso.cuadrilla_id", "=", datos.id)
      .execute();

    // Obtener trabajadores asignados
    const trabajadoresAsignados = await trx
      .selectFrom("cuadrilla_personal")
      .innerJoin("personal", "personal.id", "cuadrilla_personal.personal_id")
      .innerJoin("usuario", "usuario.id", "personal.usuario_id")
      .select([
        "cuadrilla_personal.id as id",
        "cuadrilla_personal.personal_id as personal_id",
        "usuario.id as usuario_id",
        "usuario.nombre as nombre",
        "usuario.rut as rut",
        "personal.cargo as cargo",
        "personal.especialidad as especialidad",
        "cuadrilla_personal.asignado_en as asignado_en",
      ])
      .where("cuadrilla_personal.cuadrilla_id", "=", datos.id)
      .execute();

    return {
      id: cuadrillaFila.id,
      nombre: cuadrillaFila.nombre,
      estado: cuadrillaFila.estado as "DISPONIBLE" | "EN_MISION" | "NO_DISPONIBLE",
      creado_en: cuadrillaFila.creado_en,
      actualizado_en: cuadrillaFila.actualizado_en ?? null,
      creado_por_id: cuadrillaFila.creado_por_id ?? null,
      actualizado_por_id: cuadrillaFila.actualizado_por_id ?? null,
      delegacion_id: cuadrillaFila.delegacion_id,
      delegacion_nombre: cuadrillaFila.delegacion_nombre,
      delegado_id: cuadrillaFila.delegado_id,
      delegado_nombre: cuadrillaFila.delegado_nombre,
      delegado_email: cuadrillaFila.delegado_email,
      delegado_rut: cuadrillaFila.delegado_rut,
      recursos: recursosAsignados.map((r) => ({
        id: r.id,
        recurso_id: r.recurso_id,
        nombre: r.nombre,
        cantidad_asignada: Number(r.cantidad_asignada),
        es_individual: Boolean(r.es_individual),
      })),
      trabajadores: trabajadoresAsignados.map((t) => ({
        id: t.id,
        personal_id: t.personal_id,
        usuario_id: t.usuario_id,
        nombre: t.nombre,
        rut: t.rut,
        cargo: t.cargo,
        especialidad: t.especialidad,
        asignado_en: t.asignado_en,
      })),
    };
  });
}
