import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const EstadoEventoAsistenciaSocialSchema = z.enum([
  "PENDIENTE",
  "ASIGNADO",
  "EN_EVALUACION_FIBE",
  "FINALIZADO",
  "DESCARTADO",
]);

export type EstadoEventoAsistenciaSocial = z.infer<typeof EstadoEventoAsistenciaSocialSchema>;

export const PrioridadEventoAsistenciaSocialSchema = z.enum([
  "BAJA",
  "MEDIA",
  "ALTA",
  "CRITICA",
]);

export type PrioridadEventoAsistenciaSocial = z.infer<typeof PrioridadEventoAsistenciaSocialSchema>;

/**
 * Esquema de entrada para crear un evento excepcional de asistencia social (H28).
 * Diseñado para cubrir casos excepcionales de requerimiento de levantamiento de FIBE
 * sin necesidad de estar vinculado a un registro previo en la entidad Incidente.
 */
export const CrearEventoAsistenciaSocialInputSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(5, "La descripción de la excepcionalidad debe tener al menos 5 caracteres")
    .max(1500, "La descripción no puede superar los 1500 caracteres")
    .openapi({
      description: "Descripción de la situación de excepcionalidad y motivos del levantamiento de FIBE",
      example: "Familia de 4 integrantes con vivienda inundada por desborde secundario fuera de radio de incidente.",
    }),
  tipoAfectacion: z
    .string()
    .trim()
    .min(2, "El tipo de afectación debe tener al menos 2 caracteres")
    .max(50, "El tipo de afectación no puede superar los 50 caracteres")
    .openapi({
      description: "Clasificación principal del tipo de daño o vulnerabilidad habitacional",
      example: "VIVIENDA_ANEGADA",
    }),
  direccionTexto: z
    .string()
    .trim()
    .min(3, "La dirección o referencia del lugar debe tener al menos 3 caracteres")
    .max(255, "La dirección no puede superar los 255 caracteres")
    .openapi({
      description: "Dirección física o punto de referencia territorial en Valdivia",
      example: "Calle Los Alerces 1420, Sector Collico",
    }),
  latitud: z
    .coerce
    .number()
    .min(-90, "La latitud debe estar entre -90 y 90 grados")
    .max(90, "La latitud debe estar entre -90 y 90 grados")
    .openapi({
      description: "Coordenada latitud en formato WGS84 capturada en mapa",
      example: -39.8234,
    }),
  longitud: z
    .coerce
    .number()
    .min(-180, "La longitud debe estar entre -180 y 180 grados")
    .max(180, "La longitud debe estar entre -180 y 180 grados")
    .openapi({
      description: "Coordenada longitud en formato WGS84 capturada en mapa",
      example: -73.2189,
    }),
  personasAfectadas: z
    .coerce
    .number()
    .int("La cantidad de personas afectadas debe ser un número entero")
    .min(0, "La cantidad de personas afectadas no puede ser negativa")
    .default(0)
    .openapi({
      description: "Número estimado de personas afectadas en el inmueble",
      example: 4,
    }),
  familiasAfectadas: z
    .coerce
    .number()
    .int("La cantidad de familias afectadas debe ser un número entero")
    .min(0, "La cantidad de familias afectadas no puede ser negativa")
    .default(0)
    .openapi({
      description: "Número estimado de grupos familiares afectados",
      example: 1,
    }),
  prioridad: PrioridadEventoAsistenciaSocialSchema.default("MEDIA").openapi({
    description: "Nivel de urgencia o prioridad social preliminar",
    example: "ALTA",
  }),
  contactoNombre: z
    .string()
    .trim()
    .max(150, "El nombre de contacto no puede superar 150 caracteres")
    .optional()
    .nullable()
    .openapi({
      description: "Nombre de la persona de contacto o jefe/a de hogar",
      example: "María González",
    }),
  contactoTelefono: z
    .string()
    .trim()
    .max(50, "El teléfono de contacto no puede superar 50 caracteres")
    .optional()
    .nullable()
    .openapi({
      description: "Teléfono de contacto preliminar",
      example: "+56912345678",
    }),
  contactoRut: z
    .string()
    .trim()
    .max(20, "El RUT de contacto no puede superar 20 caracteres")
    .optional()
    .nullable()
    .openapi({
      description: "RUT preliminar del contacto o afectado",
      example: "12.345.678-9",
    }),
  delegacionId: z
    .string()
    .uuid("El UUID de delegación es inválido")
    .optional()
    .nullable()
    .openapi({
      description: "Identificador de la delegación territorial correspondiente",
      example: "30000000-0000-4000-8000-000000000001",
    }),
  incidenteId: z
    .string()
    .uuid("El UUID de incidente debe ser válido si se proporciona")
    .optional()
    .nullable()
    .openapi({
      description: "Identificador opcional de incidente previo (nulo para casos excepcionales independientes)",
      example: null,
    }),
});

export type CrearEventoAsistenciaSocialInput = z.infer<
  typeof CrearEventoAsistenciaSocialInputSchema
>;

/**
 * Parámetros de consulta (Query Params) para listar los eventos de asistencia social.
 */
export const ListarEventosAsistenciaSocialQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1).openapi({
    description: "Número de página actual (inicia en 1)",
    example: 1,
  }),
  limite: z.coerce.number().int().min(1).max(100).default(10).openapi({
    description: "Cantidad de elementos por página (máximo 100)",
    example: 10,
  }),
  estado: EstadoEventoAsistenciaSocialSchema.optional().openapi({
    description: "Filtrar por estado del ciclo de vida (ej. PENDIENTE)",
    example: "PENDIENTE",
  }),
  delegacionId: z
    .string()
    .uuid("UUID de delegación territorial inválido")
    .optional()
    .openapi({
      description: "Filtrar por delegación municipal territorial",
      example: "30000000-0000-4000-8000-000000000001",
    }),
  prioridad: PrioridadEventoAsistenciaSocialSchema.optional().openapi({
    description: "Filtrar por prioridad o urgencia social",
    example: "ALTA",
  }),
  busqueda: z
    .string()
    .trim()
    .optional()
    .openapi({
      description: "Búsqueda textual insensible a mayúsculas por código, descripción, dirección o contacto",
      example: "Collico",
    }),
});

export type ListarEventosAsistenciaSocialQuery = z.infer<
  typeof ListarEventosAsistenciaSocialQuerySchema
>;

/**
 * Esquema de respuesta para un evento de asistencia social.
 */
export const EventoAsistenciaSocialResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: "70000000-0000-4000-8000-000000000001" }),
  codigo: z.string().openapi({ example: "AS-2026-0001" }),
  descripcion: z.string().openapi({ example: "Familia de 4 integrantes con vivienda inundada." }),
  tipoAfectacion: z.string().openapi({ example: "VIVIENDA_ANEGADA" }),
  personasAfectadas: z.number().int().openapi({ example: 4 }),
  familiasAfectadas: z.number().int().openapi({ example: 1 }),
  direccionTexto: z.string().openapi({ example: "Calle Los Alerces 1420, Sector Collico" }),
  latitud: z.number().openapi({ example: -39.8234 }),
  longitud: z.number().openapi({ example: -73.2189 }),
  prioridad: PrioridadEventoAsistenciaSocialSchema.openapi({ example: "ALTA" }),
  estado: EstadoEventoAsistenciaSocialSchema.openapi({ example: "PENDIENTE" }),
  contactoNombre: z.string().nullable().openapi({ example: "María González" }),
  contactoTelefono: z.string().nullable().openapi({ example: "+56912345678" }),
  contactoRut: z.string().nullable().openapi({ example: "12.345.678-9" }),
  delegacionId: z.string().uuid().nullable().openapi({ example: "30000000-0000-4000-8000-000000000001" }),
  delegacionNombre: z.string().nullable().openapi({ example: "Delegación Municipal Costa" }),
  incidenteId: z.string().uuid().nullable().openapi({ example: null }),
  asistenteSocialId: z.string().uuid().nullable().openapi({ example: null }),
  asistenteSocialNombre: z.string().nullable().openapi({ example: null }),
  creadoPor: z
    .object({
      id: z.string().uuid().openapi({ example: "00000000-0000-4000-8000-000000000003" }),
      nombre: z.string().openapi({ example: "Encargado de Operaciones" }),
    })
    .openapi({ description: "Funcionario responsable de la creación del evento" }),
  creadoEn: z.string().datetime().openapi({ example: "2026-10-05T12:00:00.000Z" }),
  actualizadoEn: z.string().datetime().openapi({ example: "2026-10-05T12:00:00.000Z" }),
});

export type EventoAsistenciaSocialResponse = z.infer<
  typeof EventoAsistenciaSocialResponseSchema
>;

/**
 * Esquema de respuesta para el listado paginado de eventos de asistencia social.
 */
export const ListarEventosAsistenciaSocialResponseSchema = z.object({
  data: z.array(EventoAsistenciaSocialResponseSchema),
  total: z.number().int().openapi({ example: 1 }),
  pagina: z.number().int().openapi({ example: 1 }),
  limite: z.number().int().openapi({ example: 10 }),
  totalPaginas: z.number().int().openapi({ example: 1 }),
});

export type ListarEventosAsistenciaSocialResponse = z.infer<
  typeof ListarEventosAsistenciaSocialResponseSchema
>;
