import { Generated, ColumnType } from "kysely";

export type EstadoOperativoPersonal =
  | "disponible"
  | "en_mision"
  | "en_patrulla"
  | "descanso"
  | "licencia"
  | "inactivo";

export interface DelegacionTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  direccion: string | null;
  activo: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface RolTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PermisoTable {
  id: Generated<string>;
  codigo: string;
  modulo: string;
  descripcion: string;
  created_at: Generated<Date>;
}

export interface RolPermisoTable {
  rol_id: string;
  permiso_id: string;
  created_at: Generated<Date>;
}

export interface UsuarioTable {
  id: Generated<string>;
  rut: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  password_hash: string;
  rol_id: string;
  delegacion_id: string | null;
  activo: Generated<boolean>;
  ultimo_acceso: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface PersonalTable {
  id: Generated<string>;
  usuario_id: string;
  delegacion_id: string;
  especialidad: string | null;
  cargo: string | null;
  estado_operativo: ColumnType<
    EstadoOperativoPersonal,
    EstadoOperativoPersonal | undefined,
    EstadoOperativoPersonal
  >;
  disponible_terreno: Generated<boolean>;
  ultima_ubicacion: string | null; // PostGIS Point (WKT / GeoJSON)
  ultima_actualizacion_ubicacion: Date | null;
  observaciones: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface Database {
  delegaciones: DelegacionTable;
  roles: RolTable;
  permisos: PermisoTable;
  rol_permisos: RolPermisoTable;
  usuarios: UsuarioTable;
  personal: PersonalTable;
}
