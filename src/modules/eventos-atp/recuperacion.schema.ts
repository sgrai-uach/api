import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const EstadoRecuperacionSchema = z.enum([
  "PLANIFICADA",
  "EN_EJECUCION",
  "COMPLETADA",
  "CANCELADA",
]);

export const PrioridadRecuperacionSchema = z.enum([
  "BAJA",
  "MEDIA",
  "ALTA",
  "CRITICA",
]);

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

/**
 * Parámetro UUID de ruta para /api/eventos-atp/recuperacion/[id]
 */
export const RecuperacionIdParamSchema = z.object({
  id: z.string().uuid("El identificador del evento de recuperación debe ser un UUID válido").openapi({
    description: "UUID del evento de recuperación",
    example: "70000000-0000-4000-8000-000000000001",
  }),
});

export type RecuperacionIdParam = z.infer<typeof RecuperacionIdParamSchema>;

/**
 * Esquema de entrada para asignar patrulla y recursos a un evento de recuperación existente (HU-32).
 */
export const AsignarRecursosRecuperacionInputSchema = z.object({
  patrullaId: z.string().uuid("El UUID de la patrulla verificadora es obligatorio y debe ser válido").openapi({
    description: "Identificador de la patrulla verificadora disponible a asignar",
    example: "50000000-0000-4000-8000-000000000001",
  }),
  recursos: z.array(ItemRecursoSolicitadoSchema).min(1, "Debe asignar al menos un recurso al evento de recuperación").openapi({
    description: "Listado de insumos y recursos logísticos a entregar",
  }),
});

export type AsignarRecursosRecuperacionInput = z.infer<typeof AsignarRecursosRecuperacionInputSchema>;

/**
 * Detalle del recurso asignado devuelto en la asignación HU-32.
 */
export const RecursoAsignadoDetalleSchema = z.object({
  recursoId: z.string().uuid().openapi({ example: "00000000-0000-4000-8000-000000000001" }),
  nombre: z.string().openapi({ example: "Sacos de Arena 25kg" }),
  esIndividual: z.boolean().openapi({ example: false }),
  cantidadAsignada: z.number().openapi({ example: 10 }),
  cantidadEnUso: z.number().openapi({ example: 10 }),
  estadoRecurso: z.string().openapi({ example: "DISPONIBLE" }),
});

export type RecursoAsignadoDetalle = z.infer<typeof RecursoAsignadoDetalleSchema>;

/**
 * Datos de respuesta para la asignación de recursos y patrulla (HU-32).
 */
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

/**
 * Esquema de detalle del evento de recuperación (GET /api/eventos-atp/recuperacion/[id]).
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
  ).openapi({ description: "Misiones tácticas vinculadas al evento" }),
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
  ).openapi({ description: "Historial de insumos y herramientas asignados" }),
  creadoPorId: z.string().uuid().openapi({ description: "Identificador del creador" }),
  creadoEn: z.string().openapi({ description: "Fecha de registro ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Fecha de última actualización ISO 8601" }),
});

export type RecuperacionDetalleResponseData = z.infer<typeof RecuperacionDetalleResponseDataSchema>;

export const RecuperacionDetalleResponseSchema = z.object({
  message: z.string().openapi({ example: "Detalle del evento de recuperación obtenido exitosamente." }),
  data: RecuperacionDetalleResponseDataSchema,
});

export type RecuperacionDetalleResponse = z.infer<typeof RecuperacionDetalleResponseSchema>;

