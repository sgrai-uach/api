import { db } from "../../lib/db";
import type {
  PermisoAsignadoDTO,
  RolConPermisoRaw,
  RolItemDTO,
  UsuarioAutenticado,
} from "./types";

export class SeguridadRepository {
  /**
   * Obtiene todos los perfiles registrados con sus permisos asignados en una sola consulta optimizada.
   */
  async obtenerTodosLosRolesConPermisos(): Promise<RolItemDTO[]> {
    const rows: RolConPermisoRaw[] = await db
      .selectFrom("rol")
      .leftJoin("rol_permiso", "rol_permiso.rol_id", "rol.id")
      .leftJoin("permiso", "permiso.id", "rol_permiso.permiso_id")
      .select([
        "rol.id as rol_id",
        "rol.nombre as rol_nombre",
        "rol.descripcion as rol_descripcion",
        "rol.activo as rol_activo",
        "rol.es_sistema as rol_es_sistema",
        "rol.creado_en as rol_creado_en",
        "rol.actualizado_en as rol_actualizado_en",
        "permiso.id as permiso_id",
        "permiso.codigo as permiso_codigo",
        "permiso.nombre as permiso_nombre",
        "permiso.descripcion as permiso_descripcion",
        "permiso.modulo as permiso_modulo",
        "rol_permiso.asignado_en as permiso_asignado_en",
        "rol_permiso.asignado_por_id as permiso_asignado_por_id",
      ])
      .orderBy("rol.nombre", "asc")
      .orderBy("permiso.modulo", "asc")
      .orderBy("permiso.nombre", "asc")
      .execute();

    return this.agruparRolesConPermisos(rows);
  }

  /**
   * Obtiene el detalle de un perfil específico por su UUID con todos sus permisos asociados.
   */
  async obtenerRolPorId(rolId: string): Promise<RolItemDTO | null> {
    const rows: RolConPermisoRaw[] = await db
      .selectFrom("rol")
      .leftJoin("rol_permiso", "rol_permiso.rol_id", "rol.id")
      .leftJoin("permiso", "permiso.id", "rol_permiso.permiso_id")
      .select([
        "rol.id as rol_id",
        "rol.nombre as rol_nombre",
        "rol.descripcion as rol_descripcion",
        "rol.activo as rol_activo",
        "rol.es_sistema as rol_es_sistema",
        "rol.creado_en as rol_creado_en",
        "rol.actualizado_en as rol_actualizado_en",
        "permiso.id as permiso_id",
        "permiso.codigo as permiso_codigo",
        "permiso.nombre as permiso_nombre",
        "permiso.descripcion as permiso_descripcion",
        "permiso.modulo as permiso_modulo",
        "rol_permiso.asignado_en as permiso_asignado_en",
        "rol_permiso.asignado_por_id as permiso_asignado_por_id",
      ])
      .where("rol.id", "=", rolId)
      .orderBy("permiso.modulo", "asc")
      .orderBy("permiso.nombre", "asc")
      .execute();

    if (rows.length === 0) {
      return null;
    }

    const roles = this.agruparRolesConPermisos(rows);
    return roles[0] || null;
  }

  /**
   * Obtiene un usuario con su rol asociado para fines de autenticación y autorización.
   */
  async obtenerUsuarioConRolPorId(
    usuarioId: string
  ): Promise<UsuarioAutenticado | null> {
    const usuario = await db
      .selectFrom("usuario")
      .innerJoin("rol", "rol.id", "usuario.rol_id")
      .select([
        "usuario.id",
        "usuario.rut",
        "usuario.nombre",
        "usuario.email",
        "usuario.activo",
        "rol.id as rol_id",
        "rol.nombre as rol_nombre",
      ])
      .where("usuario.id", "=", usuarioId)
      .executeTakeFirst();

    if (!usuario) {
      return null;
    }

    return {
      id: usuario.id,
      rut: usuario.rut,
      nombre: usuario.nombre,
      email: usuario.email,
      rolId: usuario.rol_id,
      rolNombre: usuario.rol_nombre,
      activo: Boolean(usuario.activo),
    };
  }

  /**
   * Agrupa las filas planas resultantes del JOIN en estructuras jerárquicas de perfiles y permisos.
   */
  private agruparRolesConPermisos(rows: RolConPermisoRaw[]): RolItemDTO[] {
    const rolesMap = new Map<string, RolItemDTO>();

    for (const row of rows) {
      let rolItem = rolesMap.get(row.rol_id);

      if (!rolItem) {
        rolItem = {
          id: row.rol_id,
          nombre: row.rol_nombre,
          descripcion: row.rol_descripcion,
          activo: Boolean(row.rol_activo),
          esSistema: Boolean(row.rol_es_sistema),
          cantidadPermisos: 0,
          permisos: [],
          creadoEn: new Date(row.rol_creado_en).toISOString(),
          actualizadoEn: new Date(row.rol_actualizado_en).toISOString(),
        };
        rolesMap.set(row.rol_id, rolItem);
      }

      if (row.permiso_id && row.permiso_codigo && row.permiso_nombre && row.permiso_modulo) {
        const permisoDTO: PermisoAsignadoDTO = {
          id: row.permiso_id,
          codigo: row.permiso_codigo,
          nombre: row.permiso_nombre,
          descripcion: row.permiso_descripcion,
          modulo: row.permiso_modulo,
          asignadoEn: row.permiso_asignado_en
            ? new Date(row.permiso_asignado_en).toISOString()
            : new Date().toISOString(),
          asignadoPorId: row.permiso_asignado_por_id,
        };

        rolItem.permisos.push(permisoDTO);
      }
    }

    // Actualizar cantidad de permisos calculada
    for (const rol of rolesMap.values()) {
      rol.cantidadPermisos = rol.permisos.length;
    }

    return Array.from(rolesMap.values());
  }
}

export const seguridadRepository = new SeguridadRepository();
