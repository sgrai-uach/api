import type {
  ListarRolesResponse,
  PermisoAsignado,
  RolDetalleResponse,
  RolItem,
} from "./schema";

export type PermisoAsignadoDTO = PermisoAsignado;
export type RolItemDTO = RolItem;
export type ListarRolesResponseDTO = ListarRolesResponse;
export type RolDetalleResponseDTO = RolDetalleResponse;

export interface UsuarioAutenticado {
  id: string;
  rut: string;
  nombre: string;
  email: string;
  rolId: string;
  rolNombre: string;
  activo: boolean;
}

export interface RolConPermisoRaw {
  rol_id: string;
  rol_nombre: string;
  rol_descripcion: string | null;
  rol_activo: boolean;
  rol_es_sistema: boolean;
  rol_creado_en: Date;
  rol_actualizado_en: Date;
  permiso_id: string | null;
  permiso_codigo: string | null;
  permiso_nombre: string | null;
  permiso_descripcion: string | null;
  permiso_modulo: string | null;
  permiso_asignado_en: Date | null;
  permiso_asignado_por_id: string | null;
}
