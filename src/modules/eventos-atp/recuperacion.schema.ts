import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
} from "@/lib/shared/pagination.schema";

extendZodWithOpenApi(z);

export const EstadoRecuperacionSchema = z.enum([
  "PLANIFICADA",
  "EN_EJECUCION",
  "COMPLETADA",
  "CANCELADA",
]);

export type EstadoRecuperacion = z.infer<typeof EstadoRecuperacionSchema>;

export const PrioridadRecuperacionSchema = z.enum([
  "BAJA",
  "MEDIA",
  "ALTA",
  "CRITICA",
]);

export type PrioridadRecuperacion = z.infer<typeof PrioridadRecuperacionSchema>;

/**
 * Recurso solicitado con su cantidad para la entrega en terreno.
 */
export const ItemRecursoSolicitadoSchema = z.object({
  recursoId: z.string().uuid("El identificador del recurso debe ser un UUID válido").openapi({
    description: "UUID del recurso logístico en inventario",
    example: "00000000-0000-4000-8000-000000000001",
  }),
  cantidad: z.number().int().min(1, "La cantidad debe ser mayor a 0").openapi({
    description: "Cantidad de unidades requeridas para entrega en el evento",
    example: 10,
  }),
});

export type ItemRecursoSolicitado = z.infer<typeof ItemRecursoSolicitadoSchema>;

/**
 * Esquema de entrada para crear un evento de recuperación en terreno (HU-29).
 */
export const CrearEventoRecuperacionInputSchema = z.object({
  nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(150, "El nombre no puede superar los 150 caracteres").openapi({
    description: "Título o nombre descriptivo del evento de recuperación",
    example: "Entrega de frazadas y techumbre en Sector Collico",
  }),
  descripcion: z.string().trim().max(1000).optional().nullable().openapi({
    description: "Detalle técnico, justificación o indicaciones para la patrulla",
    example: "Familias afectadas por voladura de techumbre tras temporal de viento",
  }),
  sector: z.string().trim().min(2, "El sector debe tener al menos 2 caracteres").max(150).openapi({
    description: "Nombre del sector, barrio o población afectada en Valdivia",
    example: "Collico",
  }),
  direccionTexto: z.string().trim().max(255).optional().nullable().openapi({
    description: "Dirección exacta o punto de referencia en terreno",
    example: "Calle Balmaceda 1245 con Las Palmeras",
  }),
  prioridad: PrioridadRecuperacionSchema.default("MEDIA").openapi({
    description: "Nivel de urgencia o prioridad operativa",
    example: "ALTA",
  }),
  contactoNombre: z.string().trim().max(150).optional().nullable().openapi({
    description: "Nombre del referente vecinal o contacto en terreno",
    example: "Juan Pérez (Presidente JJVV)",
  }),
  contactoTelefono: z.string().trim().max(50).optional().nullable().openapi({
    description: "Teléfono de contacto en terreno",
    example: "+56912345678",
  }),
  latitud: z.number().min(-90).max(90).openapi({
    description: "Latitud geográfica en formato WGS84",
    example: -39.8142,
  }),
  longitud: z.number().min(-180).max(180).openapi({
    description: "Longitud geográfica en formato WGS84",
    example: -73.2459,
  }),
  delegacionId: z.string().uuid("El UUID de delegación es inválido").optional().nullable().openapi({
    description: "Identificador de la delegación territorial correspondiente",
    example: "30000000-0000-4000-8000-000000000001",
  }),
  patrullaId: z.string().uuid("El UUID de la patrulla verificadora es obligatorio y debe ser válido").openapi({
    description: "Identificador de la patrulla verificadora disponible asignada a la entrega",
    example: "50000000-0000-4000-8000-000000000001",
  }),
  familiasAfectadas: z.number().int().min(0).default(0).openapi({
    description: "Número estimado de familias o viviendas beneficiadas",
    example: 4,
  }),
  recursos: z.array(ItemRecursoSolicitadoSchema).min(1, "Debe asignar al menos un recurso al evento de recuperación").openapi({
    description: "Listado de insumos y recursos logísticos a entregar",
  }),
});

export type CrearEventoRecuperacionInput = z.infer<typeof CrearEventoRecuperacionInputSchema>;

/**
 * Detalle del recurso asignado devuelto en la respuesta.
 */
export const RecursoAsignadoItemResponseSchema = z.object({
  recursoId: z.string().uuid().openapi({ example: "00000000-0000-4000-8000-000000000001" }),
  nombre: z.string().openapi({ example: "Sacos de Arena 25kg" }),
  cantidadAsignada: z.number().openapi({ example: 10 }),
});

export type RecursoAsignadoItemResponse = z.infer<typeof RecursoAsignadoItemResponseSchema>;

/**
 * Resumen del desglose de recurso para la tabla de operativos.
 */
export const RecursoResumenItemSchema = z.object({
  recursoId: z.string().uuid().openapi({ example: "00000000-0000-4000-8000-000000000001" }),
  nombre: z.string().openapi({ example: "Frazadas Térmicas" }),
  cantidadAsignada: z.number().openapi({ example: 10 }),
});

export type RecursoResumenItem = z.infer<typeof RecursoResumenItemSchema>;

/**
 * Resumen de la misión táctica generada para el evento.
 */
export const MisionRecuperacionResumenSchema = z.object({
  id: z.string().uuid().openapi({ example: "60000000-0000-4000-8000-000000000001" }),
  codigo: z.string().openapi({ example: "MIS-2026-0042" }),
  titulo: z.string().openapi({ example: "Entrega de frazadas y techumbre en Sector Collico" }),
  estado: z.string().openapi({ example: "DESPACHADA" }),
  tipoMision: z.string().openapi({ example: "RECUPERACION" }),
});

/**
 * Resumen de la patrulla verificadora asignada.
 */
export const PatrullaAsignadaResumenSchema = z.object({
  id: z.string().uuid().openapi({ example: "50000000-0000-4000-8000-000000000001" }),
  nombre: z.string().openapi({ example: "Patrulla Verificadora Alfa" }),
  estado: z.string().openapi({ example: "EN_RECUPERACION" }),
});

/**
 * Esquema representativo del evento de recuperación registrado.
 */
export const EventoRecuperacionResponseSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID del evento de recuperación" }),
  codigo: z.string().openapi({ description: "Código oficial único del evento (ej. REC-2026-0001)", example: "REC-2026-0001" }),
  nombre: z.string().openapi({ example: "Entrega de frazadas y techumbre en Sector Collico" }),
  descripcion: z.string().nullable().openapi({ example: "Familias afectadas por temporal de viento" }),
  sector: z.string().openapi({ example: "Collico" }),
  direccionTexto: z.string().nullable().openapi({ example: "Calle Balmaceda 1245 con Las Palmeras" }),
  prioridad: PrioridadRecuperacionSchema.openapi({ example: "ALTA" }),
  contactoNombre: z.string().nullable().openapi({ example: "Juan Pérez (Presidente JJVV)" }),
  contactoTelefono: z.string().nullable().openapi({ example: "+56912345678" }),
  latitud: z.number().openapi({ example: -39.8142 }),
  longitud: z.number().openapi({ example: -73.2459 }),
  estado: EstadoRecuperacionSchema.openapi({ example: "PLANIFICADA" }),
  familiasAfectadas: z.number().openapi({ example: 4 }),
  delegacion: z.object({
    id: z.string().uuid(),
    codigo: z.string(),
    nombre: z.string(),
  }).nullable().openapi({ description: "Delegación territorial asignada" }),
  mision: MisionRecuperacionResumenSchema.openapi({ description: "Misión táctica despachada a terreno" }),
  patrulla: PatrullaAsignadaResumenSchema.openapi({ description: "Patrulla asignada a la operación" }),
  recursos: z.array(RecursoAsignadoItemResponseSchema).openapi({ description: "Recursos reservados o descontados para la entrega" }),
  creadoPorId: z.string().uuid().openapi({ description: "Identificador del Encargado que creó el evento" }),
  creadoEn: z.string().openapi({ description: "Fecha de registro ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Fecha de actualización ISO 8601" }),
});

export type EventoRecuperacionResponse = z.infer<typeof EventoRecuperacionResponseSchema>;

/**
 * Respuesta JSON exitosa HTTP 201 para POST /api/eventos-atp/recuperacion
 */
export const CrearEventoRecuperacionResponseSchema = z.object({
  message: z.string().openapi({ example: "Evento de recuperación registrado y patrulla despachada exitosamente." }),
  data: EventoRecuperacionResponseSchema,
});

export type CrearEventoRecuperacionResponse = z.infer<typeof CrearEventoRecuperacionResponseSchema>;

// ==========================================
// ESQUEMAS PARA LISTADO PAGINADO (H73)
// ==========================================

/**
 * Parámetros de consulta (Query Params) para listar operativos de recuperación.
 * Sigue el estándar de contratos H34 (page, limit, filtros territoriales y de estado).
 */
export const ListarRecuperacionesQuerySchema = PaginationQuerySchema.extend({
  pagina: z.coerce.number().int().min(1).optional().openapi({
    description: "Alias legado de 'page'",
    example: 1,
  }),
  limite: z.coerce.number().int().min(1).max(100).optional().openapi({
    description: "Alias legado de 'limit'",
    example: 20,
  }),
  delegacionId: z.string().uuid("UUID de delegación territorial inválido").optional().openapi({
    description: "Filtrar por identificador de la delegación territorial correspondiente",
    example: "30000000-0000-4000-8000-000000000001",
  }),
  estado: EstadoRecuperacionSchema.optional().openapi({
    description: "Filtrar por estado del ciclo de vida del operativo",
    example: "PLANIFICADA",
  }),
  prioridad: PrioridadRecuperacionSchema.optional().openapi({
    description: "Filtrar por nivel de urgencia o prioridad operativa",
    example: "ALTA",
  }),
  busqueda: z.string().trim().optional().openapi({
    description: "Búsqueda textual insensible a mayúsculas por código (REC-XXXX), título o sector",
    example: "Collico",
  }),
  fechaDesde: z.string().optional().openapi({
    description: "Fecha mínima de registro (filtro temporal ISO 8601)",
    example: "2026-11-01T00:00:00.000Z",
  }),
  fechaHasta: z.string().optional().openapi({
    description: "Fecha máxima de registro (filtro temporal ISO 8601)",
    example: "2026-11-30T23:59:59.999Z",
  }),
  ordenarPor: z.enum(["creadoEn", "codigo", "prioridad", "familiasAfectadas"]).default("creadoEn").openapi({
    description: "Criterio de ordenamiento",
    example: "creadoEn",
  }),
  orden: z.enum(["asc", "desc"]).default("desc").openapi({
    description: "Sentido del ordenamiento",
    example: "desc",
  }),
});

export type ListarRecuperacionesQuery = z.infer<typeof ListarRecuperacionesQuerySchema>;
export type ListarRecuperacionesInput = z.input<typeof ListarRecuperacionesQuerySchema>;

/**
 * Fila representativa para la tabla de visualización del Encargado en Centro de Incidentes (H73).
 */
export const OperativoRecuperacionItemSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID del operativo de recuperación" }),
  codigo: z.string().openapi({ description: "Código oficial del operativo (ej. REC-2026-0001)", example: "REC-2026-0001" }),
  nombre: z.string().openapi({ description: "Título descriptivo del despliegue", example: "Entrega de frazadas y techumbre en Sector Collico" }),
  descripcion: z.string().nullable().openapi({ example: "Familias afectadas por temporal de viento" }),
  sector: z.string().openapi({ example: "Collico" }),
  direccionTexto: z.string().nullable().openapi({ example: "Calle Balmaceda 1245 con Las Palmeras" }),
  prioridad: PrioridadRecuperacionSchema.openapi({ example: "ALTA" }),
  estado: EstadoRecuperacionSchema.openapi({ example: "PLANIFICADA" }),
  familiasAfectadas: z.number().int().openapi({ example: 4 }),
  delegacion: z.object({
    id: z.string().uuid(),
    codigo: z.string(),
    nombre: z.string(),
  }).nullable().openapi({ description: "Delegación municipal territorial asociada" }),
  cantidadInsumosAsignados: z.number().int().openapi({
    description: "Cantidad total de unidades de insumos asignadas a la operación",
    example: 15,
  }),
  totalTiposInsumos: z.number().int().openapi({
    description: "Cantidad de tipos de insumo distintos asignados",
    example: 2,
  }),
  recursosResumen: z.array(RecursoResumenItemSchema).openapi({
    description: "Desglose de recursos asignados por tipo y cantidad",
  }),
  creadoEn: z.string().openapi({ description: "Fecha de registro ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Fecha de última modificación ISO 8601" }),
  fechaCierre: z.string().nullable().optional().openapi({ description: "Fecha de cierre o finalización si concluyó" }),
});

export type OperativoRecuperacionItem = z.infer<typeof OperativoRecuperacionItemSchema>;

/**
 * Respuesta JSON paginada bajo estándar H34 para GET /api/eventos-atp/recuperacion.
 */
export const ListarRecuperacionesResponseSchema = z.object({
  message: z.string().openapi({ example: "Listado de operativos de recuperación obtenido exitosamente" }),
  data: z.array(OperativoRecuperacionItemSchema),
  meta: PaginationMetaSchema,
});

export type ListarRecuperacionesResponse = z.infer<typeof ListarRecuperacionesResponseSchema>;

// ==========================================
// ESQUEMAS PARA DETALLE DEL DRAWER (H73)
// ==========================================

export const RecuperacionIdParamSchema = z.string().uuid("El identificador del operativo debe ser un UUID válido").openapi({
  description: "UUID del operativo de recuperación a consultar",
  example: "70000000-0000-4000-8000-000000000001",
});

/**
 * Evento cronológico del historial para el drawer lateral.
 */
export const HistorialRecuperacionItemSchema = z.object({
  id: z.string().openapi({ example: "h-001" }),
  tipo: z.enum(["CREACION", "HITO_MISION", "REPORTE_TERRENO", "ESTADO_OPERATIVO"]).openapi({ example: "CREACION" }),
  titulo: z.string().openapi({ example: "Operativo Planificado y Despachado" }),
  descripcion: z.string().nullable().openapi({ example: "Se despacha patrulla verificadora con insumos" }),
  registradoPor: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
  }).nullable().openapi({ description: "Funcionario responsable del registro" }),
  creadoEn: z.string().openapi({ description: "Marca de tiempo ISO 8601 del evento" }),
});

export type HistorialRecuperacionItem = z.infer<typeof HistorialRecuperacionItemSchema>;

/**
 * Detalle consolidado del operativo para visualización en el drawer lateral.
 */
export const RecuperacionDetalleResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: "70000000-0000-4000-8000-000000000001" }),
  codigo: z.string().openapi({ example: "REC-2026-0001" }),
  nombre: z.string().openapi({ example: "Entrega de frazadas y techumbre en Sector Collico" }),
  descripcion: z.string().nullable().openapi({ example: "Familias afectadas por temporal de viento" }),
  sector: z.string().openapi({ example: "Collico" }),
  direccionTexto: z.string().nullable().openapi({ example: "Calle Balmaceda 1245 con Las Palmeras" }),
  prioridad: PrioridadRecuperacionSchema.openapi({ example: "ALTA" }),
  contactoNombre: z.string().nullable().openapi({ example: "Juan Pérez (Presidente JJVV)" }),
  contactoTelefono: z.string().nullable().openapi({ example: "+56912345678" }),
  latitud: z.number().openapi({ example: -39.8142 }),
  longitud: z.number().openapi({ example: -73.2459 }),
  estado: EstadoRecuperacionSchema.openapi({ example: "PLANIFICADA" }),
  familiasAfectadas: z.number().openapi({ example: 4 }),
  delegacion: z.object({
    id: z.string().uuid(),
    codigo: z.string(),
    nombre: z.string(),
  }).nullable().openapi({ description: "Delegación territorial asignada" }),
  creadoPor: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
  }).nullable().openapi({ description: "Funcionario que creó el evento" }),
  mision: MisionRecuperacionResumenSchema.nullable().openapi({ description: "Misión táctica despachada a terreno" }),
  patrulla: PatrullaAsignadaResumenSchema.nullable().openapi({ description: "Patrulla asignada a la operación" }),
  recursos: z.array(RecursoAsignadoItemResponseSchema).openapi({ description: "Detalle completo de recursos e insumos asignados" }),
  cantidadInsumosAsignados: z.number().int().openapi({ example: 15 }),
  totalTiposInsumos: z.number().int().openapi({ example: 2 }),
  historial: z.array(HistorialRecuperacionItemSchema).openapi({ description: "Línea de tiempo cronológica de hitos y avances" }),
  creadoEn: z.string().openapi({ description: "Fecha de registro ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Fecha de última modificación ISO 8601" }),
  fechaCierre: z.string().nullable().optional().openapi({ description: "Fecha de finalización de entrega" }),
  observacionesCierre: z.string().nullable().optional().openapi({ description: "Observaciones finales de cierre" }),
});

export type RecuperacionDetalleResponse = z.infer<typeof RecuperacionDetalleResponseSchema>;

/**
 * Respuesta HTTP 200 para GET /api/eventos-atp/recuperacion/{id}
 */
export const ObtenerRecuperacionDetalleResponseSchema = z.object({
  message: z.string().openapi({ example: "Detalle de operativo de recuperación obtenido exitosamente" }),
  data: RecuperacionDetalleResponseSchema,
});

export type ObtenerRecuperacionDetalleResponse = z.infer<typeof ObtenerRecuperacionDetalleResponseSchema>;
