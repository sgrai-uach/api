import type { NextRequest } from "next/server";
import { UnauthorizedError } from "./errors";
import { verificarTokenJwt } from "./jwt";
import {
  PERMISO_LEER_ROLES,
  PERMISO_GESTIONAR_ROLES,
  PERMISO_LEER_PERSONAL,
  PERMISO_CREAR_PERSONAL,
  PERMISO_GESTIONAR_PERSONAL,
  PERMISO_ASIGNAR_MISION,
} from "./permisos.constants";
import { seguridadService } from "./service";
import type { UsuarioAutenticado } from "./types";

/**
 * Extrae la identificación del usuario del token JWT presente en la cabecera 'Authorization: Bearer <token>'.
 * Valida la firma criptográfica y expiración. Lanza UnauthorizedError si el token es inválido o ha expirado.
 * Retorna null si la cabecera de autorización no está presente.
 */
export async function extraerUsuarioId(
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return null;
  }

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    throw new UnauthorizedError(
      "Formato de autorización no válido. Se requiere 'Authorization: Bearer <token>'."
    );
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  try {
    const payload = await verificarTokenJwt(token);
    return payload.sub;
  } catch {
    throw new UnauthorizedError("Token de sesión inválido o expirado.");
  }
}

/**
 * Exige que la petición contenga un token JWT de sesión válido y retorna el ID del usuario autenticado.
 */
export async function exigirUsuarioId(request: NextRequest): Promise<string> {
  const usuarioId = await extraerUsuarioId(request);
  if (!usuarioId) {
    throw new UnauthorizedError(
      "Se requiere cabecera de autenticación Authorization: Bearer <token>."
    );
  }
  return usuarioId;
}

/**
 * Valida que el usuario tenga rol de Administrador o permisos de lectura/gestión de roles.
 */
export async function verificarAccesoRoles(
  request: NextRequest
): Promise<UsuarioAutenticado> {
  const usuarioId = await extraerUsuarioId(request);
  return await seguridadService.validarAccesoRoles(usuarioId, [
    PERMISO_LEER_ROLES,
    PERMISO_GESTIONAR_ROLES,
  ]);
}

/**
 * Valida que el usuario tenga rol de Administrador o permiso explícito de gestión de roles.
 */
export async function verificarGestionRoles(
  request: NextRequest
): Promise<UsuarioAutenticado> {
  const usuarioId = await extraerUsuarioId(request);
  return await seguridadService.validarAccesoRoles(usuarioId, [
    PERMISO_GESTIONAR_ROLES,
  ]);
}

/**
 * Compatibilidad legacy: delega en verificarAccesoRoles.
 */
export async function verificarAdministrador(
  request: NextRequest
): Promise<UsuarioAutenticado> {
  return await verificarAccesoRoles(request);
}

/**
 * H11 - Valida que el usuario tenga rol de Administrador o alguno de los permisos
 * del módulo de Personal (`personal:leer`, `personal:gestionar` o `personal:crear`).
 *
 * Lanza UnauthorizedError (401) si no hay token válido y ForbiddenError (403) si
 * el rol no posee los permisos requeridos.
 */
export async function verificarAccesoPersonal(
  request: NextRequest
): Promise<UsuarioAutenticado> {
  const usuarioId = await extraerUsuarioId(request);
  return await seguridadService.validarAccesoRoles(
    usuarioId,
    [
      PERMISO_LEER_PERSONAL,
      PERMISO_GESTIONAR_PERSONAL,
      PERMISO_CREAR_PERSONAL,
    ],
    "Acceso denegado. Se requiere el perfil de Administrador o los permisos 'personal:leer', 'personal:gestionar' o 'personal:crear' para consultar el directorio de personal."
  );
}

/**
 * HU-20 - Valida que el usuario tenga rol de Administrador o el permiso
 * 'misiones:asignar' para asignar misiones operativas a cuadrillas y patrullas.
 */
export async function verificarAsignarMision(
  request: NextRequest
): Promise<UsuarioAutenticado> {
  const usuarioId = await extraerUsuarioId(request);
  return await seguridadService.validarAccesoRoles(
    usuarioId,
    [PERMISO_ASIGNAR_MISION],
    "Acceso denegado. Se requiere el perfil de Administrador o el permiso 'misiones:asignar' para despachar misiones operativas."
  );
}
