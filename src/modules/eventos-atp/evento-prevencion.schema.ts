import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  PaginationMetaSchema,
  PaginationQuerySchema,
} from "@/lib/shared/pagination.schema";

extendZodWithOpenApi(z);

export const EstadoEventoPrevencionSchema = z.enum([
  "PLANIFICADA",
  "EN_CURSO",
  "COMPLETADA",
  "CANCELADA",
]);

export type EstadoEventoPrevencion = z.infer<typeof EstadoEventoPrevencionSchema>;

export const PrioridadEventoPrevencionSchema = z.enum([
  "BAJA",
  "MEDIA",
  "ALTA",
  "CRITICA",
]);

export type PrioridadEventoPrevencion = z.infer<typeof PrioridadEventoPrevencionSchema>;

/**
 * Recurso logístico solicitado para apoyar la intervención preventiva.
 */
export const ItemRecursoPrevencionSchema = z.object({
  recursoId: z.string().uuid("El identificador del recurso debe ser un UUID válido").openapi({
    description: "UUID del recurso logístico en inventario",
    example: "00000000-0000-4000-8000-000000000001",
  }),
  cantidad: z.number().int().min(1, "La cantidad asignada debe ser mayor a 0").openapi({
    description: "Cantidad de unidades del recurso requeridas",
    example: 5,
  }),
});

export type ItemRecursoPrevencion = z.infer<typeof ItemRecursoPrevencionSchema>;

/**
 * Esquema de entrada para registrar un nuevo Evento de Prevención (HU-30).
 */
export const CrearEventoPrevencionInputSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre del evento debe tener al menos 3 caracteres")
    .max(150, "El nombre no puede superar los 150 caracteres")
    .openapi({
      description: "Título o nombre descriptivo de la operación preventiva",
      example: "Inspección preventiva y limpieza de colectores en Angachilla",
    }),
  descripcion: z
    .string()
    .trim()
    .min(5, "La descripción debe tener al menos 5 caracteres")
    .max(1000, "La descripción no puede superar los 1000 caracteres")
    .openapi({
      description: "Instrucciones de mitigación, detalle de vulnerabilidad y objetivos",
      example: "Monitoreo preventivo del caudal y despeje de rejillas por alerta temprana de temporal",
    }),
  sector: z.string().trim().max(150).optional().nullable().openapi({
    description: "Sector, población o referencia barrial dentro de Valdivia",
    example: "Humedal Angachilla",
  }),
  direccionTexto: z.string().trim().max(255).optional().nullable().openapi({
    description: "Dirección física o punto de referencia en terreno",
    example: "Pasaje Los Robles s/n con Av. Simpson",
  }),
  prioridad: PrioridadEventoPrevencionSchema.default("MEDIA").openapi({
    description: "Nivel de urgencia o prioridad operativa",
    example: "ALTA",
  }),
  delegacionId: z.string().uuid("El UUID de la delegación es obligatorio y debe ser válido").openapi({
    description: "Identificador de la delegación territorial correspondiente (Norte, Sur, Costa o Calle Calle)",
    example: "30000000-0000-4000-8000-000000000001",
  }),
  puntoCriticoId: z.string().uuid("El UUID del punto crítico debe ser válido").optional().nullable().openapi({
    description: "Identificador opcional del punto crítico preexistente en el inventario",
    example: "40000000-0000-4000-8000-000000000001",
  }),
  latitud: z.number().min(-90).max(90).openapi({
    description: "Latitud geográfica en formato WGS84",
    example: -39.8456,
  }),
  longitud: z.number().min(-180).max(180).openapi({
    description: "Longitud geográfica en formato WGS84",
    example: -73.2389,
  }),
  patrullaId: z.string().uuid("El UUID de la patrulla verificadora es obligatorio y debe ser válido").openapi({
    description: "Identificador de la patrulla verificadora disponible asignada al evento",
    example: "50000000-0000-4000-8000-000000000001",
  }),
  recursos: z.array(ItemRecursoPrevencionSchema).default([]).openapi({
    description: "Listado de insumos o herramientas asignadas para la misión preventiva",
  }),
});

export type CrearEventoPrevencionInput = z.infer<typeof CrearEventoPrevencionInputSchema>;

/**
 * Resumen del recurso asignado devuelto en la respuesta.
 */
export const RecursoAsignadoPrevencionResponseSchema = z.object({
  recursoId: z.string().uuid().openapi({ example: "00000000-0000-4000-8000-000000000001" }),
  nombre: z.string().openapi({ example: "Sacos de Arena 25kg" }),
  cantidadAsignada: z.number().openapi({ example: 5 }),
});

/**
 * Resumen de la misión táctica generada para el evento.
 */
export const MisionPrevencionResumenSchema = z.object({
  id: z.string().uuid().openapi({ example: "60000000-0000-4000-8000-000000000001" }),
  codigo: z.string().openapi({ example: "MIS-2026-0045" }),
  titulo: z.string().openapi({ example: "Inspección preventiva y limpieza de colectores en Angachilla" }),
  estado: z.string().openapi({ example: "DESPACHADA" }),
  tipoMision: z.string().openapi({ example: "PREVENCION" }),
});

/**
 * Resumen de la patrulla verificadora asignada.
 */
export const PatrullaAsignadaPrevencionResumenSchema = z.object({
  id: z.string().uuid().openapi({ example: "50000000-0000-4000-8000-000000000001" }),
  nombre: z.string().openapi({ example: "Patrulla Verificadora Alfa" }),
  estado: z.string().openapi({ example: "EN_PREVENCION" }),
});

/**
 * Esquema representativo del evento de prevención creado.
 */
export const EventoPrevencionResponseSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID del evento de prevención" }),
  codigo: z.string().openapi({ description: "Código institucional único (ej. PREV-2026-0001)", example: "PREV-2026-0001" }),
  nombre: z.string().openapi({ example: "Inspección preventiva y limpieza de colectores en Angachilla" }),
  descripcion: z.string().openapi({ example: "Monitoreo preventivo del caudal y despeje de rejillas" }),
  sector: z.string().nullable().openapi({ example: "Humedal Angachilla" }),
  direccionTexto: z.string().nullable().openapi({ example: "Pasaje Los Robles s/n" }),
  prioridad: PrioridadEventoPrevencionSchema.openapi({ example: "ALTA" }),
  estado: EstadoEventoPrevencionSchema.openapi({ example: "PLANIFICADA" }),
  latitud: z.number().openapi({ example: -39.8456 }),
  longitud: z.number().openapi({ example: -73.2389 }),
  puntoCritico: z
    .object({
      id: z.string().uuid(),
      codigo: z.string(),
      nombre: z.string(),
    })
    .nullable()
    .openapi({ description: "Punto crítico territorial asociado (si fue designado)" }),
  delegacion: z
    .object({
      id: z.string().uuid(),
      codigo: z.string(),
      nombre: z.string(),
    })
    .nullable()
    .openapi({ description: "Delegación territorial asignada" }),
  mision: MisionPrevencionResumenSchema.openapi({ description: "Misión táctica despachada a la patrulla" }),
  patrulla: PatrullaAsignadaPrevencionResumenSchema.openapi({ description: "Patrulla asignada en estado EN_PREVENCION" }),
  recursos: z.array(RecursoAsignadoPrevencionResponseSchema).openapi({ description: "Recursos asignados al evento" }),
  creadoPorId: z.string().uuid().openapi({ description: "Identificador del Encargado que creó el evento" }),
  creadoEn: z.string().openapi({ description: "Fecha de registro ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Fecha de actualización ISO 8601" }),
});

export type EventoPrevencionResponse = z.infer<typeof EventoPrevencionResponseSchema>;

/**
 * Respuesta HTTP 201 Created para POST /api/eventos-atp/prevencion
 */
export const CrearEventoPrevencionResponseSchema = z.object({
  message: z.string().openapi({ example: "Evento de prevención creado y patrulla despachada exitosamente." }),
  data: EventoPrevencionResponseSchema,
});

export type CrearEventoPrevencionResponse = z.infer<typeof CrearEventoPrevencionResponseSchema>;

/**
 * Parámetros de consulta para listado paginado de eventos de prevención bajo estándar H34 (H76).
 */
export const ListarEventosPrevencionQuerySchema = PaginationQuerySchema.extend({
  delegacionId: z.string().uuid("El UUID de la delegación debe ser válido").optional().openapi({
    description: "Filtrar por UUID de delegación municipal asignada",
    example: "30000000-0000-4000-8000-000000000001",
  }),
  estado: EstadoEventoPrevencionSchema.optional().openapi({
    description: "Filtrar por estado operativo del evento preventivo",
    example: "PLANIFICADA",
  }),
  busqueda: z.string().trim().optional().openapi({
    description: "Búsqueda textual insensible a mayúsculas por código, nombre, sector o punto crítico asociado",
    example: "Angachilla",
  }),
});

export type ListarEventosPrevencionQuery = z.infer<typeof ListarEventosPrevencionQuerySchema>;

/**
 * Detalle georreferenciado PostGIS del punto crítico asociado para el drawer lateral (H76).
 */
export const PuntoCriticoDetallePrevencionSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string().openapi({ example: "PC-VAL-001" }),
  nombre: z.string().openapi({ example: "Colector Humedal Angachilla" }),
  descripcion: z.string().nullable().openapi({ example: "Zona baja propensa a anegamiento por lluvias" }),
  tipoRiesgo: z.string().nullable().openapi({ example: "Inundación" }),
  prioridad: PrioridadEventoPrevencionSchema.openapi({ example: "ALTA" }),
  latitud: z.number().openapi({ example: -39.8456 }),
  longitud: z.number().openapi({ example: -73.2389 }),
  ubicacionGeoJson: z.unknown().nullable().openapi({
    description: "Geometría PostGIS Point en formato GeoJSON (EPSG:4326)",
    example: { type: "Point", coordinates: [-73.2389, -39.8456] },
  }),
});

/**
 * Resumen de la misión táctica en el listado de prevención (H76).
 */
export const MisionPrevencionListadoResumenSchema = MisionPrevencionResumenSchema.extend({
  fechaInicio: z.string().nullable().openapi({ description: "Fecha de inicio de la misión (ISO 8601)" }),
  fechaCierre: z.string().nullable().openapi({ description: "Fecha de cierre de la misión (ISO 8601)" }),
});

/**
 * Resumen de cuadrilla operativa asignada (si aplica).
 */
export const CuadrillaAsignadaPrevencionResumenSchema = z.object({
  id: z.string().uuid().openapi({ example: "70000000-0000-4000-8000-000000000001" }),
  nombre: z.string().openapi({ example: "Cuadrilla Mitigación Sur" }),
  estado: z.string().openapi({ example: "EN_MISION" }),
});

/**
 * Ítem del listado paginado de eventos de prevención (H76).
 */
export const EventoPrevencionListadoItemSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string().openapi({ example: "PREV-2026-0001" }),
  nombre: z.string().openapi({ example: "Limpieza de sumideros en Angachilla" }),
  descripcion: z.string(),
  sector: z.string().nullable(),
  direccionTexto: z.string().nullable(),
  prioridad: PrioridadEventoPrevencionSchema,
  estado: EstadoEventoPrevencionSchema,
  latitud: z.number(),
  longitud: z.number(),
  ubicacionGeoJson: z.unknown().nullable().openapi({
    description: "Geometría PostGIS Point del evento en formato GeoJSON (EPSG:4326)",
  }),
  puntoCritico: PuntoCriticoDetallePrevencionSchema.nullable().openapi({
    description: "Detalle completo y PostGIS del punto crítico asociado (si existe)",
  }),
  delegacion: z
    .object({
      id: z.string().uuid(),
      codigo: z.string(),
      nombre: z.string(),
    })
    .nullable(),
  mision: MisionPrevencionListadoResumenSchema.nullable(),
  patrulla: PatrullaAsignadaPrevencionResumenSchema.nullable(),
  cuadrilla: CuadrillaAsignadaPrevencionResumenSchema.nullable(),
  recursos: z.array(RecursoAsignadoPrevencionResponseSchema),
  creadoPorId: z.string().uuid(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});

export type EventoPrevencionListadoItem = z.infer<typeof EventoPrevencionListadoItemSchema>;

/**
 * Respuesta HTTP 200 OK estándar H34 para GET /api/eventos-atp/prevencion (H76).
 */
export const ListarEventosPrevencionResponseSchema = z.object({
  message: z.string().openapi({ example: "Eventos de prevención obtenidos exitosamente." }),
  data: z.array(EventoPrevencionListadoItemSchema),
  meta: PaginationMetaSchema,
});

export type ListarEventosPrevencionResponse = z.infer<typeof ListarEventosPrevencionResponseSchema>;
