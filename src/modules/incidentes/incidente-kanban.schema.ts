import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
} from "@/lib/shared/pagination.schema";

extendZodWithOpenApi(z);

export const EstadoIncidenteEnum = z.enum([
  "REPORTADO",
  "VERIFICANDO",
  "EN_ATENCION",
  "NO_ABORDABLE",
  "RESUELTO",
]);

export const PrioridadIncidenteEnum = z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]);

export const FuenteOrigenIncidenteEnum = z.enum([
  "CHATBOT",
  "LLAMADA_TELEFONICA",
  "FUNCIONARIO_TERRENO",
  "WEB",
]);

// 1. Esquema de validación para parámetros de consulta (Query Params)
export const ListarIncidentesQuerySchema = PaginationQuerySchema.extend({
  estado: EstadoIncidenteEnum.optional().openapi({
    description: "Filtrar por columna/estado específico del Kanban",
    example: "REPORTADO",
  }),
  prioridad: PrioridadIncidenteEnum.optional().openapi({
    description: "Filtrar por nivel de prioridad",
    example: "ALTA",
  }),
  tipoAfectacion: z.string().optional().openapi({
    description: "Filtrar por tipo de afectación o emergencia",
    example: "Inundación",
  }),
  busqueda: z.string().optional().openapi({
    description: "Búsqueda textual sobre código, dirección o descripción del incidente",
    example: "Picarte",
  }),
  delegacionId: z
    .string()
    .uuid("El identificador de delegación debe ser un UUID válido")
    .optional()
    .openapi({
      description: "Filtrar por UUID de delegación territorial",
      example: "30000000-0000-4000-8000-000000000001",
    }),
  fuenteOrigen: FuenteOrigenIncidenteEnum.optional().openapi({
    description: "Filtrar por canal de origen del reporte",
    example: "LLAMADA_TELEFONICA",
  }),
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "El formato de fecha debe ser YYYY-MM-DD")
    .optional()
    .openapi({
      description: "Filtrar incidentes por fecha específica (YYYY-MM-DD)",
      example: "2026-10-03",
    }),
  soloHoy: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .optional()
    .openapi({
      description: "Filtrar únicamente incidentes registrados en el día actual (zona horaria Chile)",
      example: true,
    }),
});

export type ListarIncidentesQuery = z.infer<typeof ListarIncidentesQuerySchema>;

// 2. Metadatos de Paginación
export const PaginacionMetaSchema = z.object({
  total: z.number().openapi({ description: "Total de registros coincidentes en la base de datos" }),
  pagina: z.number().openapi({ description: "Página actual retornada" }),
  limite: z.number().openapi({ description: "Límite de elementos por página solicitado" }),
  totalPaginas: z.number().openapi({ description: "Total de páginas disponibles" }),
  tieneSiguiente: z.boolean().openapi({ description: "Indica si existe una página posterior" }),
  tieneAnterior: z.boolean().openapi({ description: "Indica si existe una página previa" }),
});

export type PaginacionMeta = z.infer<typeof PaginacionMetaSchema>;

// 3. Resumen de Incidente para tarjetas del Tablero Kanban
export const IncidenteResumenSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID del incidente" }),
  codigo: z.string().openapi({ description: "Código interno del incidente (ej. INC-58291045)" }),
  codigoSeguimiento: z.string().openapi({ description: "Código numérico de 8 dígitos entregado al informante" }),
  tipoAfectacion: z.string().openapi({ description: "Tipo de afectación categorizado" }),
  descripcion: z.string().nullable().openapi({ description: "Descripción inicial o relato de la emergencia" }),
  direccion: z.string().openapi({ description: "Dirección o punto de referencia en Valdivia" }),
  latitud: z.number().openapi({ description: "Latitud geográfica en EPSG:4326" }),
  longitud: z.number().openapi({ description: "Longitud geográfica en EPSG:4326" }),
  estado: EstadoIncidenteEnum.openapi({ description: "Estado actual de atención (columna en Kanban)" }),
  prioridad: PrioridadIncidenteEnum.openapi({ description: "Nivel de severidad o urgencia" }),
  prioridadSugerida: PrioridadIncidenteEnum.nullable().optional().openapi({ description: "Prioridad sugerida preliminarmente por el sistema según evaluación de terreno (HU-38)" }),
  justificacionPrioridad: z.string().nullable().optional().openapi({ description: "Justificación técnica de la patrulla si modificó la prioridad sugerida (HU-38)" }),
  totalReportesTerreno: z.number().optional().openapi({ description: "Cantidad total de reportes de evaluación en terreno enviados al Centro de Mando" }),
  requiereAsistenciaSocial: z.boolean().openapi({ description: "Indica si se requiere derivación para ficha FIBE" }),
  fuenteOrigen: z.string().openapi({ description: "Fuente de origen del reporte (CHATBOT, LLAMADA, TERRENO, SENAPRED)" }),
  informanteNombre: z.string().nullable().openapi({ description: "Nombre de pila del ciudadano informante o null si anónimo" }),
  delegacionNombre: z.string().nullable().openapi({ description: "Nombre de la delegación territorial correspondiente" }),
  totalMisiones: z.number().openapi({ description: "Cantidad de misiones tácticas despachadas o generadas para este incidente" }),
  tieneMisionDespachada: z.boolean().optional().openapi({ description: "Indica si el incidente posee una misión en estado PLANIFICADA o DESPACHADA pendiente de confirmación en terreno" }),
  tieneMisionEnCurso: z.boolean().optional().openapi({ description: "Indica si el incidente posee una misión en estado EN_CURSO activa en terreno" }),
  verificado: z.boolean().default(false).openapi({ description: "Indica si la patrulla verificadora completó el diagnóstico técnico en terreno" }),
  reclasificadoEnTerreno: z.boolean().optional().openapi({ description: "Indica si el incidente fue verificado o reclasificado en terreno" }),
  justificacionReclasificacion: z.string().nullable().optional().openapi({ description: "Motivo o justificación técnica de la evaluación en terreno" }),
  creadoEn: z.string().openapi({ description: "Fecha y hora de registro en formato ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Última fecha y hora de actualización en formato ISO 8601" }),
});

export type IncidenteResumen = z.infer<typeof IncidenteResumenSchema>;

// Respuesta del listado paginado
export const ListarIncidentesResponseSchema = z.object({
  message: z.string().openapi({ example: "Listado de incidentes obtenido exitosamente" }),
  data: z.array(IncidenteResumenSchema),
  meta: PaginationMetaSchema,
  paginacion: PaginacionMetaSchema.optional().openapi({
    description: "Metadatos de paginación legados (retrocompatibilidad, usar 'meta')",
  }),
});

export type ListarIncidentesResponse = z.infer<typeof ListarIncidentesResponseSchema>;

// 4. Detalle de Misiones y Equipos Operativos
export const MisionDetalleSchema = z.object({
  id: z.string().uuid().openapi({ description: "UUID de la misión operativa" }),
  codigo: z.string().openapi({ description: "Código oficial de la misión (ej. MIS-2026-0001)" }),
  titulo: z.string().openapi({ description: "Título descriptivo de la misión" }),
  descripcion: z.string().nullable().openapi({ description: "Instrucciones de trabajo en terreno" }),
  tipoMision: z.string().openapi({ description: "Tipo de misión táctica" }),
  estado: z.string().openapi({ description: "Estado operativo de la misión" }),
  prioridad: z.string().openapi({ description: "Prioridad táctica de la misión" }),
  justificacionRechazo: z.string().nullable().openapi({ description: "Justificación en caso de rechazo por la cuadrilla" }),
  patrulla: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
      estado: z.string(),
    })
    .nullable()
    .openapi({ description: "Patrulla verificadora asignada" }),
  cuadrilla: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
      estado: z.string(),
    })
    .nullable()
    .openapi({ description: "Cuadrilla operativa asignada" }),
  fechaInicio: z.string().nullable().openapi({ description: "Fecha de inicio de trabajos en terreno" }),
  fechaCierre: z.string().nullable().openapi({ description: "Fecha de finalización o cierre" }),
  creadoEn: z.string().openapi({ description: "Fecha de despacho o creación" }),
});

export type MisionDetalle = z.infer<typeof MisionDetalleSchema>;

// 5. Recurso Asociado a través de Cuadrillas
export const RecursoAsociadoSchema = z.object({
  recursoId: z.string().uuid().openapi({ description: "UUID del recurso en el inventario logístico" }),
  nombre: z.string().openapi({ description: "Nombre del recurso (ej. Motobomba 4 pulgadas, Camioneta)" }),
  esIndividual: z.boolean().openapi({ description: "Indica si es maquinaria individual o insumo a granel" }),
  cantidadAsignadaTotal: z.number().openapi({ description: "Cantidad total asignada a cuadrillas en las misiones del incidente" }),
  estadoRecurso: z.string().openapi({ description: "Estado actual de inventario del recurso" }),
  cuadrillaNombre: z.string().nullable().openapi({ description: "Nombre de la cuadrilla que tiene asignado el recurso" }),
});

export type RecursoAsociado = z.infer<typeof RecursoAsociadoSchema>;

// 6. Detalle exhaustivo para el modal/panel lateral del Incidente
export const IncidenteDetalleSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  codigoSeguimiento: z.string(),
  tipoAfectacion: z.string(),
  descripcion: z.string().nullable(),
  direccion: z.string(),
  latitud: z.number(),
  longitud: z.number(),
  estado: EstadoIncidenteEnum,
  prioridad: PrioridadIncidenteEnum,
  prioridadSugerida: PrioridadIncidenteEnum.nullable().optional().openapi({
    description: "Prioridad sugerida calculada por el sistema en terreno (HU-38)",
  }),
  justificacionPrioridad: z.string().nullable().optional().openapi({
    description: "Justificación técnica de cambio de prioridad en terreno (HU-38)",
  }),
  requiereAsistenciaSocial: z.boolean(),
  fuenteOrigen: z.string(),
  asteriskCallId: z.string().nullable(),
  asteriskCallerPhone: z.string().nullable(),
  informante: z
    .object({
      id: z.string().uuid(),
      rut: z.string(),
      nombre: z.string(),
      telefono: z.string().nullable(),
    })
    .nullable()
    .openapi({ description: "Información de contacto del informante ciudadano" }),
  delegacion: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
      descripcion: z.string().nullable(),
    })
    .nullable()
    .openapi({ description: "Delegación territorial asignada" }),
  creadoPor: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
      email: z.string(),
    })
    .nullable()
    .openapi({ description: "Usuario operador que registró el caso" }),
  encargado: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
      email: z.string(),
    })
    .nullable()
    .openapi({ description: "Encargado de operaciones asignado" }),
  misiones: z.array(MisionDetalleSchema).openapi({ description: "Misiones tácticas vinculadas a la atención de este incidente" }),
  recursosAsociados: z.array(RecursoAsociadoSchema).openapi({ description: "Consolidado de recursos materiales y vehículos asignados en las misiones" }),
  reportesEvaluacionTerreno: z
    .array(
      z.object({
        id: z.string().uuid(),
        misionId: z.string().uuid(),
        versionReporte: z.number().int(),
        esRectificacion: z.boolean(),
        etiquetaReporte: z.string(),
        prioridadSugerida: PrioridadIncidenteEnum.nullable(),
        prioridadAsignada: PrioridadIncidenteEnum.nullable(),
        justificacionPrioridad: z.string().nullable(),
        resumenTecnico: z.string(),
        accionesRealizadas: z.string().nullable(),
        danosEstimados: z.string().nullable(),
        observaciones: z.string().nullable(),
        personasAfectadas: z.number(),
        requiereApoyoAdicional: z.boolean(),
        evaluacion: z.record(z.string(), z.unknown()),
        evaluador: z.object({
          id: z.string().uuid(),
          nombre: z.string(),
          email: z.string().nullable().optional(),
          rut: z.string().nullable().optional(),
        }),
        creadoEn: z.string(),
      })
    )
    .optional()
    .openapi({
      description:
        "Historial cronológico de reportes de evaluación en terreno enviados por la patrulla (incluyendo reporte inicial #1 y rectificaciones posteriores #2+)",
    }),
  verificado: z.boolean().default(false).openapi({ description: "Indica si la verificación presencial fue completada" }),
  reclasificadoEnTerreno: z.boolean().default(false).openapi({ description: "Indica si fue verificado o reclasificado en terreno" }),
  justificacionReclasificacion: z.string().nullable().optional().openapi({ description: "Justificación técnica en terreno" }),
  reclasificacionTipologia: z
    .object({
      hitoId: z.string().uuid(),
      misionId: z.string().uuid(),
      misionCodigo: z.string(),
      tipoAnterior: z.string().nullable(),
      tipoNuevo: z.string(),
      justificacion: z.string(),
      registradoPor: z.string().nullable(),
      creadoEn: z.string(),
    })
    .nullable()
    .optional()
    .openapi({
      description: "Detalle de la última reclasificación de tipología en terreno si hubo cambio",
    }),
  ultimoReporte: z
    .object({
      origen: z.enum(["REPORTE_TERRENO", "RECLASIFICACION"]),
      reporteId: z.string(),
      misionId: z.string().uuid(),
      misionCodigo: z.string(),
      evaluadorNombre: z.string(),
      creadoEn: z.string(),
      resumen: z.string(),
      prioridadAsignada: PrioridadIncidenteEnum.nullable(),
      versionReporte: z.number().int().nullable(),
      esRectificacion: z.boolean(),
    })
    .nullable()
    .optional()
    .openapi({
      description: "Resumen del último reporte o constatación enviado por alguna misión asignada al incidente",
    }),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});

export type IncidenteDetalle = z.infer<typeof IncidenteDetalleSchema>;

export const IncidenteDetalleResponseSchema = z.object({
  message: z.string().openapi({ example: "Detalle de incidente obtenido exitosamente" }),
  data: IncidenteDetalleSchema,
});

export type IncidenteDetalleResponse = z.infer<typeof IncidenteDetalleResponseSchema>;
