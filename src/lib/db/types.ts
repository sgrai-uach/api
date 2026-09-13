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

export type EstadoAvisoIncidente =
  | "PENDIENTE_VERIFICACION"
  | "VERIFICANDO"
  | "EN_ATENCION"
  | "RESUELTO"
  | "DESCARTADO";

export type OrigenReporte = "LLAMADA_TELEFONICA" | "FUNCIONARIO_TERRENO" | "CHATBOT";

export interface AvisoIncidenteTable {
  id: Generated<string>;
  codigo_seguimiento: string;
  tipo_afectacion: string;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  descripcion: string | null;
  informante_nombre: string;
  informante_rut: string;
  informante_telefono: string | null;
  origen_reporte: ColumnType<OrigenReporte, OrigenReporte | undefined, OrigenReporte>;
  asterisk_call_id: string | null;
  asterisk_caller_phone: string | null;
  operador_id: string | null;
  estado: ColumnType<EstadoAvisoIncidente, EstadoAvisoIncidente | undefined, EstadoAvisoIncidente>;
  es_duplicado: ColumnType<boolean, boolean | undefined, boolean>;
  aviso_original_id: string | null;
  incidente_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export type EstadoIncidente =
  | "SIN_ATENDER"
  | "ASIGNADO"
  | "EN_TERRENO"
  | "RESUELTO"
  | "DESCARTADO";

export type PrioridadIncidente = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";

export interface IncidenteTable {
  id: Generated<string>;
  codigo: string;
  tipo_afectacion: string;
  descripcion: string;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  estado: ColumnType<EstadoIncidente, EstadoIncidente | undefined, EstadoIncidente>;
  prioridad: ColumnType<PrioridadIncidente, PrioridadIncidente | undefined, PrioridadIncidente>;
  requiere_asistencia_social: ColumnType<boolean, boolean | undefined, boolean>;
  aviso_origen_id: string;
  creado_por_id: string;
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
  aviso_incidente: AvisoIncidenteTable;
  incidente: IncidenteTable;
}
