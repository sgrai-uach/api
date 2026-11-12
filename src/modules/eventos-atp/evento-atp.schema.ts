import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  PaginationMetaSchema,
  PaginationQuerySchema,
} from "@/lib/shared/pagination.schema";
import {
  EntidadVinculadaResumenSchema,
  VinculoNoEncontradoSchema,
} from "./vinculacion.schema";

extendZodWithOpenApi(z);

/**
 * Tipos de amenaza comunal homologados para los Eventos ATP (H61).
 * El catálogo es extensible: "OTRO" permite registrar fenómenos no clasificados.
 */
export const TipoAmenazaEventoAtpSchema = z.enum([
  "METEOROLOGICA",
  "MAREJADAS",
  "REMOCION_EN_MASA",
  "INUNDACION",
  "INCENDIO_FORESTAL",
  "SISMICA",
  "OTRO",
]);

export type TipoAmenazaEventoAtp = z.infer<typeof TipoAmenazaEventoAtpSchema>;

/**
 * Niveles oficiales de alerta comunal definidos por SENAPRED.
 */
export const NivelAlertaEventoAtpSchema = z.enum(["VERDE", "AMARILLA", "ROJA"]);

export type NivelAlertaEventoAtp = z.infer<typeof NivelAlertaEventoAtpSchema>;

/**
 * Estados del ciclo de vida de un Evento ATP.
 * Todo evento nuevo se persiste en estado ACTIVO.
 */
export const EstadoEventoAtpSchema = z.enum(["ACTIVO", "FINALIZADO", "CANCELADO"]);

export type EstadoEventoAtp = z.infer<typeof EstadoEventoAtpSchema>;

/**
 * Fecha/hora flexible para formularios web (datetime-local) y clientes API.
 * Se acepta cualquier representación parseable por Date y se normaliza a Date
 * en la capa de servicio.
 */
const FechaHoraEventoAtpSchema = z
  .string()
  .trim()
  .min(1, "La fecha y hora es obligatoria")
  .refine(
    (valor) => !Number.isNaN(Date.parse(valor)),
    "El formato de fecha y hora no es válido"
  )
  .openapi({
    type: "string",
    format: "date-time",
    description: "Fecha y hora en formato ISO-8601",
    example: "2026-05-01T10:00",
  });

/**
 * Delegación municipal afectada por el Evento ATP.
 */
export const DelegacionEventoAtpSchema = z.object({
  id: z.string().uuid().openapi({
    description: "Identificador único de la delegación municipal",
    example: "30000000-0000-4000-8000-000000000001",
  }),
  codigo: z.string().openapi({
    description: "Código institucional de la delegación",
    example: "DEL_NORTE",
  }),
  nombre: z.string().openapi({
    description: "Nombre legible de la delegación",
    example: "Delegación Municipal Norte",
  }),
});

export type DelegacionEventoAtp = z.infer<typeof DelegacionEventoAtpSchema>;

/**
 * Entrada para crear un Evento ATP (H61).
 *
 * - `codigo` es opcional: si se omite, el backend genera ATP-YYYY-####.
 * - `delegacionIds` vacío representa alcance comunal centralizado.
 */
export const CrearEventoAtpInputSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .min(3, "El código debe tener al menos 3 caracteres")
      .max(30, "El código no puede superar los 30 caracteres")
      .regex(
        /^[A-Za-z0-9-]+$/,
        "El código solo puede contener letras, números y guiones"
      )
      .optional()
      .openapi({
        description:
          "Código identificador único. Si se omite, se genera automáticamente con formato ATP-YYYY-####",
        example: "ATP-2026-0001",
      }),
    nombre: z
      .string()
      .trim()
      .min(3, "El nombre del evento debe tener al menos 3 caracteres")
      .max(150, "El nombre del evento no puede superar los 150 caracteres")
      .openapi({
        description: "Nombre descriptivo del fenómeno o evento",
        example: "Sistema Frontal Mayo 2026",
      }),
    descripcion: z
      .string()
      .trim()
      .min(10, "La descripción debe tener al menos 10 caracteres")
      .max(2000, "La descripción no puede superar los 2000 caracteres")
      .openapi({
        description: "Descripción detallada del fenómeno y su impacto esperado",
        example:
          "Sistema frontal con precipitaciones intensas y vientos moderados a fuertes durante 48 horas.",
      }),
    tipoAmenaza: TipoAmenazaEventoAtpSchema.openapi({
      description: "Clasificación principal de la amenaza",
      example: "METEOROLOGICA",
    }),
    nivelAlerta: NivelAlertaEventoAtpSchema.openapi({
      description: "Nivel oficial de alerta comunal",
      example: "AMARILLA",
    }),
    fechaInicio: FechaHoraEventoAtpSchema.openapi({
      description: "Fecha y hora de inicio del evento",
      example: "2026-05-01T10:00",
    }),
    fechaTermino: FechaHoraEventoAtpSchema.openapi({
      description: "Fecha y hora estimada de término del evento",
      example: "2026-05-03T18:00",
    }),
    delegacionIds: z
      .array(
        z
          .string()
          .uuid("El identificador de delegación debe ser un UUID válido")
      )
      .optional()
      .default([])
      .openapi({
        description:
          "Delegaciones municipales afectadas. Arreglo vacío u omitido representa alcance comunal centralizado",
        example: ["30000000-0000-4000-8000-000000000001"],
      }),
  })
  .superRefine((datos, ctx) => {
    if (Date.parse(datos.fechaTermino) < Date.parse(datos.fechaInicio)) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaTermino"],
        message:
          "La fecha y hora de término debe ser mayor o igual a la fecha y hora de inicio",
      });
    }

    const delegacionesUnicas = new Set(datos.delegacionIds ?? []);
    if (delegacionesUnicas.size !== (datos.delegacionIds ?? []).length) {
      ctx.addIssue({
        code: "custom",
        path: ["delegacionIds"],
        message: "No se puede repetir una misma delegación en el evento",
      });
    }
  });

export type CrearEventoAtpInput = z.infer<typeof CrearEventoAtpInputSchema>;

/**
 * Respuesta canónica de un Evento ATP.
 */
export const EventoAtpResponseSchema = z.object({
  id: z.string().uuid().openapi({
    description: "Identificador único del Evento ATP",
    example: "50000000-0000-4000-8000-000000000001",
  }),
  codigo: z.string().openapi({
    description: "Código único del Evento ATP",
    example: "ATP-2026-0001",
  }),
  nombre: z.string().openapi({
    description: "Nombre del evento",
    example: "Sistema Frontal Mayo 2026",
  }),
  descripcion: z.string().openapi({
    description: "Descripción detallada del evento",
  }),
  tipoAmenaza: TipoAmenazaEventoAtpSchema.openapi({
    description: "Tipo de amenaza del evento",
    example: "METEOROLOGICA",
  }),
  nivelAlerta: NivelAlertaEventoAtpSchema.openapi({
    description: "Nivel de alerta comunal",
    example: "AMARILLA",
  }),
  fechaInicio: z.string().datetime().openapi({
    description: "Fecha y hora de inicio en formato ISO-8601",
    example: "2026-05-01T10:00:00.000Z",
  }),
  fechaTermino: z.string().datetime().openapi({
    description: "Fecha y hora de término estimada en formato ISO-8601",
    example: "2026-05-03T18:00:00.000Z",
  }),
  estado: EstadoEventoAtpSchema.openapi({
    description: "Estado actual del Evento ATP",
    example: "ACTIVO",
  }),
  delegaciones: z.array(DelegacionEventoAtpSchema).openapi({
    description:
      "Delegaciones municipales afectadas. Arreglo vacío indica alcance comunal centralizado",
  }),
  creadoPorId: z.string().uuid().nullable().openapi({
    description: "Identificador del usuario que registró el evento",
    example: "00000000-0000-4000-8000-000000000001",
  }),
  creadoEn: z.string().datetime().openapi({
    description: "Fecha y hora de creación en formato ISO-8601",
    example: "2026-05-01T09:55:00.000Z",
  }),
  actualizadoEn: z.string().datetime().openapi({
    description: "Fecha y hora de última actualización en formato ISO-8601",
    example: "2026-05-01T09:55:00.000Z",
  }),
});

export type EventoAtpResponse = z.infer<typeof EventoAtpResponseSchema>;

/**
 * Respuesta de creación con mensaje institucional.
 */
export const CrearEventoAtpResponseSchema = z.object({
  message: z.string().openapi({
    example: "Evento ATP registrado exitosamente.",
  }),
  data: EventoAtpResponseSchema,
});

export type CrearEventoAtpResponse = z.infer<
  typeof CrearEventoAtpResponseSchema
>;

/* ==========================================================================
   H60 - Listado, detalle y vinculación de entidades
   ========================================================================== */

/**
 * Parámetros de consulta del catálogo de Eventos ATP.
 */
export const ListarEventosAtpQuerySchema = PaginationQuerySchema.extend({
  estado: EstadoEventoAtpSchema.optional().openapi({
    description: "Filtrar por estado del ciclo de vida del Evento ATP",
    example: "ACTIVO",
  }),
  delegacionId: z
    .string()
    .uuid("El identificador de delegación debe ser un UUID válido")
    .optional()
    .openapi({
      description: "Filtrar por delegación territorial afectada",
      example: "30000000-0000-4000-8000-000000000001",
    }),
  busqueda: z.string().trim().max(150).optional().openapi({
    description: "Búsqueda textual por código o nombre del evento",
    example: "Sistema frontal",
  }),
});

export type ListarEventosAtpQuery = z.infer<typeof ListarEventosAtpQuerySchema>;

/**
 * Entidad vinculable resumida para el detalle de un Evento ATP.
 */
export const EntidadVinculadaEventoAtpSchema = z.object({
  id: z.string().uuid(),
  codigo: z.string(),
  nombre: z.string().nullable(),
  estado: z.string().nullable(),
  creadoEn: z.string().datetime(),
});

export type EntidadVinculadaEventoAtp = z.infer<
  typeof EntidadVinculadaEventoAtpSchema
>;

/**
 * Conjunto de entidades vinculadas a un Evento ATP, agrupadas por tipo.
 */
export const VinculosEventoAtpSchema = z.object({
  incidentes: z.array(EntidadVinculadaEventoAtpSchema),
  eventosPrevencion: z.array(EntidadVinculadaEventoAtpSchema),
  recuperaciones: z.array(EntidadVinculadaEventoAtpSchema),
  eventosAsistenciaSocial: z.array(EntidadVinculadaEventoAtpSchema),
});

export type VinculosEventoAtp = z.infer<typeof VinculosEventoAtpSchema>;

/**
 * Resumen de Evento ATP para listados y selectores.
 */
export const EventoAtpResumenSchema = EventoAtpResponseSchema.extend({
  totalVinculados: z.number().int().openapi({
    description: "Cantidad total de entidades vinculadas al Evento ATP",
    example: 12,
  }),
});

export type EventoAtpResumen = z.infer<typeof EventoAtpResumenSchema>;

/**
 * Detalle de Evento ATP con sus entidades vinculadas.
 */
export const EventoAtpDetalleSchema = EventoAtpResponseSchema.extend({
  vinculos: VinculosEventoAtpSchema,
  totalVinculados: z.number().int(),
});

export type EventoAtpDetalle = z.infer<typeof EventoAtpDetalleSchema>;

export const ListarEventosAtpResponseSchema = z.object({
  message: z.string().openapi({
    example: "Listado de Eventos ATP obtenido exitosamente.",
  }),
  data: z.array(EventoAtpResumenSchema),
  meta: PaginationMetaSchema,
});

export type ListarEventosAtpResponse = z.infer<
  typeof ListarEventosAtpResponseSchema
>;

export const ObtenerEventoAtpResponseSchema = z.object({
  message: z.string().openapi({
    example: "Evento ATP obtenido exitosamente.",
  }),
  data: EventoAtpDetalleSchema,
});

export type ObtenerEventoAtpResponse = z.infer<
  typeof ObtenerEventoAtpResponseSchema
>;

/**
 * Resultado de una operación de vinculación o desvinculación en lote.
 */
export const ResultadoVinculacionSchema = z.object({
  eventoAtpId: z.string().uuid(),
  accion: z.enum(["VINCULADO", "DESVINCULADO"]),
  entidades: z.object({
    incidentes: z.array(EntidadVinculadaResumenSchema),
    eventosPrevencion: z.array(EntidadVinculadaResumenSchema),
    recuperaciones: z.array(EntidadVinculadaResumenSchema),
    eventosAsistenciaSocial: z.array(EntidadVinculadaResumenSchema),
  }),
  reasignadas: z.array(EntidadVinculadaResumenSchema),
  noEncontradas: z.array(VinculoNoEncontradoSchema),
  noDesvinculadas: z.array(EntidadVinculadaResumenSchema),
  vinculadoPorId: z.string().uuid(),
  ocurridoEn: z.string().datetime(),
});

export type ResultadoVinculacion = z.infer<typeof ResultadoVinculacionSchema>;

export const VincularEntidadesResponseSchema = z.object({
  message: z.string().openapi({
    example: "Entidades vinculadas al Evento ATP exitosamente.",
  }),
  data: ResultadoVinculacionSchema,
});

export type VincularEntidadesResponse = z.infer<
  typeof VincularEntidadesResponseSchema
>;

