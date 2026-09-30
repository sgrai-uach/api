import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "./errors";
import { generarTokenJwt, type TokenPayload } from "./jwt";
import { PERMISO_GESTIONAR_ROLES, PERMISO_LEER_ROLES } from "./permisos.constants";
import { seguridadRepository, SeguridadRepository } from "./repository";
import type {
  ActualizarPermisosRolResponseDTO,
  ListarPermisosResponseDTO,
  ListarRolesResponseDTO,
  LoginRequestDTO,
  LoginResponseDTO,
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
        "Se requiere cabecera de autenticación Authorization: Bearer <token>."
      );
    }

    if (!z.string().uuid().safeParse(usuarioId.trim()).success) {
      throw new UnauthorizedError(
        `Usuario con ID '${usuarioId}' no existe o no está registrado en el sistema.`
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
        "Se requiere cabecera de autenticación Authorization: Bearer <token>."
      );
    }

    if (!z.string().uuid().safeParse(usuarioId.trim()).success) {
      throw new UnauthorizedError(
        `Usuario con ID '${usuarioId}' no existe o no está registrado en el sistema.`
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

  /**
   * Autentica a un usuario mediante sus credenciales institucionales (correo o RUT y contraseña).
   * Valida hash bcrypt, vigencia de cuenta, bloqueo por fuerza bruta y emite el JWT correspondiente.
   */
  async login(input: LoginRequestDTO): Promise<LoginResponseDTO> {
    const identificador = normalizarIdentificador(input.identificador);
    const usuario = await this.repo.obtenerUsuarioParaLogin(identificador);

    const maxIntentos = Number(process.env.AUTH_MAX_FAILED_ATTEMPTS || 5);
    const bloqueoMinutos = Number(process.env.AUTH_LOCKOUT_MINUTES || 15);

    // 1. Validar bloqueo previo si el usuario existe
    if (usuario && usuario.bloqueado_hasta) {
      const ahora = Date.now();
      const tiempoBloqueo = usuario.bloqueado_hasta.getTime();

      if (tiempoBloqueo > ahora) {
        const minutosRestantes = Math.max(
          1,
          Math.ceil((tiempoBloqueo - ahora) / (1000 * 60))
        );
        throw new ForbiddenError(
          `Cuenta temporalmente bloqueada por múltiples intentos fallidos. Intente nuevamente en ${minutosRestantes} minuto(s) o contacte al Administrador.`
        );
      } else {
        // El periodo de bloqueo finalizó, restablecer contador
        await this.repo.registrarIntentoFallido(usuario.id, 0, null);
        usuario.intentos_fallidos = 0;
        usuario.bloqueado_hasta = null;
      }
    }

    // 2. Verificar contraseña con bcrypt
    const passwordValida =
      usuario && usuario.password_hash
        ? await bcrypt.compare(input.password, usuario.password_hash)
        : false;

    if (!passwordValida) {
      if (usuario) {
        const nuevosIntentos = usuario.intentos_fallidos + 1;
        if (nuevosIntentos >= maxIntentos) {
          const bloquearHasta = new Date(
            Date.now() + bloqueoMinutos * 60 * 1000
          );
          await this.repo.registrarIntentoFallido(
            usuario.id,
            nuevosIntentos,
            bloquearHasta
          );
          throw new ForbiddenError(
            `Su cuenta ha sido bloqueada temporalmente tras ${maxIntentos} intentos fallidos. Intente nuevamente en ${bloqueoMinutos} minutos.`
          );
        } else {
          await this.repo.registrarIntentoFallido(
            usuario.id,
            nuevosIntentos,
            null
          );
        }
      }

      throw new UnauthorizedError(
        "Credenciales inválidas. Verifique su identificador o contraseña."
      );
    }

    // 3. Verificar estado activo de la cuenta
    if (!usuario.activo) {
      throw new ForbiddenError(
        "Su cuenta se encuentra deshabilitada. Contacte al Administrador."
      );
    }

    // 4. Registrar login exitoso (reinicia intentos fallidos y actualiza ultimo_acceso)
    await this.repo.registrarLoginExitoso(usuario.id);

    // 5. Cargar lista de permisos asignados
    let permisos: string[] = [];
    if (usuario.rol_nombre === "Administrador") {
      const todos = await this.repo.obtenerTodosLosPermisos();
      permisos = todos.map((p) => p.codigo);
    } else {
      permisos = await this.repo.obtenerPermisosDeRol(usuario.rol_id);
    }

    // 6. Generar JWT firmado
    const tokenPayload: TokenPayload = {
      sub: usuario.id,
      rut: usuario.rut,
      email: usuario.email,
      rolId: usuario.rol_id,
      rolCodigo: usuario.rol_codigo,
      rolNombre: usuario.rol_nombre,
      delegacionId: usuario.delegacion_id,
    };

    const { token, expiraEn } = await generarTokenJwt(tokenPayload);

    return {
      data: {
        token,
        tipoToken: "Bearer",
        expiraEn,
        usuario: {
          id: usuario.id,
          rut: usuario.rut,
          nombre: usuario.nombre,
          email: usuario.email,
          rolId: usuario.rol_id,
          rolNombre: usuario.rol_nombre,
          rolCodigo: usuario.rol_codigo,
          delegacionId: usuario.delegacion_id,
          permisos,
        },
      },
    };
  }
}

function normalizarIdentificador(identificador: string): string {
  const limpio = identificador.trim();
  if (limpio.includes("@")) {
    return limpio.toLowerCase();
  }
  return limpio.replace(/\./g, "").replace(/\s+/g, "").toUpperCase();
}

export const seguridadService = new SeguridadService();
