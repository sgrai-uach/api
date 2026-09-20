import type { Generated, ColumnType } from "kysely";

export type EstadoRecurso = "DISPONIBLE" | "NO_DISPONIBLE" | "BAJO_STOCK";

export interface RecursoTable {
  id: Generated<string>;
  nombre: string;
  es_individual: boolean;
  estado: EstadoRecurso;
  cantidad_inventario: number;
  cantidad_en_uso: ColumnType<number, number | undefined, number>;
  cantidad_minima: ColumnType<number, number | undefined, number>;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  descripcion: string | null;
  detalles: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, Record<string, unknown>>;
  creado_por_id: string;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface PermisoTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  creado_en: Generated<Date>;
}

export interface RolTable {
  id: Generated<string>;
  nombre: string;
  descripcion: string | null;
  creado_en: Generated<Date>;
}

export interface RolPermisoTable {
  rol_id: string;
  permiso_id: string;
}

export interface UsuarioTable {
  id: Generated<string>;
  rut: string;
  nombre: string;
  email: string;
  rol_id: string;
  creado_en: Generated<Date>;
}

export type EstadoIncidente =
  | "REPORTADO"
  | "VERIFICANDO"
  | "EN_ATENCION"
  | "NO_ABORDABLE"
  | "RESUELTO";

// Alias de retrocompatibilidad
export type EstadoAvisoIncidente = EstadoIncidente;

export type PrioridadIncidente = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

export interface InformanteTable {
  id: Generated<string>;
  rut: string;
  nombre: string;
  telefono: string | null;
  creado_en: Generated<Date>;
}

export interface IncidenteTable {
  id: Generated<string>;
  codigo: string;
  codigo_seguimiento: string;
  informante_id: string | null;
  tipo_afectacion: string;
  descripcion: string | null;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  estado: ColumnType<EstadoIncidente, EstadoIncidente | undefined, EstadoIncidente>;
  prioridad: ColumnType<PrioridadIncidente, PrioridadIncidente | undefined, PrioridadIncidente>;
  requiere_asistencia_social: ColumnType<boolean, boolean | undefined, boolean>;
  fuente_origen: ColumnType<string, string | undefined, string>;
  asterisk_call_id: string | null;
  asterisk_caller_phone: string | null;
  creado_por_id: string | null;
  encargado_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface Database {
  recurso: RecursoTable;
  permiso: PermisoTable;
  rol: RolTable;
  rol_permiso: RolPermisoTable;
  usuario: UsuarioTable;
  informante: InformanteTable;
  incidente: IncidenteTable;
}

