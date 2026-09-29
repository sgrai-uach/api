import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "./auth.errors";

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  rol: string;
}

export async function verificarPermiso(
  usuarioId: string | null | undefined,
  permisoRequerido: string
): Promise<UsuarioAutenticado> {
  if (!usuarioId || usuarioId.trim() === "") {
    throw new UnauthorizedError("Se requiere cabecera de autenticación X-User-Id.");
  }

  const usuario = await db
    .selectFrom("usuario")
    .innerJoin("rol", "rol.id", "usuario.rol_id")
    .select(["usuario.id", "usuario.nombre", "rol.nombre as rol_nombre", "rol.id as rol_id"])
    .where("usuario.id", "=", usuarioId)
    .executeTakeFirst();

  if (!usuario) {
    throw new UnauthorizedError(`Usuario con ID '${usuarioId}' no existe o no está autorizado.`);
  }

  const permisos = await db
    .selectFrom("rol_permiso")
    .innerJoin("permiso", "permiso.id", "rol_permiso.permiso_id")
    .select("permiso.codigo")
    .where("rol_permiso.rol_id", "=", usuario.rol_id)
    .execute();

  const tienePermiso = permisos.some((p) => p.codigo === permisoRequerido);
  if (!tienePermiso) {
    throw new ForbiddenError(`No cuenta con el permiso requerido: ${permisoRequerido}`);
  }

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol_nombre,
  };
}
