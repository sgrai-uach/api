import { ForbiddenError, NotFoundError, UnauthorizedError } from "./errors";
import { seguridadRepository, SeguridadRepository } from "./repository";
import type {
  ListarRolesResponseDTO,
  RolDetalleResponseDTO,
  UsuarioAutenticado,
} from "./types";

export class SeguridadService {
  constructor(private repo: SeguridadRepository = seguridadRepository) {}

  /**
   * Valida que el identificador pertenezca a un usuario activo y con rol de Administrador.
   */
  async validarAccesoAdministrador(
    usuarioId?: string | null
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

    if (usuario.rolNombre !== "Administrador") {
      throw new ForbiddenError(
        "Acceso denegado. Se requiere el perfil de Administrador para acceder al listado y gestión de permisos."
      );
    }

    return usuario;
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
}

export const seguridadService = new SeguridadService();
