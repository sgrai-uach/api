import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
} from "@/lib/shared/pagination.schema";

extendZodWithOpenApi(z);

/**
 * Estados canónicos del ciclo de vida operativo de una Patrulla Verificadora en base de datos.
 */
export const EstadoPatrullaEnum = z.enum([
  "DISPONIBLE",
  "EN_VERIFICACION",
  "EN_PREVENCION",
  "EN_RECUPERACION",
  "EN_MISION",
  "NO_DISPONIBLE",
]);

export type EstadoPatrullaType = z.infer<typeof EstadoPatrullaEnum>;

/**
 * Parámetros de consulta para listar patrullas verificadoras con paginación estricta y filtros.
 */
export const ListarPatrullasQuerySchema = PaginationQuerySchema.extend({
  delegacionId: z
    .string()
    .uuid("El parámetro delegacionId debe ser un UUID válido.")
    .optional()
    .openapi({
      description: "Filtrar por UUID de delegación territorial municipal asignada",
      example: "30000000-0000-4000-8000-000000000001",
    }),
  estado: EstadoPatrullaEnum.optional().openapi({
    description: "Filtrar por estado operativo canónico de la patrulla",
    example: "DISPONIBLE",
  }),
  busqueda: z
    .string()
    .trim()
    .min(1)
    .optional()
    .openapi({
      description: "Búsqueda textual sobre el nombre de la patrulla o nombre del líder",
      example: "Costa",
    }),
});

export type ListarPatrullasQuery = z.infer<typeof ListarPatrullasQuerySchema>;

/**
 * Esquema de validación para el identificador UUID de patrulla en parámetros de ruta.
 */
export const PatrullaIdParamSchema = z
  .string()
  .uuid("El identificador de la patrulla debe ser un UUID válido.")
  .openapi({
    description: "Identificador único UUID de la patrulla verificadora",
    example: "f1000000-0000-4000-8000-000000000001",
  });

/**
 * Esquema para funcionario de terreno asignado a la dotación de la patrulla.
 */
export const IntegrantePatrullaSchema = z.object({
  id: z.string().uuid().openapi({ description: "UUID de ficha en tabla personal" }),
  usuarioId: z.string().uuid().openapi({ description: "UUID de usuario en tabla usuario" }),
  nombre: z.string().openapi({ description: "Nombre completo del funcionario" }),
  email: z.string().email().openapi({ description: "Correo institucional" }),
  telefono: z.string().nullable().openapi({ description: "Teléfono de contacto o móvil de terreno" }),
  rut: z.string().nullable().openapi({ description: "RUT del funcionario" }),
  cargo: z.string().nullable().openapi({ description: "Cargo del funcionario" }),
  especialidad: z.string().nullable().openapi({ description: "Especialidad técnica" }),
  rolEnPatrulla: z.string().openapi({ description: "Rol dentro de la patrulla (ej. OPERATIVO, LIDER, CONDUCTOR)" }),
  estadoOperativo: z.string().openapi({ description: "Estado operativo individual del personal" }),
});

export type IntegrantePatrullaDTO = z.infer<typeof IntegrantePatrullaSchema>;

/**
 * Esquema para la misión e incidente formal activo en atención por la patrulla.
 */
export const MisionActivaPatrullaSchema = z.object({
  id: z.string().uuid().openapi({ description: "UUID de la misión activa" }),
  codigo: z.string().openapi({ description: "Código oficial de la misión (ej. MIS-2026-0001)" }),
  titulo: z.string().openapi({ description: "Título de la misión" }),
  tipoMision: z.string().openapi({ description: "Tipo de misión (VERIFICACION, PREVENCION, etc.)" }),
  estado: z.string().openapi({ description: "Estado de la misión (PLANIFICADA, DESPACHADA, EN_CURSO)" }),
  prioridad: z.string().openapi({ description: "Prioridad del incidente o misión" }),
  incidenteId: z.string().uuid().nullable().openapi({ description: "UUID del incidente formal asociado" }),
  incidenteCodigo: z.string().nullable().openapi({ description: "Código del incidente formal (ej. INC-2026-0001)" }),
  incidenteFolio: z.string().nullable().openapi({ description: "Folio de seguimiento del incidente" }),
  incidenteTipoAfectacion: z.string().nullable().openapi({ description: "Tipo de afectación del incidente" }),
  incidenteDireccion: z.string().nullable().openapi({ description: "Dirección o ubicación del incidente" }),
});

export type MisionActivaPatrullaDTO = z.infer<typeof MisionActivaPatrullaSchema>;

/**
 * Esquema para vehículo institucional asignado a la patrulla verificadora.
 */
export const VehiculoPatrullaSchema = z.object({
  id: z.string().uuid().openapi({ description: "UUID del recurso vehicular asignado" }),
  nombre: z.string().openapi({ description: "Nombre o descripción del vehículo" }),
  detalles: z.record(z.string(), z.unknown()).optional().openapi({ description: "Metadatos técnicos como patente" }),
  estado: z.string().openapi({ description: "Estado de disponibilidad del vehículo" }),
});

export type VehiculoPatrullaDTO = z.infer<typeof VehiculoPatrullaSchema>;

/**
 * Elemento unitario en el listado de patrullas verificadoras para el Centro de Mando.
 */
export const PatrullaItemResponseSchema = z.object({
  id: z.string().uuid().openapi({ description: "UUID de la patrulla verificadora" }),
  codigo: z
    .string()
    .optional()
    .openapi({ description: "Código identificador único de la patrulla (ej. PV-NORTE-01)" }),
  nombre: z.string().openapi({ description: "Nombre identificador de la patrulla" }),
  estado: EstadoPatrullaEnum.openapi({ description: "Estado operativo canónico de la patrulla" }),
  latitud: z.number().nullable().openapi({ description: "Coordenada latitud WGS84 actual de la patrulla" }),
  longitud: z.number().nullable().openapi({ description: "Coordenada longitud WGS84 actual de la patrulla" }),
  ultimaActualizacionUbicacion: z
    .string()
    .nullable()
    .openapi({ description: "Timestamp ISO de última actualización de coordenadas" }),
  delegacion: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
      codigo: z.string().nullable(),
    })
    .nullable()
    .openapi({ description: "Delegación territorial asignada" }),
  vehiculo: VehiculoPatrullaSchema.nullable().optional().openapi({
    description: "Vehículo institucional individual asignado",
  }),
  lider: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
      email: z.string().email(),
      telefono: z.string().nullable(),
      rut: z.string().nullable(),
    })
    .nullable()
    .openapi({ description: "Funcionario líder responsable de la patrulla (usuario_lider_id)" }),
  integrantes: z
    .array(IntegrantePatrullaSchema)
    .openapi({ description: "Lista de funcionarios de terreno conformando la patrulla" }),
  misionActiva: MisionActivaPatrullaSchema.nullable().openapi({
    description: "Misión táctica e incidente en curso actualmente atendido por la patrulla",
  }),
  creadoEn: z.string().openapi({ description: "Fecha ISO de conformación de la patrulla" }),
  actualizadoEn: z.string().openapi({ description: "Fecha ISO de última actualización" }),
});

export type PatrullaItemResponseDTO = z.infer<typeof PatrullaItemResponseSchema>;

/**
 * Respuesta paginada estándar para GET /api/patrullas.
 */
export const ListarPatrullasResponseSchema = z.object({
  message: z.string().openapi({ description: "Mensaje de resultado" }),
  data: z.array(PatrullaItemResponseSchema).openapi({ description: "Colección de patrullas verificadoras" }),
  meta: PaginationMetaSchema.openapi({ description: "Metadatos estándar de paginación SGRAI" }),
});

export type ListarPatrullasResponseDTO = z.infer<typeof ListarPatrullasResponseSchema>;

/**
 * Esquema de respuesta para detalle unitario de una patrulla verificadora.
 */
export const PatrullaDetalleResponseSchema = z.object({
  message: z.string().openapi({ description: "Mensaje de resultado" }),
  data: PatrullaItemResponseSchema.openapi({ description: "Detalle completo de la patrulla verificadora" }),
});

export type PatrullaDetalleResponseDTO = z.infer<typeof PatrullaDetalleResponseSchema>;

/**
 * Entrada para actualizar el estado operativo y/o geolocalización de una patrulla (PATCH /api/patrullas/:id).
 */
export const ActualizarEstadoPatrullaInputSchema = z.object({
  estado: EstadoPatrullaEnum.openapi({
    description: "Nuevo estado operativo canónico",
    example: "DISPONIBLE",
  }),
  motivo: z.string().trim().max(500).optional().openapi({
    description: "Justificación o motivo operacional del cambio de estado",
  }),
  latitud: z.number().min(-90).max(90).optional().openapi({
    description: "Nueva coordenada de latitud WGS84",
    example: -39.819588,
  }),
  longitud: z.number().min(-180).max(180).optional().openapi({
    description: "Nueva coordenada de longitud WGS84",
    example: -73.245209,
  }),
});

export type ActualizarEstadoPatrullaInputDTO = z.infer<typeof ActualizarEstadoPatrullaInputSchema>;

/**
 * Respuesta tras actualizar el estado de una patrulla.
 */
export const ActualizarEstadoPatrullaResponseSchema = z.object({
  message: z.string().openapi({ description: "Mensaje de confirmación" }),
  data: PatrullaItemResponseSchema.openapi({ description: "Patrulla verificadora con estado actualizado" }),
});

export type ActualizarEstadoPatrullaResponseDTO = z.infer<
  typeof ActualizarEstadoPatrullaResponseSchema
>;

/**
 * Entrada para crear y registrar una nueva patrulla verificadora (POST /api/patrullas).
 */
export const CrearPatrullaInputSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(3, "El código identificador debe tener al menos 3 caracteres.")
    .max(50, "El código identificador no puede exceder 50 caracteres.")
    .regex(/^[A-Za-z0-9\-_]+$/, "El código solo puede contener letras, números, guiones y guiones bajos.")
    .openapi({
      description: "Código identificador único de la patrulla (ej. PV-NORTE-01)",
      example: "PV-NORTE-01",
    }),
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre de la patrulla debe tener al menos 3 caracteres.")
    .max(100, "El nombre de la patrulla no puede exceder 100 caracteres.")
    .optional()
    .openapi({
      description: "Nombre descriptivo de la patrulla (si se omite, se utiliza el código)",
      example: "Patrulla Norte 01",
    }),
  delegacionId: z
    .string()
    .uuid("El parámetro delegacionId debe ser un UUID válido.")
    .openapi({
      description: "UUID de la delegación municipal base",
      example: "30000000-0000-4000-8000-000000000001",
    }),
  vehiculoId: z
    .string()
    .uuid("El identificador del vehículo debe ser un UUID válido.")
    .nullable()
    .optional()
    .openapi({
      description: "UUID del vehículo institucional asignado (recurso individualizado)",
      example: "e1000000-0000-4000-8000-000000000002",
    }),
  personalIds: z
    .array(z.string().uuid("Cada integrante debe ser un UUID válido."))
    .min(1, "Debe asignar al menos un funcionario con rol PATRULLA_VERIFICADORA.")
    .openapi({
      description: "Lista de UUIDs de personal asignado a la dotación de la patrulla",
      example: ["b1000000-0000-4000-8000-000000000001"],
    }),
  usuarioLiderId: z
    .string()
    .uuid("El usuarioLiderId debe ser un UUID válido.")
    .nullable()
    .optional()
    .openapi({
      description: "UUID del usuario líder de la patrulla (opcional; si se omite, se asigna al primer integrante)",
    }),
});

export type CrearPatrullaInputDTO = z.infer<typeof CrearPatrullaInputSchema>;

/**
 * Respuesta tras registrar exitosamente una nueva patrulla verificadora.
 */
export const CrearPatrullaResponseSchema = z.object({
  message: z.string().openapi({ description: "Mensaje descriptivo del resultado" }),
  data: PatrullaItemResponseSchema.openapi({ description: "Patrulla verificadora registrada exitosamente" }),
});

export type CrearPatrullaResponseDTO = z.infer<typeof CrearPatrullaResponseSchema>;

/**
 * Entrada para modificar una patrulla verificadora registrada (PUT /api/patrullas/:id).
 * Permite reasignar delegación base, vehículo institucional y dotación de funcionarios.
 */
export const ModificarPatrullaInputSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre de la patrulla debe tener al menos 3 caracteres.")
    .max(100, "El nombre de la patrulla no puede exceder 100 caracteres.")
    .optional()
    .openapi({
      description: "Nombre descriptivo de la patrulla verificadora",
      example: "Patrulla Norte 01",
    }),
  delegacionId: z
    .string()
    .uuid("El parámetro delegacionId debe ser un UUID válido.")
    .openapi({
      description: "UUID de la delegación municipal base adscrita",
      example: "30000000-0000-4000-8000-000000000001",
    }),
  vehiculoId: z
    .string()
    .uuid("El identificador del vehículo debe ser un UUID válido.")
    .nullable()
    .optional()
    .openapi({
      description: "UUID del vehículo institucional asignado (recurso individualizado o null para desasignar)",
      example: "e1000000-0000-4000-8000-000000000002",
    }),
  personalIds: z
    .array(z.string().uuid("Cada integrante debe ser un UUID válido."))
    .min(1, "Debe asignar al menos un funcionario a la dotación de la patrulla.")
    .openapi({
      description: "Lista de UUIDs de personal asignado a la dotación de la patrulla",
      example: ["b1000000-0000-4000-8000-000000000001"],
    }),
  usuarioLiderId: z
    .string()
    .uuid("El usuarioLiderId debe ser un UUID válido.")
    .nullable()
    .optional()
    .openapi({
      description: "UUID del usuario líder de la patrulla (opcional; si se omite, se asigna al primer integrante)",
    }),
});

export type ModificarPatrullaInputDTO = z.infer<typeof ModificarPatrullaInputSchema>;

/**
 * Respuesta tras modificar exitosamente una patrulla verificadora.
 */
export const ModificarPatrullaResponseSchema = z.object({
  message: z.string().openapi({ description: "Mensaje descriptivo del resultado" }),
  data: PatrullaItemResponseSchema.openapi({ description: "Patrulla verificadora modificada exitosamente" }),
});

export type ModificarPatrullaResponseDTO = z.infer<typeof ModificarPatrullaResponseSchema>;

/**
 * Respuesta tras desactivar (baja lógica) una patrulla verificadora (DELETE /api/patrullas/:id, HU-85).
 */
export const DesactivarPatrullaResponseSchema = z.object({
  message: z.string().openapi({ description: "Mensaje descriptivo del resultado" }),
  data: z
    .object({
      id: z.string().uuid().openapi({ description: "UUID de la patrulla verificadora desactivada" }),
      codigo: z.string().nullable().optional().openapi({ description: "Código identificador de la patrulla" }),
      nombre: z.string().openapi({ description: "Nombre de la patrulla" }),
      estado: EstadoPatrullaEnum.openapi({ description: "Estado de la patrulla tras la baja (NO_DISPONIBLE)" }),
      activo: z.boolean().openapi({ description: "Indicador de baja lógica (false)" }),
      eliminadoEn: z.string().openapi({ description: "Fecha y hora ISO de la baja lógica" }),
      eliminadoPorId: z
        .string()
        .uuid()
        .nullable()
        .optional()
        .openapi({ description: "UUID del usuario responsable de la baja" }),
      vehiculoLiberadoId: z
        .string()
        .uuid()
        .nullable()
        .optional()
        .openapi({ description: "UUID del vehículo que fue liberado al inventario" }),
      personalLiberadoIds: z
        .array(z.string().uuid())
        .openapi({ description: "UUIDs de los funcionarios de terreno liberados a estado disponible" }),
    })
    .openapi({ description: "Detalle de la patrulla desactivada y recursos liberados" }),
});

export type DesactivarPatrullaResponseDTO = z.infer<typeof DesactivarPatrullaResponseSchema>;

