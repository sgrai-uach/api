import type { NextRequest } from "next/server";
import { seguridadService } from "./service";
import type { UsuarioAutenticado } from "./types";

/**
 * Extrae la identificación del usuario de la petición HTTP y valida que posea rol de Administrador.
 * Admite cabecera 'x-user-id' o 'authorization: Bearer <usuario_id>'.
 */
export async function verificarAdministrador(
  request: NextRequest
): Promise<UsuarioAutenticado> {
  let usuarioId = request.headers.get("x-user-id");

  if (!usuarioId) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      usuarioId = authHeader.substring(7).trim();
    }
  }

  return await seguridadService.validarAccesoAdministrador(usuarioId);
}
