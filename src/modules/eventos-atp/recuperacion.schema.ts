import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
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
 * Validador para fechas opcionales en filtros query (ISO 8601).
 * Trata strings vacíos o de solo espacios como undefined y rechaza formatos inválidos.
 */
const FechaFiltroSchema = z
  .string()
  .transform((val) => val.trim())
  .refine(
    (val) => val === "" || !Number.isNaN(Date.parse(val)),
    {
      message: "Formato de fecha inválido. Se espera una fecha ISO 8601 válida.",
    }
  )
  .transform((val) => (val === "" ? undefined : val));

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
// ESQUEMAS PARA ASIGNACIÓN HU-32
// ==========================================

export const AsignarRecursosRecuperacionInputSchema = z.object({
  patrullaId: z.string().uuid("El UUID de la patrulla verificadora es obligatorio y debe ser válido").openapi({
    description: "Identificador de la patrulla verificadora disponible a asignar",
    example: "50000000-0000-4000-8000-000000000001",
  }),
  recursos: z.array(ItemRecursoSolicitadoSchema).min(1, "Debe asignar al menos un recurso al evento de recuperación").openapi({
    description: "Listado de insumos y recursos logísticos a entregar",
  }),
  instrucciones: z.string().trim().max(1000).optional().nullable().openapi({
    description: "Instrucciones tácticas para la patrulla",
    example: "Priorizar entrega en pasaje Los Lingues",
  }),
});

export type AsignarRecursosRecuperacionInput = z.infer<typeof AsignarRecursosRecuperacionInputSchema>;

export const RecursoAsignadoDetalleSchema = z.object({
  recursoId: z.string().uuid().openapi({ example: "00000000-0000-4000-8000-000000000001" }),
  nombre: z.string().openapi({ example: "Sacos de Arena 25kg" }),
  esIndividual: z.boolean().openapi({ example: false }),
  cantidadAsignada: z.number().openapi({ example: 10 }),
  cantidadEnUso: z.number().openapi({ example: 10 }),
  estadoRecurso: z.string().openapi({ example: "DISPONIBLE" }),
});

export type RecursoAsignadoDetalle = z.infer<typeof RecursoAsignadoDetalleSchema>;

export const AsignarRecursosRecuperacionResponseDataSchema = z.object({
  evento: z.object({
    id: z.string().uuid().openapi({ example: "70000000-0000-4000-8000-000000000001" }),
    codigo: z.string().openapi({ example: "REC-2026-0001" }),
    nombre: z.string().openapi({ example: "Entrega de frazadas y techumbre en Sector Collico" }),
    estado: EstadoRecuperacionSchema.openapi({ example: "PLANIFICADA" }),
  }),
  mision: MisionRecuperacionResumenSchema.openapi({ description: "Misión táctica despachada a terreno" }),
  patrulla: PatrullaAsignadaResumenSchema.openapi({ description: "Patrulla transicionada a EN_RECUPERACION" }),
  recursos: z.array(RecursoAsignadoDetalleSchema).openapi({ description: "Recursos asignados con stock en uso actualizado" }),
  asignadoEn: z.string().openapi({ description: "Fecha de asignación ISO 8601" }),
});

export type AsignarRecursosRecuperacionResponseData = z.infer<typeof AsignarRecursosRecuperacionResponseDataSchema>;

export const AsignarRecursosRecuperacionResponseSchema = z.object({
  message: z.string().openapi({ example: "Patrulla y recursos logísticos asignados exitosamente al evento de recuperación." }),
  data: AsignarRecursosRecuperacionResponseDataSchema,
});

export type AsignarRecursosRecuperacionResponse = z.infer<typeof AsignarRecursosRecuperacionResponseSchema>;

// ==========================================
// ESQUEMAS PARA LISTADO PAGINADO (H73)
// ==========================================

/**
 * Parámetros de consulta (Query Params) para listar operativos de recuperación.
 * Sigue el estándar de contratos H34.
 * Nota técnica BUG-H73-API-03: page y limit son opcionales sin .default()
 * para permitir que los aliases pagina y limite no sean sobreescritos.
 */
export const ListarRecuperacionesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, "page debe ser mayor o igual a 1").optional().openapi({
      description: "Número de página",
      example: 1,
    }),
    limit: z.coerce.number().int().min(1, "limit debe ser mayor o igual a 1").max(100, "limit no puede superar 100").optional().openapi({
      description: "Cantidad de registros por página",
      example: 10,
    }),
    pagina: z.coerce.number().int().min(1, "pagina debe ser mayor o igual a 1").optional().openapi({
      description: "Alias legado de 'page'",
      example: 1,
    }),
    limite: z.coerce.number().int().min(1, "limite debe ser mayor o igual a 1").max(100, "limite no puede superar 100").optional().openapi({
      description: "Alias legado de 'limit'",
      example: 10,
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
    fechaDesde: FechaFiltroSchema.optional().openapi({
      description: "Fecha mínima de registro (filtro temporal ISO 8601)",
      example: "2026-11-01T00:00:00.000Z",
    }),
    fechaHasta: FechaFiltroSchema.optional().openapi({
      description: "Fecha máxima de registro (filtro temporal ISO 8601)",
      example: "2026-11-30T23:59:59.999Z",
    }),
    ordenarPor: z.enum(["creadoEn", "codigo", "prioridad", "familiasAfectadas", "nombre", "estado"]).default("creadoEn").openapi({
      description: "Criterio de ordenamiento",
      example: "creadoEn",
    }),
    orden: z.enum(["asc", "desc"]).default("desc").openapi({
      description: "Sentido del ordenamiento",
      example: "desc",
    }),
  })
  .refine(
    (data) => {
      if (data.fechaDesde && data.fechaHasta) {
        return new Date(data.fechaDesde).getTime() <= new Date(data.fechaHasta).getTime();
      }
      return true;
    },
    {
      message: "fechaDesde debe ser menor o igual a fechaHasta.",
      path: ["fechaDesde"],
    }
  )
  .transform((data) => ({
    ...data,
    page: data.page ?? data.pagina ?? 1,
    limit: data.limit ?? data.limite ?? 20,
  }));

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
 * Respuesta JSON exitosa HTTP 200 bajo estándar de contratos H34.
 */
export const ListarRecuperacionesResponseSchema = z.object({
  message: z.string().optional().openapi({ example: "Operativos de recuperación obtenidos exitosamente." }),
  data: z.array(OperativoRecuperacionItemSchema).openapi({ description: "Listado de operativos encontrados" }),
  meta: PaginationMetaSchema.openapi({ description: "Metadatos de paginación canónicos H34" }),
  total: z.number().int().optional().openapi({ description: "Total general de registros" }),
});

export type ListarRecuperacionesResponse = z.infer<typeof ListarRecuperacionesResponseSchema>;

// ==========================================
// ESQUEMAS PARA DETALLE Y DRAWER LATERAL (H73)
// ==========================================

export const RecuperacionIdParamSchema = z.object({
  id: z.string().uuid("Identificador de evento de recuperación debe ser un UUID válido").openapi({
    description: "UUID del operativo de recuperación",
    example: "70000000-0000-4000-8000-000000000001",
  }),
});

export type RecuperacionIdParam = z.infer<typeof RecuperacionIdParamSchema>;

export const HistorialRecuperacionItemSchema = z.object({
  id: z.string().openapi({ example: "hito-1" }),
  tipo: z.enum(["CREACION", "HITO_MISION", "REPORTE_TERRENO", "CIERRE"]).openapi({ example: "HITO_MISION" }),
  titulo: z.string().openapi({ example: "Arribo al sector" }),
  descripcion: z.string().openapi({ example: "Llegada de la patrulla con insumos a la JJVV" }),
  registradoPor: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
  }).nullable().optional(),
  creadoEn: z.string().openapi({ description: "Fecha y hora ISO 8601 del evento" }),
});

export type HistorialRecuperacionItem = z.infer<typeof HistorialRecuperacionItemSchema>;

/**
 * Esquema de detalle del evento de recuperación (GET /api/eventos-atp/recuperacion/[id]).
 * Unifica los requisitos de HU-32 (misiones, recursosAsignados) y HU-73 (drawer enriquecido).
 */
export const RecuperacionDetalleResponseDataSchema = z.object({
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
  creador: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
    rol: z.string().optional(),
  }).nullable().optional(),
  creadoPor: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
  }).nullable().optional(),
  mision: MisionRecuperacionResumenSchema.nullable().optional(),
  misiones: z.array(
    z.object({
      id: z.string().uuid(),
      codigo: z.string(),
      titulo: z.string(),
      estado: z.string(),
      tipoMision: z.string(),
      patrulla: z.object({
        id: z.string().uuid(),
        nombre: z.string(),
        estado: z.string(),
      }).nullable().optional(),
      creadoEn: z.string(),
    })
  ).optional().default([]),
  patrulla: PatrullaAsignadaResumenSchema.nullable().optional(),
  recursos: z.array(RecursoAsignadoItemResponseSchema).optional().default([]),
  recursosAsignados: z.array(
    z.object({
      id: z.string().uuid(),
      recursoId: z.string().uuid(),
      nombre: z.string(),
      esIndividual: z.boolean(),
      cantidadAsignada: z.number(),
      misionId: z.string().uuid().nullable().optional(),
      creadoEn: z.string(),
    })
  ).optional().default([]),
  cantidadInsumosAsignados: z.number().int().optional().default(0),
  totalTiposInsumos: z.number().int().optional().default(0),
  historial: z.array(HistorialRecuperacionItemSchema).optional().default([]),
  creadoPorId: z.string().uuid().optional(),
  creadoEn: z.string().openapi({ description: "Fecha de registro ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Fecha de última actualización ISO 8601" }),
  fechaCierre: z.string().nullable().optional(),
  observacionesCierre: z.string().nullable().optional(),
});

export type RecuperacionDetalleResponseData = z.infer<typeof RecuperacionDetalleResponseDataSchema>;

export const RecuperacionDetalleResponseSchema = z.object({
  message: z.string().openapi({ example: "Detalle del evento de recuperación obtenido exitosamente." }),
  data: RecuperacionDetalleResponseDataSchema,
});

export type RecuperacionDetalleResponse = z.infer<typeof RecuperacionDetalleResponseSchema>;
