import { z } from "zod";
import { db } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "./auth.errors";

export interface UsuarioAutenticado {
  id: string;
  nombre: string;
  rol: string;
}

export interface UsuarioAutenticadoConPermisos extends UsuarioAutenticado {
  permisos: string[];
}

async function obtenerUsuarioActivoYPermisos(
  usuarioId: string | null | undefined
): Promise<{
  id: string;
  nombre: string;
  rol: string;
  esAdmin: boolean;
  permisos: string[];
}> {
  if (!usuarioId || usuarioId.trim() === "") {
    throw new UnauthorizedError("Se requiere cabecera de autenticación Authorization: Bearer <token>.");
  }

  if (!z.string().uuid().safeParse(usuarioId.trim()).success) {
    throw new UnauthorizedError(`Usuario con ID '${usuarioId}' no existe o no está autorizado.`);
  }

  const usuario = await db
    .selectFrom("usuario")
    .innerJoin("rol", "rol.id", "usuario.rol_id")
    .select(["usuario.id", "usuario.nombre", "usuario.activo", "rol.nombre as rol_nombre", "rol.id as rol_id"])
    .where("usuario.id", "=", usuarioId)
    .executeTakeFirst();

  if (!usuario) {
    throw new UnauthorizedError(`Usuario con ID '${usuarioId}' no existe o no está autorizado.`);
  }

  if (!usuario.activo) {
    throw new UnauthorizedError("El usuario especificado se encuentra inactivo en la institución.");
  }

  const esAdmin =
    usuario.rol_nombre === "Administrador" ||
    usuario.rol_id === "20000000-0000-4000-8000-000000000001";

  if (esAdmin) {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol_nombre,
      esAdmin: true,
      permisos: [],
    };
  }

  const permisos = await db
    .selectFrom("rol_permiso")
    .innerJoin("permiso", "permiso.id", "rol_permiso.permiso_id")
    .select("permiso.codigo")
    .where("rol_permiso.rol_id", "=", usuario.rol_id)
    .execute();

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol_nombre,
    esAdmin: false,
    permisos: permisos.map((p) => p.codigo),
  };
}

export async function verificarPermiso(
  usuarioId: string | null | undefined,
  permisoRequerido: string
): Promise<UsuarioAutenticado> {
  const usuario = await obtenerUsuarioActivoYPermisos(usuarioId);

  if (!usuario.esAdmin && !usuario.permisos.includes(permisoRequerido)) {
    throw new ForbiddenError(`No cuenta con el permiso requerido: ${permisoRequerido}`);
  }

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol,
  };
}

export async function verificarAlgunPermiso(
  usuarioId: string | null | undefined,
  permisosRequeridos: string[]
): Promise<UsuarioAutenticadoConPermisos> {
  const usuario = await obtenerUsuarioActivoYPermisos(usuarioId);

  if (usuario.esAdmin) {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      permisos: [...permisosRequeridos],
    };
  }

  const tieneAlguno = permisosRequeridos.some((p) => usuario.permisos.includes(p));
  if (!tieneAlguno) {
    throw new ForbiddenError(
      `No cuenta con ninguno de los permisos requeridos: ${permisosRequeridos.join(", ")}`
    );
  }

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    rol: usuario.rol,
    permisos: usuario.permisos,
  };
}
