import { sql } from "kysely";
import { db } from "@/lib/db";

export interface TokenParaRestablecerDTO {
  tokenId: string;
  usuarioId: string;
  tokenHash: string;
  expiraEn: Date;
  usadoEn: Date | null;
  usuarioActivo: boolean;
  usuarioPasswordHash: string;
}

export class RecuperacionContrasenaRepository {
  /**
   * Cuenta cuántas solicitudes de recuperación ha emitido un usuario a partir de una fecha determinada.
   * Utilizado para control de tasa (rate limiting) de solicitudes por usuario.
   */
  async contarSolicitudesRecientes(
    usuarioId: string,
    desde: Date
  ): Promise<number> {
    const result = await db
      .selectFrom("token_recuperacion_contrasena")
      .select(db.fn.count("id").as("total"))
      .where("usuario_id", "=", usuarioId)
      .where("creado_en", ">=", desde)
      .executeTakeFirst();

    return Number(result?.total ?? 0);
  }

  /**
   * Registra un nuevo token criptográfico efímero e invalida atómicamente cualquier
   * token previo que se encuentre aún pendiente para dicho usuario.
   */
  async crearTokenInvalidandoPrevios(datos: {
    usuarioId: string;
    tokenHash: string;
    expiraEn: Date;
  }): Promise<void> {
    await db.transaction().execute(async (trx) => {
      // 1. Invalidar tokens previos activos/no usados del usuario
      await trx
        .updateTable("token_recuperacion_contrasena")
        .set({ usado_en: sql`CURRENT_TIMESTAMP` })
        .where("usuario_id", "=", datos.usuarioId)
        .where("usado_en", "is", null)
        .execute();

      // 2. Insertar nuevo token con su hash SHA-256
      await trx
        .insertInto("token_recuperacion_contrasena")
        .values({
          usuario_id: datos.usuarioId,
          token_hash: datos.tokenHash,
          expira_en: datos.expiraEn,
        })
        .execute();
    });
  }

  /**
   * Obtiene la información del token y su usuario asociado a partir del hash del token.
   */
  async obtenerTokenParaRestablecer(
    tokenHash: string
  ): Promise<TokenParaRestablecerDTO | null> {
    const row = await db
      .selectFrom("token_recuperacion_contrasena")
      .innerJoin(
        "usuario",
        "usuario.id",
        "token_recuperacion_contrasena.usuario_id"
      )
      .select([
        "token_recuperacion_contrasena.id as token_id",
        "token_recuperacion_contrasena.usuario_id",
        "token_recuperacion_contrasena.token_hash",
        "token_recuperacion_contrasena.expira_en",
        "token_recuperacion_contrasena.usado_en",
        "usuario.activo as usuario_activo",
        "usuario.password_hash as usuario_password_hash",
      ])
      .where("token_recuperacion_contrasena.token_hash", "=", tokenHash)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      tokenId: row.token_id,
      usuarioId: row.usuario_id,
      tokenHash: row.token_hash,
      expiraEn: new Date(row.expira_en),
      usadoEn: row.usado_en ? new Date(row.usado_en) : null,
      usuarioActivo: Boolean(row.usuario_activo),
      usuarioPasswordHash: row.usuario_password_hash ?? "",
    };
  }

  /**
   * Consume de forma atómica el token, actualiza la contraseña con el nuevo hash bcrypt (factor 10),
   * reinicia los contadores de seguridad (intentos_fallidos = 0, bloqueado_hasta = NULL)
   * y genera el registro inmutable de auditoría en log_cambios_usuarios.
   */
  async consumirTokenYRestablecerContrasena(datos: {
    tokenId: string;
    usuarioId: string;
    nuevoPasswordHash: string;
  }): Promise<void> {
    await db.transaction().execute(async (trx) => {
      // 1. Invalidar el token consumido y cualquier otro activo del usuario
      await trx
        .updateTable("token_recuperacion_contrasena")
        .set({ usado_en: sql`CURRENT_TIMESTAMP` })
        .where("usuario_id", "=", datos.usuarioId)
        .where("usado_en", "is", null)
        .execute();

      // 2. Actualizar contraseña y reiniciar atómicamente contadores de penalización por fuerza bruta
      await trx
        .updateTable("usuario")
        .set({
          password_hash: datos.nuevoPasswordHash,
          intentos_fallidos: 0,
          bloqueado_hasta: null,
          actualizado_en: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", datos.usuarioId)
        .execute();

      // 3. Registrar auditoría institucional en log_cambios_usuarios
      await trx
        .insertInto("log_cambios_usuarios")
        .values({
          usuario_modificado_id: datos.usuarioId,
          modificado_por_id: null,
          campos_modificados: JSON.stringify({
            evento: "restablecimiento_contrasena",
            metodo: "token_recuperacion_seguro",
            desbloqueo_fuerza_bruta: true,
            fecha: new Date().toISOString(),
          }),
        })
        .execute();
    });
  }
}

export const recuperacionContrasenaRepository =
  new RecuperacionContrasenaRepository();
