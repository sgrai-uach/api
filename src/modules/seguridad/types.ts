import type {
  ActualizarPermisosRolInput,
  ActualizarPermisosRolResponse,
  ListarPermisosResponse,
  ListarRolesResponse,
  LoginData,
  LoginRequest,
  LoginResponse,
  PermisoAsignado,
  PermisoCatalogoItem,
  RolDetalleResponse,
  RolItem,
  UsuarioPerfilSesion,
} from "./schema";

export type PermisoAsignadoDTO = PermisoAsignado;
export type RolItemDTO = RolItem;
export type ListarRolesResponseDTO = ListarRolesResponse;
export type RolDetalleResponseDTO = RolDetalleResponse;
export type PermisoCatalogoItemDTO = PermisoCatalogoItem;
export type ListarPermisosResponseDTO = ListarPermisosResponse;
export type ActualizarPermisosRolInputDTO = ActualizarPermisosRolInput;
export type ActualizarPermisosRolResponseDTO = ActualizarPermisosRolResponse;
export type LoginRequestDTO = LoginRequest;
export type LoginResponseDTO = LoginResponse;
export type LoginDataDTO = LoginData;
export type UsuarioPerfilSesionDTO = UsuarioPerfilSesion;

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

export interface UsuarioActivoDTO {
  id: string;
  rut: string;
  nombre: string;
  email: string;
  activo: boolean;
  delegacionId?: string | null;
  rol: {
    id: string;
    nombre: string;
    codigo: string;
    esAdmin: boolean;
  };
  permisos: string[];
}

export interface UsuarioLoginRaw {
  id: string;
  rut: string;
  nombre: string;
  email: string;
  password_hash: string;
  activo: boolean;
  intentos_fallidos: number;
  bloqueado_hasta: Date | null;
  delegacion_id: string | null;
  rol_id: string;
  rol_nombre: string;
  rol_codigo: string;
}
