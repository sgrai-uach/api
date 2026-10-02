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
  actualizado_por_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export type EstadoOperativoPersonal =
  | "disponible"
  | "en_mision"
  | "en_patrulla"
  | "descanso"
  | "licencia"
  | "inactivo";

export interface DelegacionTable {
  id: Generated<string>;
  codigo?: string;
  codigo_delegacion?: string;
  nombre: string;
  nombre_delegacion?: string;
  direccion?: string | null;
  descripcion?: string | null;
  activo?: ColumnType<boolean, boolean | undefined, boolean>;
  creado_en?: Generated<Date>;
  actualizado_en?: Generated<Date>;
  created_at?: Generated<Date>;
  updated_at?: Generated<Date>;
}

export interface RolTable {
  id: Generated<string>;
  codigo?: string;
  nombre: string;
  descripcion: string | null;
  activo: ColumnType<boolean, boolean | undefined, boolean>;
  es_sistema: ColumnType<boolean, boolean | undefined, boolean>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
  created_at?: Generated<Date>;
  updated_at?: Generated<Date>;
}

export interface PermisoTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  modulo: string;
  creado_en: Generated<Date>;
  created_at?: Generated<Date>;
}

export interface RolPermisoTable {
  rol_id: string;
  permiso_id: string;
  asignado_por_id: string | null;
  asignado_en: Generated<Date>;
  created_at?: Generated<Date>;
}

export interface UsuarioTable {
  id: Generated<string>;
  rut: string;
  nombre: string;
  nombres?: string;
  apellidos?: string;
  email: string;
  telefono?: string | null;
  password_hash?: string;
  rol_id: string;
  delegacion_id?: string | null;
  activo: ColumnType<boolean, boolean | undefined, boolean>;
  ultimo_acceso?: Date | null;
  fecha_ingreso?: string | null;
  fecha_salida?: string | null;
  creado_en: Generated<Date>;
  actualizado_en?: Generated<Date>;
  created_at?: Generated<Date>;
  updated_at?: Generated<Date>;
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
  disponible_terreno: ColumnType<boolean, boolean | undefined, boolean>;
  ultima_ubicacion?: string | null;
  ultima_actualizacion_ubicacion?: Date | null;
  observaciones?: string | null;
  created_at?: Generated<Date>;
  updated_at?: Generated<Date>;
}

export interface LogCambiosUsuariosTable {
  id: Generated<string>;
  usuario_modificado_id: string;
  modificado_por_id: string | null;
  campos_modificados: string;
  created_at: Generated<Date>;
}

export type EstadoIncidente =
  | "REPORTADO"
  | "VERIFICANDO"
  | "EN_ATENCION"
  | "NO_ABORDABLE"
  | "RESUELTO"
  | "Reportado"
  | "Verificando"
  | "En Atención"
  | "No Abordable"
  | "Resuelto";

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
  codigo: ColumnType<string, string | undefined, string>;
  codigo_seguimiento: ColumnType<string, string | undefined, string>;
  folio: ColumnType<string, string | undefined, string>;
  informante_id: string | null;
  tipo_incidente_id?: string | null;
  delegacion_id?: string | null;
  fuente_incidente_id?: string | null;
  tipo_afectacion: ColumnType<string, string | undefined, string>;
  descripcion: string | null;
  direccion_texto: ColumnType<string, string | undefined, string>;
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
  aviso_id?: string | null;
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
  origen_reporte: ColumnType<
    "WEB" | "CHATBOT" | "TELEFONO",
    "WEB" | "CHATBOT" | "TELEFONO" | string | undefined,
    "WEB" | "CHATBOT" | "TELEFONO"
  >;
  estado: ColumnType<
    "PENDIENTE_VERIFICACION" | "NO_VERIFICADO" | "VERIFICADO" | "DESCARTADO",
    "PENDIENTE_VERIFICACION" | "NO_VERIFICADO" | "VERIFICADO" | "DESCARTADO" | string | undefined,
    "PENDIENTE_VERIFICACION" | "NO_VERIFICADO" | "VERIFICADO" | "DESCARTADO"
  >;
  es_duplicado: ColumnType<boolean, boolean | undefined, boolean>;
  aviso_original_id: string | null;
  motivo_descarte: string | null;
  operador_id: string | null;
  incidente_id: string | null;
  delegacion_id?: string | null;
  delegacion_manual?: string | null;
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
  reporte_terreno_id?: string | null;
  creado_en: Generated<Date>;
}

export interface ReporteTerrenoTable {
  id: Generated<string>;
  mision_id: string;
  evaluador_id: string;
  resumen_tecnico: string;
  acciones_realizadas: string | null;
  requiere_apoyo_adicional: ColumnType<boolean, boolean | undefined, boolean>;
  danos_estimados: string | null;
  observaciones: string | null;
  personas_afectadas: ColumnType<number, number | undefined, number>;
  estado_terreno: ColumnType<string, string | undefined, string>;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface Database {
  // Entidades principales (nombres singulares de Kysely)
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
  reporte_terreno: ReporteTerrenoTable;
  personal: PersonalTable;
  log_cambios_usuarios: LogCambiosUsuariosTable;

  // Aliases plurales para compatibilidad transversal con servicios de H12 y consultas directas
  recursos: RecursoTable;
  permisos: PermisoTable;
  roles: RolTable;
  rol_permisos: RolPermisoTable;
  usuarios: UsuarioTable;
  informantes: InformanteTable;
  incidentes: IncidenteTable;
  delegaciones: DelegacionTable;
  tipos_incidentes: TipoIncidenteTable;
  misiones: MisionTable;
  avisos_incidentes: AvisoIncidenteTable;
  adjuntos: AdjuntoTable;
  reportes_terreno: ReporteTerrenoTable;
}
