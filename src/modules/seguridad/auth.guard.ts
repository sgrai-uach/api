import type { NextRequest } from "next/server";
import { seguridadService } from "./service";
import type { UsuarioAutenticado } from "./types";
import {
  PERMISO_LEER_ROLES,
  PERMISO_GESTIONAR_ROLES,
} from "./permisos.constants";

/**
 * Extrae la identificación del usuario de la petición HTTP.
 * Admite cabecera 'x-user-id' o 'authorization: Bearer <usuario_id>'.
 */
export function extraerUsuarioId(request: NextRequest): string | null {
  let usuarioId = request.headers.get("x-user-id");

  if (!usuarioId) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      usuarioId = authHeader.substring(7).trim();
    }
  }

  return usuarioId;
}

/**
 * Valida que el usuario tenga rol de Administrador o permisos de lectura/gestión de roles.
 */
export async function verificarAccesoRoles(
  request: NextRequest
): Promise<UsuarioAutenticado> {
  const usuarioId = extraerUsuarioId(request);
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
  const usuarioId = extraerUsuarioId(request);
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
