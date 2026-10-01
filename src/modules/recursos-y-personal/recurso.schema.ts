import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/**
 * Catálogo de estados de disponibilidad operativa del inventario logístico.
 */
export const EstadoRecursoSchema = z.enum([
  "DISPONIBLE",
  "ASIGNADO",
  "EN_MANTENCION",
  "BAJO_STOCK",
  "NO_DISPONIBLE",
]);

export type EstadoRecurso = z.infer<typeof EstadoRecursoSchema>;

export const DetallesRecursoSchema = z
  .object({
    // Identificación general de activos serializados
    patente: z.string().trim().optional(),
    numeroSerie: z.string().trim().optional(),
    marca: z.string().trim().optional(),
    modelo: z.string().trim().optional(),
    anio: z.number().int().min(1900, "Año inválido").max(2100, "Año inválido").optional(),

    // Camionetas y Vehículos de transporte
    kilometraje: z.number().min(0, "El kilometraje no puede ser negativo").optional(),
    tipoCombustible: z.enum(["GASOLINA", "DIESEL", "ELECTRICO", "HIBRIDO", "OTRO"]).optional(),
    capacidadPasajeros: z.number().int().positive("Capacidad de pasajeros debe ser positiva").optional(),
    numeroChasis: z.string().trim().optional(),

    // Grúas y Maquinaria Pesada
    capacidadCargaKg: z.number().positive("La capacidad de carga debe ser mayor a 0").optional(),
    alcanceMaximoMetros: z.number().positive("El alcance máximo debe ser mayor a 0").optional(),
    tipoGrua: z.string().trim().optional(),
    horometro: z.number().min(0, "El horómetro no puede ser negativo").optional(),

    // Motobombas y Equipos de Achique / Fluidos
    caudalMaximoLpm: z.number().positive("El caudal debe ser mayor a 0").optional(),
    diametroPulgadas: z.number().positive("El diámetro debe ser mayor a 0").optional(),
    potenciaHp: z.number().positive("La potencia en HP debe ser mayor a 0").optional(),

    // Generadores Eléctricos
    potenciaKva: z.number().positive("La potencia en kVA debe ser mayor a 0").optional(),
  })
  .passthrough();

export const CrearRecursoInputSchema = z.object({
  nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres"),
  esIndividual: z.boolean().default(false),
  cantidadInventario: z
    .number({ message: "La cantidad en inventario es obligatoria" })
    .int("La cantidad debe ser un número entero")
    .min(0, "La cantidad en inventario no puede ser negativa"),
  cantidadMinima: z
    .number()
    .int("La cantidad mínima debe ser un número entero")
    .min(0, "La cantidad mínima no puede ser negativa")
    .default(0),
  latitud: z
    .number({ message: "La latitud es obligatoria" })
    .min(-90, "La latitud debe estar entre -90 y 90")
    .max(90, "La latitud debe estar entre -90 y 90"),
  longitud: z
    .number({ message: "La longitud es obligatoria" })
    .min(-180, "La longitud debe estar entre -180 y 180")
    .max(180, "La longitud debe estar entre -180 y 180"),
  descripcion: z.string().trim().optional(),
  detalles: DetallesRecursoSchema.optional().default({}),
  delegacionId: z.string().uuid("Formato de UUID de delegación inválido").optional().nullable(),
});

export type CrearRecursoInput = z.infer<typeof CrearRecursoInputSchema>;
export type DetallesRecurso = z.infer<typeof DetallesRecursoSchema>;

export const RecursoResponseSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  esIndividual: z.boolean(),
  estado: EstadoRecursoSchema,
  cantidadInventario: z.number().int(),
  cantidadEnUso: z.number().int(),
  cantidadMinima: z.number().int(),
  latitud: z.number(),
  longitud: z.number(),
  descripcion: z.string().nullable(),
  detalles: z.record(z.string(), z.unknown()),
  delegacionId: z.string().uuid().nullable().optional(),
  creadoPorId: z.string().uuid(),
  actualizadoPorId: z.string().uuid().nullable().optional(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});

export type RecursoResponse = z.infer<typeof RecursoResponseSchema>;

/**
 * Esquema de validación para el identificador en los parámetros de ruta (/api/recursos/[id]).
 */
export const RecursoIdParamSchema = z.object({
  id: z.string().uuid("El identificador del recurso debe ser un UUID válido").openapi({
    description: "UUID del recurso logístico",
    example: "40000000-0000-4000-8000-000000000001",
  }),
});

export type RecursoIdParam = z.infer<typeof RecursoIdParamSchema>;

/**
 * Esquema de entrada para actualizar las características de un recurso existente (HU-8).
 * Notar que 'esIndividual' es inmutable tras la creación para salvaguardar la coherencia de inventario.
 */
export const ActualizarRecursoInputSchema = z.object({
  nombre: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").openapi({
    example: "Camioneta Rescate 4x4 - Actualizada",
  }),
  cantidadInventario: z
    .number({ message: "La cantidad en inventario es obligatoria" })
    .int("La cantidad debe ser un número entero")
    .min(0, "La cantidad en inventario no puede ser negativa")
    .openapi({ example: 1 }),
  cantidadMinima: z
    .number()
    .int("La cantidad mínima debe ser un número entero")
    .min(0, "La cantidad mínima no puede ser negativa")
    .default(0)
    .openapi({ example: 0 }),
  enMantencion: z
    .boolean()
    .optional()
    .default(false)
    .openapi({
      description:
        "Indica si el activo individual se encuentra fuera de servicio por mantenimiento técnico (solo aplica a recursos con esIndividual: true)",
      example: false,
    }),
  latitud: z
    .number({ message: "La latitud es obligatoria" })
    .min(-90, "La latitud debe estar entre -90 y 90")
    .max(90, "La latitud debe estar entre -90 y 90")
    .openapi({ example: -39.8142 }),
  longitud: z
    .number({ message: "La longitud es obligatoria" })
    .min(-180, "La longitud debe estar entre -180 y 180")
    .max(180, "La longitud debe estar entre -180 y 180")
    .openapi({ example: -73.2459 }),
  descripcion: z.string().trim().optional().nullable().openapi({
    example: "Unidad operativa de rescate en mantención preventiva",
  }),
  detalles: DetallesRecursoSchema.optional().default({}).openapi({
    description: "Especificaciones técnicas detalladas según el tipo de maquinaria",
  }),
  delegacionId: z
    .string()
    .uuid("Formato de UUID de delegación inválido")
    .optional()
    .nullable()
    .openapi({
      example: "30000000-0000-4000-8000-000000000001",
    }),
});

export type ActualizarRecursoInput = z.infer<typeof ActualizarRecursoInputSchema>;

/**
 * Esquema de respuesta con información completa de un recurso para consulta unitaria y edición.
 */
export const RecursoDetalleResponseSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  tipo: z.string().openapi({
    description: "Tipo legible (ej. 'Vehículo o Maquinaria' o 'Material o Insumo')",
    example: "Vehículo o Maquinaria",
  }),
  esIndividual: z.boolean(),
  estado: EstadoRecursoSchema,
  cantidadInventario: z.number().int(),
  cantidadEnUso: z.number().int(),
  cantidadDisponible: z.number().int(),
  cantidadMinima: z.number().int(),
  latitud: z.number(),
  longitud: z.number(),
  descripcion: z.string().nullable(),
  detalles: z.record(z.string(), z.unknown()),
  delegacion: z
    .object({
      id: z.string().uuid(),
      codigo: z.string(),
      nombre: z.string(),
    })
    .nullable()
    .openapi({
      description: "Datos de la delegación territorial de procedencia",
    }),
  delegacionId: z.string().uuid().nullable().optional(),
  creadoPorId: z.string().uuid(),
  actualizadoPorId: z.string().uuid().nullable().optional(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});

export type RecursoDetalleResponse = z.infer<typeof RecursoDetalleResponseSchema>;


/**
 * Parámetros de consulta (Query Params) para el listado paginado de inventario.
 */
export const ListarRecursosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1).openapi({
    description: "Número de página para paginación (inicia en 1)",
    example: 1,
  }),
  limite: z.coerce.number().int().min(1).max(100).default(10).openapi({
    description: "Cantidad de elementos por página (máximo 100)",
    example: 10,
  }),
  delegacionId: z.string().uuid().optional().openapi({
    description: "Filtrar por UUID de delegación territorial",
    example: "30000000-0000-4000-8000-000000000001",
  }),
  estado: EstadoRecursoSchema.optional().openapi({
    description: "Filtrar por estado de disponibilidad operativa",
    example: "DISPONIBLE",
  }),
  esIndividual: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .openapi({
      description: "Filtrar por tipo (true: individual/vehículo, false: a granel/material)",
      example: true,
    }),
  busqueda: z.string().trim().optional().openapi({
    description: "Búsqueda textual por nombre o descripción del recurso",
    example: "Camioneta",
  }),
  soloLectura: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .openapi({
      description: "Parámetro indicador de modo solo lectura para perfiles como Supervisor (HU-50)",
      example: true,
    }),
});

export type ListarRecursosQuery = z.infer<typeof ListarRecursosQuerySchema>;

/**
 * Esquema de respuesta para cada fila de recurso en la tabla de inventario.
 */
export const RecursoItemResponseSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  tipo: z.string().openapi({
    description: "Tipo legible (ej. 'Vehículo o Maquinaria' o 'Material o Insumo')",
    example: "Vehículo o Maquinaria",
  }),
  esIndividual: z.boolean(),
  estado: EstadoRecursoSchema,
  cantidadInventario: z.number().int(),
  cantidadEnUso: z.number().int(),
  cantidadDisponible: z.number().int().openapi({
    description: "Cantidad libre disponible (cantidadInventario - cantidadEnUso)",
    example: 1,
  }),
  cantidadMinima: z.number().int(),
  latitud: z.number(),
  longitud: z.number(),
  descripcion: z.string().nullable(),
  detalles: z.record(z.string(), z.unknown()),
  delegacion: z
    .object({
      id: z.string().uuid(),
      codigo: z.string(),
      nombre: z.string(),
    })
    .nullable()
    .openapi({
      description: "Datos de la delegación territorial de procedencia",
    }),
  creadoPorId: z.string().uuid(),
  creadoEn: z.string(),
  actualizadoEn: z.string(),
});

export type RecursoItemResponse = z.infer<typeof RecursoItemResponseSchema>;

/**
 * Respuesta completa paginada para GET /api/recursos.
 */
export const ListarRecursosPaginadosResponseSchema = z.object({
  data: z.array(RecursoItemResponseSchema).openapi({
    description: "Listado de recursos en la página solicitada (vacío si no hay recursos)",
  }),
  meta: z.object({
    total: z.number().int().openapi({ description: "Total general de registros coincidentes" }),
    pagina: z.number().int().openapi({ description: "Página actual" }),
    limite: z.number().int().openapi({ description: "Límite de elementos por página" }),
    totalPaginas: z.number().int().openapi({ description: "Cantidad total de páginas disponibles" }),
  }),
});

export type ListarRecursosPaginadosResponse = z.infer<
  typeof ListarRecursosPaginadosResponseSchema
>;
