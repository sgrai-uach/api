import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/**
 * Niveles de prioridad/gravedad homologados con la tabla incidente (ICS).
 */
export const PrioridadPuntoCriticoSchema = z.enum([
  "BAJA",
  "MEDIA",
  "ALTA",
  "CRITICA",
]);

export type PrioridadPuntoCritico = z.infer<typeof PrioridadPuntoCriticoSchema>;

/**
 * Parámetros de consulta (Query Params) para el listado de puntos críticos (HU-57).
 */
export const ListarPuntosCriticosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1).openapi({
    description: "Número de página actual (inicia en 1)",
    example: 1,
  }),
  limite: z.coerce.number().int().min(1).max(100).default(10).openapi({
    description: "Cantidad de elementos por página (máximo 100)",
    example: 10,
  }),
  delegacionId: z.string().uuid("UUID de delegación territorial inválido").optional().openapi({
    description: "Filtrar por identificador de la delegación territorial",
    example: "30000000-0000-4000-8000-000000000001",
  }),
  activo: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .openapi({
      description: "Filtrar por estado activo/inactivo del punto crítico",
      example: true,
    }),
  prioridad: PrioridadPuntoCriticoSchema.optional().openapi({
    description: "Filtrar por gravedad/prioridad de riesgo",
    example: "ALTA",
  }),
  busqueda: z.string().trim().optional().openapi({
    description: "Búsqueda textual insensible a mayúsculas por código, nombre, tipo de riesgo o descripción",
    example: "Angachilla",
  }),
});

export type ListarPuntosCriticosQuery = z.infer<typeof ListarPuntosCriticosQuerySchema>;
export type ListarPuntosCriticosInput = z.input<typeof ListarPuntosCriticosQuerySchema>;

/**
 * Esquema representativo de la delegación asociada al punto crítico.
 */
export const DelegacionPuntoCriticoSchema = z.object({
  id: z.string().uuid().openapi({ example: "30000000-0000-4000-8000-000000000001" }),
  codigo: z.string().openapi({ example: "DEL-SUR" }),
  nombre: z.string().openapi({ example: "Delegación Municipal Sur" }),
});

/**
 * Esquema de respuesta para cada fila en la vista y tabla de puntos críticos (HU-57).
 */
export const PuntoCriticoItemResponseSchema = z.object({
  id: z.string().uuid().openapi({
    description: "Identificador único (UUID) del punto crítico",
    example: "40000000-0000-4000-8000-000000000001",
  }),
  codigo: z.string().openapi({
    description: "Código institucional único (ej. PC-ANG-01)",
    example: "PC-ANG-01",
  }),
  nombre: z.string().openapi({
    description: "Nombre descriptivo del punto crítico o sector vulnerable",
    example: "Sector Humedal Angachilla - Pasaje Los Robles",
  }),
  descripcion: z.string().nullable().openapi({
    description: "Detalle situacional y factores de riesgo del sector",
    example: "Zona baja propensa a anegamiento por desborde en temporada invernal",
  }),
  tipoRiesgo: z.string().nullable().openapi({
    description: "Clasificación de la amenaza recurrente",
    example: "Inundación y desborde de cauce",
  }),
  prioridad: PrioridadPuntoCriticoSchema.openapi({
    description: "Nivel de gravedad o prioridad operativa homologado con incidentes",
    example: "ALTA",
  }),
  activo: z.boolean().openapi({
    description: "Estado actual de vigencia operativa del punto crítico",
    example: true,
  }),
  estadoTexto: z.string().openapi({
    description: "Etiqueta textual legible de estado para la vista de usuario",
    example: "Activo",
  }),
  latitud: z.number().openapi({
    description: "Coordenada latitud EPSG:4326",
    example: -39.8456,
  }),
  longitud: z.number().openapi({
    description: "Coordenada longitud EPSG:4326",
    example: -73.2389,
  }),
  delegacion: DelegacionPuntoCriticoSchema.nullable().openapi({
    description: "Delegación municipal territorial de pertenencia",
  }),
  creadoEn: z.string().openapi({
    description: "Fecha y hora de registro en formato ISO-8601",
    example: "2026-06-15T12:00:00.000Z",
  }),
});

export type PuntoCriticoItemResponse = z.infer<typeof PuntoCriticoItemResponseSchema>;

/**
 * Esquema de respuesta paginada estandarizada compatible con HU-52 y HU-7.
 */
export const ListarPuntosCriticosResponseSchema = z.object({
  data: z.array(PuntoCriticoItemResponseSchema).openapi({
    description: "Colección de puntos críticos almacenados",
  }),
  meta: z.object({
    total: z.number().int().openapi({ example: 1 }),
    pagina: z.number().int().openapi({ example: 1 }),
    limite: z.number().int().openapi({ example: 10 }),
    totalPaginas: z.number().int().openapi({ example: 1 }),
  }),
});

export type ListarPuntosCriticosResponse = z.infer<typeof ListarPuntosCriticosResponseSchema>;

/**
 * Esquema de respuesta para el detalle o resultado de creación de un punto crítico (HU-58).
 */
export const PuntoCriticoDetalleResponseSchema = PuntoCriticoItemResponseSchema.extend({
  creadoPorId: z.string().uuid().nullable().optional().openapi({
    description: "UUID del administrador responsable de la creación del punto crítico",
    example: "00000000-0000-4000-8000-000000000001",
  }),
});

export type PuntoCriticoDetalleResponse = z.infer<typeof PuntoCriticoDetalleResponseSchema>;

/**
 * Opciones canónicas de tipo de riesgo sugeridas para el frontend (HU-58).
 * Se almacenan como VARCHAR(100) en base de datos para máxima flexibilidad y retrocompatibilidad.
 */
export const TIPOS_RIESGO_PUNTO_CRITICO = [
  "Inundación y anegamiento",
  "Deslizamiento / Remoción en masa",
  "Desborde de cauce / humedal",
  "Incendio forestal / pastizales",
  "Colapso estructural / socavón",
  "Viento / Voladura de techumbres",
  "Otro",
] as const;

/**
 * Esquema de validación del cuerpo de petición (Body) para crear un nuevo punto crítico (HU-58).
 * El código institucional se autogenera en el backend.
 */
export const CrearPuntoCriticoBodySchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre debe tener al menos 3 caracteres.")
    .max(150, "El nombre no puede exceder los 150 caracteres.")
    .openapi({
      description: "Nombre descriptivo del punto crítico o sector vulnerable",
      example: "Sector Humedal Angachilla - Pasaje Los Robles",
    }),
  descripcion: z
    .string()
    .trim()
    .max(1000, "La descripción no puede exceder los 1000 caracteres.")
    .nullish()
    .transform((val) => (val === "" ? null : val))
    .openapi({
      description: "Detalle situacional y factores de riesgo del sector",
      example: "Zona baja propensa a anegamiento por desborde en temporada invernal",
    }),
  tipoRiesgo: z
    .string()
    .trim()
    .max(100, "El tipo de riesgo no puede exceder los 100 caracteres.")
    .nullish()
    .transform((val) => (val === "" ? null : val))
    .openapi({
      description:
        "Clasificación de la amenaza recurrente (VARCHAR hasta 100 caracteres). Sugerencias: Inundación y anegamiento, Deslizamiento / Remoción en masa, Desborde de cauce / humedal, Incendio forestal / pastizales, Colapso estructural / socavón, Viento / Voladura de techumbres, Otro.",
      example: "Inundación y anegamiento",
    }),
  prioridad: z
    .string()
    .optional()
    .default("MEDIA")
    .transform((val): PrioridadPuntoCritico => {
      const upper = (val || "MEDIA").toUpperCase().trim();
      if (upper.startsWith("CRITIC")) return "CRITICA";
      if (upper.startsWith("ALT")) return "ALTA";
      if (upper.startsWith("MED")) return "MEDIA";
      if (upper.startsWith("BAJ")) return "BAJA";
      return "MEDIA";
    })
    .openapi({
      description: "Nivel de gravedad o prioridad operativa homologado con incidentes",
      example: "ALTA",
    }),
  delegacionId: z
    .string()
    .nullish()
    .transform((val) => (val === "" || val === "null" ? null : val))
    .refine((val) => val === null || val === undefined || z.string().uuid().safeParse(val).success, {
      message: "Identificador UUID de delegación territorial inválido.",
    })
    .openapi({
      description: "UUID de la delegación municipal territorial asignada",
      example: "30000000-0000-4000-8000-000000000001",
    }),
  latitud: z.coerce
    .number()
    .min(-90, "La latitud debe ser mayor o igual a -90.")
    .max(90, "La latitud debe ser menor o igual a 90.")
    .openapi({
      description: "Coordenada latitud WGS84 EPSG:4326",
      example: -39.8456,
    }),
  longitud: z.coerce
    .number()
    .min(-180, "La longitud debe ser mayor o igual a -180.")
    .max(180, "La longitud debe ser menor o igual a 180.")
    .openapi({
      description: "Coordenada longitud WGS84 EPSG:4326",
      example: -73.2389,
    }),
});

export type CrearPuntoCriticoBody = z.infer<typeof CrearPuntoCriticoBodySchema>;
export type CrearPuntoCriticoInput = z.input<typeof CrearPuntoCriticoBodySchema>;
