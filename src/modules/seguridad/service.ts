import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./errors";
import { PERMISO_GESTIONAR_ROLES, PERMISO_LEER_ROLES } from "./permisos.constants";
import { seguridadRepository, SeguridadRepository } from "./repository";
import type {
  ActualizarPermisosRolResponseDTO,
  ListarPermisosResponseDTO,
  ListarRolesResponseDTO,
  RolDetalleResponseDTO,
  UsuarioAutenticado,
  UsuarioActivoDTO,
} from "./types";

export class SeguridadService {
  constructor(private repo: SeguridadRepository = seguridadRepository) {}

  /**
   * Valida acceso verificando si el usuario es Administrador o si su rol posee alguno
   * de los permisos requeridos en persistencia.
   */
  async validarAccesoRoles(
    usuarioId?: string | null,
    permisosRequeridos: string[] = [
      PERMISO_LEER_ROLES,
      PERMISO_GESTIONAR_ROLES,
    ]
  ): Promise<UsuarioAutenticado> {
    if (!usuarioId || usuarioId.trim() === "") {
      throw new UnauthorizedError(
        "Cabecera X-User-Id requerida para autenticación."
      );
    }

    const usuario = await this.repo.obtenerUsuarioConRolPorId(usuarioId.trim());

    if (!usuario) {
      throw new UnauthorizedError(
        `Usuario con ID '${usuarioId}' no existe o no está registrado en el sistema.`
      );
    }

    if (!usuario.activo) {
      throw new UnauthorizedError(
        "El usuario especificado se encuentra inactivo en la institución."
      );
    }

    if (usuario.rolNombre === "Administrador") {
      return usuario;
    }

    const permisosDelRol = (await this.repo.obtenerPermisosDeRol?.(usuario.rolId)) ?? [];
    const tienePermiso = permisosDelRol.some((p) => permisosRequeridos.includes(p));

    if (!tienePermiso) {
      throw new ForbiddenError(
        "Acceso denegado. Se requiere el perfil de Administrador o permisos de gestión de roles para acceder."
      );
    }

    return usuario;
  }

  /**
   * Compatibilidad y validación con fallback a permisos de rol.
   */
  async validarAccesoAdministrador(
    usuarioId?: string | null,
    permisosRequeridos: string[] = [
      PERMISO_LEER_ROLES,
      PERMISO_GESTIONAR_ROLES,
    ]
  ): Promise<UsuarioAutenticado> {
    return this.validarAccesoRoles(usuarioId, permisosRequeridos);
  }

  /**
   * Retorna los datos completos y lista de permisos del usuario autenticado.
   */
  async obtenerUsuarioActivo(usuarioId?: string | null): Promise<UsuarioActivoDTO> {
    if (!usuarioId || usuarioId.trim() === "") {
      throw new UnauthorizedError(
        "Cabecera X-User-Id requerida para autenticación."
      );
    }

    const detalle = await this.repo.obtenerUsuarioCompletoConPermisos(usuarioId.trim());
    if (!detalle) {
      throw new UnauthorizedError(
        `Usuario con ID '${usuarioId}' no existe o no está registrado en el sistema.`
      );
    }

    if (!detalle.activo) {
      throw new ForbiddenError(
        "El usuario especificado se encuentra inactivo en la institución."
      );
    }

    return detalle;
  }

  /**
   * Retorna la lista completa de perfiles y sus permisos asociados.
   * Si un rol no tiene permisos, garantiza una lista vacía y cantidadPermisos = 0.
   */
  async listarRoles(): Promise<ListarRolesResponseDTO> {
    const roles = await this.repo.obtenerTodosLosRolesConPermisos();

    return {
      data: roles,
      total: roles.length,
    };
  }

  /**
   * Retorna el catálogo completo de permisos registrados en la base de datos clasificados por módulo funcional.
   */
  async listarPermisos(): Promise<ListarPermisosResponseDTO> {
    const permisos = await this.repo.obtenerTodosLosPermisos();

    return {
      data: permisos,
      total: permisos.length,
    };
  }

  /**
   * Retorna el detalle interactivo de un rol específico con sus permisos asociados.
   */
  async obtenerDetalleRol(rolId: string): Promise<RolDetalleResponseDTO> {
    const rol = await this.repo.obtenerRolPorId(rolId);

    if (!rol) {
      throw new NotFoundError(`Perfil con ID '${rolId}' no encontrado.`);
    }

    return {
      data: rol,
    };
  }

  /**
   * Actualiza masiva y atómicamente los permisos asignados a un rol institucional específico.
   * Aplica la regla de protección contra auto-bloqueo impidiendo revocar el permiso crítico
   * 'seguridad:roles:gestionar' al rol de Administrador.
   */
  async actualizarPermisosRol(
    rolId: string,
    permisoIds: string[],
    usuarioAutenticado: UsuarioAutenticado
  ): Promise<ActualizarPermisosRolResponseDTO> {
    // 0. Validar que el operador posea permiso para gestionar roles
    if (usuarioAutenticado.rolNombre !== "Administrador") {
      const permisosDelOperador =
        (await this.repo.obtenerPermisosDeRol?.(usuarioAutenticado.rolId)) ?? [];
      if (!permisosDelOperador.includes(PERMISO_GESTIONAR_ROLES)) {
        throw new ForbiddenError(
          "Acceso denegado. Se requiere el permiso 'seguridad:roles:gestionar' para modificar roles."
        );
      }
    }

    // 1. Validar que el rol a modificar exista
    const rol = await this.repo.obtenerRolPorId(rolId);

    if (!rol) {
      throw new NotFoundError(`Perfil con ID '${rolId}' no encontrado.`);
    }

    // 2. Regla de dominio: Protección contra Auto-bloqueo del rol Administrador
    if (rol.nombre === "Administrador") {
      const permisoGestionar = await this.repo.obtenerPermisoPorCodigo(
        PERMISO_GESTIONAR_ROLES
      );

      const idPermisoGestionar =
        permisoGestionar?.id ?? "10000000-0000-4000-8000-000000000004";

      if (!permisoIds.includes(idPermisoGestionar)) {
        throw new BadRequestError(
          "El permiso 'seguridad:roles:gestionar' es obligatorio para el perfil Administrador y no puede ser revocado."
        );
      }

      const permisoLeer = await this.repo.obtenerPermisoPorCodigo(
        PERMISO_LEER_ROLES
      );

      const idPermisoLeer =
        permisoLeer?.id ?? "10000000-0000-4000-8000-000000000003";

      if (!permisoIds.includes(idPermisoLeer)) {
        throw new BadRequestError(
          "El permiso 'seguridad:roles:leer' es obligatorio para el perfil Administrador y no puede ser revocado."
        );
      }
    }

    // 3. Ejecutar mutación transaccional en persistencia
    await this.repo.actualizarPermisosRol(
      rolId,
      permisoIds,
      usuarioAutenticado.id
    );

    // 4. Retornar el detalle del rol actualizado
    const rolActualizado = await this.repo.obtenerRolPorId(rolId);

    if (!rolActualizado) {
      throw new NotFoundError(`Perfil con ID '${rolId}' no encontrado.`);
    }

    return {
      message: "Permisos actualizados correctamente en la base de datos",
      data: rolActualizado,
    };
  }
}

export const seguridadService = new SeguridadService();
