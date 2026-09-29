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

/**
 * Tabla tipo_incidente: Catálogo de tipologías de incidentes.
 */
export interface TipoIncidenteTable {
  id: Generated<string>;
  nombre: string;
  descripcion: string | null;
  activo: Generated<boolean>;
  creado_en: Generated<Date>;
}

/**
 * Tabla aviso_incidente: Bandeja de entrada de reportes generados por informantes.
 */
export interface AvisoIncidenteTable {
  id: Generated<string>;
  codigo_seguimiento: string;
  tipo_afectacion: string;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  ubicacion: unknown;
  descripcion: string | null;
  informante_nombre: string;
  informante_rut: string;
  informante_telefono: string | null;
  origen_reporte: Generated<"WEB" | "CHATBOT" | "TELEFONO">;
  estado: Generated<"PENDIENTE_VERIFICACION" | "VERIFICADO" | "DESCARTADO">;
  es_duplicado: Generated<boolean>;
  aviso_original_id: string | null;
  motivo_descarte: string | null;
  operador_id: string | null;
  incidente_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

/**
 * Tabla incidente: Registro formal del Sistema de Comando de Incidentes (ICS).
 */
export interface IncidenteTable {
  id: Generated<string>;
  folio: string;
  tipo_incidente_id: string;
  estado: "Reportado" | "Verificando" | "En Atención" | "No Abordable" | "Resuelto";
  descripcion: string;
  latitud: number;
  longitud: number;
  ubicacion: unknown | null;
  requiere_asistencia_social: Generated<boolean>;
  aviso_id: string | null;
  creado_por_id: string;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

/**
 * Tabla adjunto: Multimedia o evidencia fotográfica asociada a avisos o incidentes.
 */
export interface AdjuntoTable {
  id: Generated<string>;
  nombre_archivo: string;
  url: string;
  tipo_mime: string;
  tamano_bytes: number;
  aviso_id: string | null;
  incidente_id: string | null;
  creado_en: Generated<Date>;
}

/**
 * Tabla permiso: Catálogo de capacidades operativas y permisos.
 */
export interface PermisoTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  modulo: string;
  creado_en: Generated<Date>;
}

/**
 * Tabla rol: Catálogo de perfiles con flags de sistema y actividad.
 */
export interface RolTable {
  id: Generated<string>;
  nombre: string;
  descripcion: string | null;
  activo: Generated<boolean>;
  es_sistema: Generated<boolean>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

/**
 * Tabla usuario: Operadores y usuarios con rol institucional.
 */
export interface UsuarioTable {
  id: Generated<string>;
  rut: string;
  nombre: string;
  email: string;
  rol_id: string;
  activo: Generated<boolean>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

/**
 * Tabla rol_permiso: Relación N:N con auditoría y trazabilidad.
 */
export interface RolPermisoTable {
  rol_id: string;
  permiso_id: string;
  asignado_en: Generated<Date>;
  asignado_por_id: string | null;
}

/**
 * Interfaz unificada de la base de datos relacional para Kysely.
 */
export interface Database {
  recurso: RecursoTable;
  tipo_incidente: TipoIncidenteTable;
  aviso_incidente: AvisoIncidenteTable;
  incidente: IncidenteTable;
  adjunto: AdjuntoTable;
  permiso: PermisoTable;
  rol: RolTable;
  usuario: UsuarioTable;
  rol_permiso: RolPermisoTable;
}
