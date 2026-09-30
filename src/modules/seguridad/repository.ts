import { db } from "../../lib/db";
import { BadRequestError } from "./errors";
import type {
  PermisoAsignadoDTO,
  PermisoCatalogoItemDTO,
  RolConPermisoRaw,
  RolItemDTO,
  UsuarioAutenticado,
  UsuarioActivoDTO,
} from "./types";

export class SeguridadRepository {
  /**
   * Obtiene el catálogo completo de permisos disponibles en el sistema ordenados por módulo y nombre.
   */
  async obtenerTodosLosPermisos(): Promise<PermisoCatalogoItemDTO[]> {
    const rows = await db
      .selectFrom("permiso")
      .select(["id", "codigo", "nombre", "descripcion", "modulo"])
      .orderBy("modulo", "asc")
      .orderBy("nombre", "asc")
      .execute();

    return rows.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      modulo: p.modulo,
    }));
  }

  /**
   * Obtiene un permiso específico a partir de su código único de autorización.
   */
  async obtenerPermisoPorCodigo(
    codigo: string
  ): Promise<PermisoCatalogoItemDTO | null> {
    const row = await db
      .selectFrom("permiso")
      .select(["id", "codigo", "nombre", "descripcion", "modulo"])
      .where("codigo", "=", codigo)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion,
      modulo: row.modulo,
    };
  }

  /**
   * Actualiza atómicamente los permisos de un rol dentro de una transacción estricta de base de datos.
   */
  async actualizarPermisosRol(
    rolId: string,
    nuevosPermisoIds: string[],
    asignadoPorId: string
  ): Promise<void> {
    await db.transaction().execute(async (trx) => {
      const idsUnicos = Array.from(new Set(nuevosPermisoIds));

      // 1. Validar existencia de todos los IDs provistos en la tabla permiso
      if (idsUnicos.length > 0) {
        const permisosExistentes = await trx
          .selectFrom("permiso")
          .select("id")
          .where("id", "in", idsUnicos)
          .execute();

        if (permisosExistentes.length !== idsUnicos.length) {
          const existentesSet = new Set(permisosExistentes.map((p) => p.id));
          const noEncontrados = idsUnicos.filter((id) => !existentesSet.has(id));
          throw new BadRequestError(
            `Uno o más permisos especificados no existen en el sistema: ${noEncontrados.join(", ")}`
          );
        }
      }

      // 2. Obtener permisos actualmente asignados al rol
      const actuales = await trx
        .selectFrom("rol_permiso")
        .select("permiso_id")
        .where("rol_id", "=", rolId)
        .execute();

      const actualesIds = new Set(actuales.map((a) => a.permiso_id));
      const nuevosIds = new Set(idsUnicos);

      // 3. Determinar revocaciones (eliminar) y nuevas asignaciones (insertar)
      const aEliminar = actuales
        .filter((a) => !nuevosIds.has(a.permiso_id))
        .map((a) => a.permiso_id);

      const aInsertar = idsUnicos.filter((id) => !actualesIds.has(id));

      if (aEliminar.length > 0) {
        await trx
          .deleteFrom("rol_permiso")
          .where("rol_id", "=", rolId)
          .where("permiso_id", "in", aEliminar)
          .execute();
      }

      if (aInsertar.length > 0) {
        await trx
          .insertInto("rol_permiso")
          .values(
            aInsertar.map((permisoId) => ({
              rol_id: rolId,
              permiso_id: permisoId,
              asignado_por_id: asignadoPorId,
              asignado_en: new Date(),
            }))
          )
          .execute();
      }

      // 4. Actualizar actualizado_en en la tabla rol
      await trx
        .updateTable("rol")
        .set({
          actualizado_en: new Date(),
        })
        .where("id", "=", rolId)
        .execute();
    });
  }

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
   * Obtiene la lista de códigos de permisos asignados a un rol específico.
   */
  async obtenerPermisosDeRol(rolId: string): Promise<string[]> {
    const permisos = await db
      .selectFrom("rol_permiso")
      .innerJoin("permiso", "permiso.id", "rol_permiso.permiso_id")
      .select("permiso.codigo")
      .where("rol_permiso.rol_id", "=", rolId)
      .execute();

    return permisos.map((p) => p.codigo);
  }

  /**
   * Obtiene un usuario con su rol y la lista completa de códigos de permisos asignados.
   */
  async obtenerUsuarioCompletoConPermisos(
    usuarioId: string
  ): Promise<UsuarioActivoDTO | null> {
    const usuario = await db
      .selectFrom("usuario")
      .innerJoin("rol", "rol.id", "usuario.rol_id")
      .select([
        "usuario.id",
        "usuario.rut",
        "usuario.nombre",
        "usuario.email",
        "usuario.activo",
        "usuario.delegacion_id",
        "rol.id as rol_id",
        "rol.nombre as rol_nombre",
        "rol.codigo as rol_codigo",
      ])
      .where("usuario.id", "=", usuarioId)
      .executeTakeFirst();

    if (!usuario) {
      return null;
    }

    let codigosPermisos: string[] = [];
    if (usuario.rol_nombre === "Administrador") {
      const todos = await db.selectFrom("permiso").select("codigo").execute();
      codigosPermisos = todos.map((p) => p.codigo);
    } else {
      codigosPermisos = await this.obtenerPermisosDeRol(usuario.rol_id);
    }

    return {
      id: usuario.id,
      rut: usuario.rut,
      nombre: usuario.nombre,
      email: usuario.email,
      activo: Boolean(usuario.activo),
      delegacionId: usuario.delegacion_id,
      rol: {
        id: usuario.rol_id,
        nombre: usuario.rol_nombre,
        codigo: usuario.rol_codigo ?? "",
        esAdmin: usuario.rol_nombre === "Administrador",
      },
      permisos: codigosPermisos,
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
