import type { Generated, ColumnType } from "kysely";

export type EstadoRecurso =
  | "DISPONIBLE"
  | "ASIGNADO"
  | "EN_MANTENCION"
  | "BAJO_STOCK"
  | "NO_DISPONIBLE";

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
  delegacion_id?: string | null;
  creado_por_id: string;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface PermisoTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  modulo?: string;
  creado_en: Generated<Date>;
}

export interface RolTable {
  id: Generated<string>;
  nombre: string;
  descripcion: string | null;
  activo?: ColumnType<boolean, boolean | undefined, boolean>;
  es_sistema?: ColumnType<boolean, boolean | undefined, boolean>;
  creado_en: Generated<Date>;
  actualizado_en?: Generated<Date>;
}

export interface RolPermisoTable {
  rol_id: string;
  permiso_id: string;
  asignado_por_id?: string | null;
  asignado_en?: Generated<Date>;
}

export interface UsuarioTable {
  id: Generated<string>;
  rut: string;
  nombre: string;
  email: string;
  rol_id: string;
  activo?: ColumnType<boolean, boolean | undefined, boolean>;
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

export type OrigenReporte =
  | "CHATBOT"
  | "LLAMADA_TELEFONICA"
  | "FUNCIONARIO_TERRENO"
  | "WEB"
  | "TELEFONO";

export interface InformanteTable {
  id: Generated<string>;
  rut: string | null;
  nombre: string | null;
  telefono: string | null;
  creado_en: Generated<Date>;
}

export interface DelegacionTable {
  id: Generated<string>;
  nombre: string;
  codigo_delegacion?: string;
  nombre_delegacion?: string;
  descripcion: string | null;
  activo?: ColumnType<boolean, boolean | undefined, boolean>;
  creado_en: Generated<Date>;
  actualizado_en?: Generated<Date>;
}

export interface TipoIncidenteTable {
  id: Generated<string>;
  nombre: string;
  descripcion: string | null;
  activo: ColumnType<boolean, boolean | undefined, boolean>;
  creado_en: Generated<Date>;
}

export interface FuenteIncidenteTable {
  id: Generated<string>;
  nombre: string;
  descripcion: string | null;
  creado_en: Generated<Date>;
}

export interface PrevencionTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  delegacion_id: string | null;
  activo: ColumnType<boolean, boolean | undefined, boolean>;
  creado_en: Generated<Date>;
}

export type EstadoPatrulla = "DISPONIBLE" | "EN_VERIFICACION" | "NO_DISPONIBLE";

export interface PatrullaVerificadoraTable {
  id: Generated<string>;
  nombre: string;
  estado: ColumnType<EstadoPatrulla, EstadoPatrulla | undefined, EstadoPatrulla>;
  delegacion_id: string | null;
  usuario_lider_id: string | null;
  creado_en: Generated<Date>;
}

export type EstadoCuadrilla = "DISPONIBLE" | "EN_MISION" | "NO_DISPONIBLE";

export interface CuadrillaTable {
  id: Generated<string>;
  nombre: string;
  estado: ColumnType<EstadoCuadrilla, EstadoCuadrilla | undefined, EstadoCuadrilla>;
  delegacion_id: string | null;
  usuario_delegado_id: string | null;
  creado_en: Generated<Date>;
}

export interface CuadrillaRecursoTable {
  id: Generated<string>;
  cuadrilla_id: string;
  recurso_id: string;
  cantidad_asignada: number;
  asignado_en: Generated<Date>;
}

export type TipoMision =
  | "VERIFICACION"
  | "ATENCION_CUADRILLA"
  | "PREVENCION"
  | "RECUPERACION"
  | "ASISTENCIA_SOCIAL";

export type EstadoMision =
  | "PLANIFICADA"
  | "DESPACHADA"
  | "EN_CURSO"
  | "COMPLETADA"
  | "CANCELADA"
  | "RECHAZADA";

export interface MisionTable {
  id: Generated<string>;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  tipo_mision: TipoMision;
  estado: ColumnType<EstadoMision, EstadoMision | undefined, EstadoMision>;
  prioridad: ColumnType<PrioridadIncidente, PrioridadIncidente | undefined, PrioridadIncidente>;
  justificacion_rechazo: string | null;
  incidente_id: string | null;
  prevencion_id: string | null;
  cuadrilla_id: string | null;
  patrulla_id: string | null;
  encargado_id: string | null;
  creado_por_id: string;
  fecha_inicio: Date | null;
  fecha_cierre: Date | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface IncidenteTable {
  id: Generated<string>;
  codigo: string;
  codigo_seguimiento: string;
  folio?: string;
  informante_id: string | null;
  tipo_incidente_id?: string | null;
  delegacion_id?: string | null;
  fuente_incidente_id?: string | null;
  tipo_afectacion: string;
  descripcion: string | null;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  estado: ColumnType<EstadoIncidente, EstadoIncidente | undefined, EstadoIncidente>;
  prioridad: ColumnType<PrioridadIncidente, PrioridadIncidente | undefined, PrioridadIncidente>;
  requiere_asistencia_social: ColumnType<boolean, boolean | undefined, boolean>;
  fuente_origen: ColumnType<OrigenReporte | string, OrigenReporte | string | undefined, OrigenReporte | string>;
  asterisk_call_id: string | null;
  asterisk_caller_phone: string | null;
  creado_por_id: string | null;
  operador_id?: string | null;
  encargado_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

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
  origen_reporte: ColumnType<string, string | undefined, string>;
  estado: ColumnType<string, string | undefined, string>;
  es_duplicado: ColumnType<boolean, boolean | undefined, boolean>;
  aviso_original_id: string | null;
  motivo_descarte?: string | null;
  operador_id?: string | null;
  incidente_id?: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

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

export interface Database {
  recurso: RecursoTable;
  permiso: PermisoTable;
  rol: RolTable;
  rol_permiso: RolPermisoTable;
  usuario: UsuarioTable;
  informante: InformanteTable;
  incidente: IncidenteTable;
  delegacion: DelegacionTable;
  tipo_incidente: TipoIncidenteTable;
  fuente_incidente: FuenteIncidenteTable;
  prevencion: PrevencionTable;
  patrulla_verificadora: PatrullaVerificadoraTable;
  cuadrilla: CuadrillaTable;
  cuadrilla_recurso: CuadrillaRecursoTable;
  mision: MisionTable;
  aviso_incidente: AvisoIncidenteTable;
  adjunto: AdjuntoTable;
}
