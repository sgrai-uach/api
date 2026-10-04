import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const EstadoIncidenteEnum = z.enum([
  "REPORTADO",
  "VERIFICANDO",
  "EN_ATENCION",
  "NO_ABORDABLE",
  "RESUELTO",
]);

export const PrioridadIncidenteEnum = z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]);

// 1. Esquema de validación para parámetros de consulta (Query Params)
export const ListarIncidentesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({
    description: "Número de página para paginación (comienza en 1)",
    example: 1,
  }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    description: "Cantidad de elementos por página (máximo 100)",
    example: 20,
  }),
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
  delegacionId: z
    .string()
    .uuid("El identificador de delegación debe ser un UUID válido")
    .optional()
    .openapi({
      description: "Filtrar incidentes por delegación territorial",
      example: "11111111-1111-4111-8111-111111111111",
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
  requiereAsistenciaSocial: z.boolean().openapi({ description: "Indica si se requiere derivación para ficha FIBE" }),
  fuenteOrigen: z.string().openapi({ description: "Fuente de origen del reporte (CHATBOT, LLAMADA, TERRENO, SENAPRED)" }),
  informanteNombre: z.string().nullable().openapi({ description: "Nombre de pila del ciudadano informante o null si anónimo" }),
  delegacionNombre: z.string().nullable().openapi({ description: "Nombre de la delegación territorial correspondiente" }),
  totalMisiones: z.number().openapi({ description: "Cantidad de misiones tácticas despachadas o generadas para este incidente" }),
  creadoEn: z.string().openapi({ description: "Fecha y hora de registro en formato ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Última fecha y hora de actualización en formato ISO 8601" }),
});

export type IncidenteResumen = z.infer<typeof IncidenteResumenSchema>;

// Respuesta del listado paginado
export const ListarIncidentesResponseSchema = z.object({
  message: z.string().openapi({ example: "Listado de incidentes obtenido exitosamente" }),
  data: z.array(IncidenteResumenSchema),
  paginacion: PaginacionMetaSchema,
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
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});

export type IncidenteDetalle = z.infer<typeof IncidenteDetalleSchema>;

export const IncidenteDetalleResponseSchema = z.object({
  message: z.string().openapi({ example: "Detalle de incidente obtenido exitosamente" }),
  data: IncidenteDetalleSchema,
});

export type IncidenteDetalleResponse = z.infer<typeof IncidenteDetalleResponseSchema>;
