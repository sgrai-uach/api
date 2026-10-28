import { db } from "@/lib/db";
import { sql } from "kysely";

export interface FilaCuadrillaDetalle {
  id: string;
  nombre: string;
  estado: "DISPONIBLE" | "EN_MISION" | "NO_DISPONIBLE";
  creado_en: Date;
  creado_por_id: string | null;
  delegacion_id: string;
  delegacion_nombre: string;
  delegado_id: string;
  delegado_nombre: string;
  delegado_email: string;
  delegado_rut: string | null;
}

export interface DatosCrearCuadrilla {
  nombre: string;
  delegacionId: string;
  usuarioDelegadoId: string;
  creadoPorId: string;
}

/**
 * Busca si existe una cuadrilla activa con el mismo nombre (insensible a mayúsculas y espacios).
 */
export async function buscarCuadrillaPorNombre(nombre: string) {
  const nombreLimpio = nombre.trim().toLowerCase();
  return await db
    .selectFrom("cuadrilla")
    .select(["id", "nombre"])
    .where(sql`LOWER(TRIM(nombre))`, "=", nombreLimpio)
    .where("eliminado_en", "is", null)
    .executeTakeFirst();
}

/**
 * Busca si el usuario ya está asignado como líder a una cuadrilla activa (eliminado_en IS NULL y estado != 'NO_DISPONIBLE').
 * Resuelve BUG-H79-API-01 (Mando Único ICS).
 */
export async function buscarCuadrillaActivaDeDelegado(usuarioDelegadoId: string) {
  return await db
    .selectFrom("cuadrilla")
    .select(["id", "nombre", "estado"])
    .where("usuario_delegado_id", "=", usuarioDelegadoId)
    .where("eliminado_en", "is", null)
    .where("estado", "!=", "NO_DISPONIBLE")
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
 * Obtiene el rol correspondiente al Delegado de Cuadrilla.
 */
export async function obtenerRolDelegadoCuadrilla() {
  return await db
    .selectFrom("rol")
    .select(["id", "codigo", "nombre"])
    .where("codigo", "=", "DELEGADO_CUADRILLA")
    .executeTakeFirst();
}

/**
 * Inserta la nueva cuadrilla, promueve al delegado a DELEGADO_CUADRILLA si no lo era
 * y sincroniza la delegación territorial en la tabla usuario y personal (BUG-H79-API-04).
 */
export async function insertarCuadrillaConDelegado(
  datos: DatosCrearCuadrilla,
  rolDelegadoId: string,
  usuarioActualRolCodigo?: string,
  usuarioActualDelegacionId?: string | null
): Promise<FilaCuadrillaDetalle> {
  return await db.transaction().execute(async (trx) => {
    // 1. Insertar la cuadrilla en estado inicial DISPONIBLE
    const cuadrillaInsertada = await trx
      .insertInto("cuadrilla")
      .values({
        nombre: datos.nombre.trim(),
        estado: "DISPONIBLE",
        delegacion_id: datos.delegacionId,
        usuario_delegado_id: datos.usuarioDelegadoId,
        creado_por_id: datos.creadoPorId,
      })
      .returning(["id", "nombre", "estado", "creado_en", "creado_por_id", "delegacion_id", "usuario_delegado_id"])
      .executeTakeFirstOrThrow();

    // 2. Sincronizar rol y delegación territorial del delegado si es necesario
    const updatesUsuario: { rol_id?: string; delegacion_id?: string } = {};
    const camposModificados: Record<string, unknown> = {};

    if (usuarioActualRolCodigo !== "DELEGADO_CUADRILLA") {
      updatesUsuario.rol_id = rolDelegadoId;
      camposModificados.rol_id = rolDelegadoId;
      camposModificados.rol_codigo = "DELEGADO_CUADRILLA";
    }

    if (usuarioActualDelegacionId !== datos.delegacionId) {
      updatesUsuario.delegacion_id = datos.delegacionId;
      camposModificados.delegacion_id = datos.delegacionId;
    }

    if (Object.keys(updatesUsuario).length > 0) {
      await trx
        .updateTable("usuario")
        .set(updatesUsuario)
        .where("id", "=", datos.usuarioDelegadoId)
        .execute();

      // Sincronizar delegación en ficha de personal si existe
      if (updatesUsuario.delegacion_id) {
        await trx
          .updateTable("personal")
          .set({ delegacion_id: updatesUsuario.delegacion_id })
          .where("usuario_id", "=", datos.usuarioDelegadoId)
          .execute();
      }

      camposModificados.motivo = `Asignación de liderazgo en cuadrilla ${datos.nombre.trim()}`;

      await trx
        .insertInto("log_cambios_usuarios")
        .values({
          usuario_modificado_id: datos.usuarioDelegadoId,
          modificado_por_id: datos.creadoPorId,
          campos_modificados: JSON.stringify(camposModificados),
        })
        .execute();
    }

    // 3. Consultar datos consolidados para la respuesta
    const filaConsolidada = await trx
      .selectFrom("cuadrilla")
      .innerJoin("delegacion", "delegacion.id", "cuadrilla.delegacion_id")
      .innerJoin("usuario", "usuario.id", "cuadrilla.usuario_delegado_id")
      .select([
        "cuadrilla.id as id",
        "cuadrilla.nombre as nombre",
        "cuadrilla.estado as estado",
        "cuadrilla.creado_en as creado_en",
        "cuadrilla.creado_por_id as creado_por_id",
        "delegacion.id as delegacion_id",
        "delegacion.nombre as delegacion_nombre",
        "usuario.id as delegado_id",
        "usuario.nombre as delegado_nombre",
        "usuario.email as delegado_email",
        "usuario.rut as delegado_rut",
      ])
      .where("cuadrilla.id", "=", cuadrillaInsertada.id)
      .executeTakeFirstOrThrow();

    return filaConsolidada as FilaCuadrillaDetalle;
  });
}
