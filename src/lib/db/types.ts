import type { Generated } from "kysely";

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
 * Interfaz unificada de la base de datos relacional para Kysely.
 */
export interface Database {
  tipo_incidente: TipoIncidenteTable;
  aviso_incidente: AvisoIncidenteTable;
  incidente: IncidenteTable;
  adjunto: AdjuntoTable;
}
