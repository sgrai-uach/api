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
 * Inserta la nueva cuadrilla y, si el usuario delegado aún no posee el rol 'DELEGADO_CUADRILLA',
 * lo actualiza atómicamente dentro de una transacción registrando la auditoría.
 */
export async function insertarCuadrillaConDelegado(
  datos: DatosCrearCuadrilla,
  rolDelegadoId: string,
  usuarioActualRolCodigo?: string
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

    // 2. Si el usuario no tiene el rol DELEGADO_CUADRILLA, promoverlo y registrar en auditoría
    if (usuarioActualRolCodigo !== "DELEGADO_CUADRILLA") {
      await trx
        .updateTable("usuario")
        .set({
          rol_id: rolDelegadoId,
        })
        .where("id", "=", datos.usuarioDelegadoId)
        .execute();

      await trx
        .insertInto("log_cambios_usuarios")
        .values({
          usuario_modificado_id: datos.usuarioDelegadoId,
          modificado_por_id: datos.creadoPorId,
          campos_modificados: JSON.stringify({
            rol_id: rolDelegadoId,
            rol_codigo: "DELEGADO_CUADRILLA",
            motivo: `Promoción automática al designar líder de la cuadrilla ${datos.nombre.trim()}`,
          }),
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
