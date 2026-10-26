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
  eliminado_por_id: string | null;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
  eliminado_en: Date | null;
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
  nombre: Generated<string>;
  nombres?: string;
  apellidos?: string;
  email: string;
  telefono?: string | null;
  password_hash?: string;
  rol_id: string;
  delegacion_id?: string | null;
  activo: ColumnType<boolean, boolean | undefined, boolean>;
  intentos_fallidos?: ColumnType<number, number | undefined, number>;
  bloqueado_hasta?: Date | null;
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

export interface TokenRecuperacionContrasenaTable {
  id: Generated<string>;
  usuario_id: string;
  token_hash: string;
  expira_en: Date;
  usado_en?: Date | null;
  creado_en: Generated<Date>;
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
  | "WEB";

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
  tipo_riesgo: ColumnType<string | null, string | null | undefined, string | null>;
  prioridad: ColumnType<
    PrioridadIncidente,
    PrioridadIncidente | undefined,
    PrioridadIncidente
  >;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  delegacion_id: string | null;
  activo: ColumnType<boolean, boolean | undefined, boolean>;
  creado_en: Generated<Date>;
  creado_por_id?: string | null;
  actualizado_en?: ColumnType<Date | null, Date | null | undefined, Date | null>;
  actualizado_por_id?: string | null;
  eliminado_en?: Date | null;
  eliminado_por_id?: string | null;
}

export type EstadoPatrulla =
  | "DISPONIBLE"
  | "EN_VERIFICACION"
  | "EN_PREVENCION"
  | "EN_RECUPERACION"
  | "EN_MISION"
  | "NO_DISPONIBLE";

export type EstadoRecuperacion =
  | "PLANIFICADA"
  | "EN_EJECUCION"
  | "COMPLETADA"
  | "CANCELADA";

export interface RecuperacionTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  sector: string;
  direccion_texto: string | null;
  prioridad: ColumnType<
    PrioridadIncidente,
    PrioridadIncidente | undefined,
    PrioridadIncidente
  >;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  estado: ColumnType<
    EstadoRecuperacion,
    EstadoRecuperacion | undefined,
    EstadoRecuperacion
  >;
  familias_afectadas: ColumnType<number, number | undefined, number>;
  delegacion_id: string | null;
  creado_por_id: string;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface RecuperacionRecursoTable {
  id: Generated<string>;
  recuperacion_id: string;
  recurso_id: string;
  cantidad_asignada: number;
  creado_en: Generated<Date>;
}

export type EstadoEventoAsistenciaSocial =
  | "PENDIENTE"
  | "ASIGNADO"
  | "EN_EVALUACION_FIBE"
  | "FINALIZADO"
  | "DESCARTADO";

export interface EventoAsistenciaSocialTable {
  id: Generated<string>;
  codigo: string;
  descripcion: string;
  tipo_afectacion: string;
  personas_afectadas: ColumnType<number, number | undefined, number>;
  familias_afectadas: ColumnType<number, number | undefined, number>;
  direccion_texto: string;
  latitud: number;
  longitud: number;
  ubicacion: ColumnType<unknown, unknown, unknown>;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_rut: string | null;
  prioridad: ColumnType<
    PrioridadIncidente,
    PrioridadIncidente | undefined,
    PrioridadIncidente
  >;
  estado: ColumnType<
    EstadoEventoAsistenciaSocial,
    EstadoEventoAsistenciaSocial | undefined,
    EstadoEventoAsistenciaSocial
  >;
  incidente_id: string | null;
  delegacion_id: string | null;
  asistente_social_id: string | null;
  creado_por_id: string;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
  eliminado_en: Date | null;
  eliminado_por_id: string | null;
}

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
  evento_prevencion_id?: string | null;
  recuperacion_id?: string | null;
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
    "WEB" | "CHATBOT" | "LLAMADA_TELEFONICA",
    "WEB" | "CHATBOT" | "LLAMADA_TELEFONICA" | string | undefined,
    "WEB" | "CHATBOT" | "LLAMADA_TELEFONICA"
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

export interface EventoPrevencionTable {
  id: Generated<string>;
  codigo: string;
  nombre: string;
  descripcion: string;
  prioridad: ColumnType<PrioridadIncidente, PrioridadIncidente | undefined, PrioridadIncidente>;
  estado: ColumnType<string, string | undefined, string>;
  sector: string | null;
  direccion_texto: string | null;
  punto_critico_id: string | null;
  delegacion_id: string;
  latitud: ColumnType<number, number | string, number | string>;
  longitud: ColumnType<number, number | string, number | string>;
  ubicacion: unknown;
  creado_por_id: string;
  creado_en: Generated<Date>;
  actualizado_en: Generated<Date>;
}

export interface EventoPrevencionRecursoTable {
  id: Generated<string>;
  evento_prevencion_id: string;
  recurso_id: string;
  cantidad_asignada: number;
  creado_en: Generated<Date>;
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
  recuperacion: RecuperacionTable;
  recuperacion_recurso: RecuperacionRecursoTable;
  evento_asistencia_social: EventoAsistenciaSocialTable;
  patrulla_verificadora: PatrullaVerificadoraTable;
  cuadrilla: CuadrillaTable;
  cuadrilla_recurso: CuadrillaRecursoTable;
  mision: MisionTable;
  aviso_incidente: AvisoIncidenteTable;
  adjunto: AdjuntoTable;
  reporte_terreno: ReporteTerrenoTable;
  personal: PersonalTable;
  log_cambios_usuarios: LogCambiosUsuariosTable;
  evento_prevencion: EventoPrevencionTable;
  evento_prevencion_recurso: EventoPrevencionRecursoTable;
  token_recuperacion_contrasena: TokenRecuperacionContrasenaTable;

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
  recuperaciones: RecuperacionTable;
  recuperacion_recursos: RecuperacionRecursoTable;
  eventos_asistencia_social: EventoAsistenciaSocialTable;
  avisos_incidentes: AvisoIncidenteTable;
  adjuntos: AdjuntoTable;
  reportes_terreno: ReporteTerrenoTable;
  eventos_prevencion: EventoPrevencionTable;
  eventos_prevencion_recursos: EventoPrevencionRecursoTable;
  tokens_recuperacion_contrasena: TokenRecuperacionContrasenaTable;
}
