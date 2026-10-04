import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// 1. Esquema de validación para parámetros de consulta (Query Params) de KPIs
export const IncidentesKpisQuerySchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "El formato de fecha debe ser YYYY-MM-DD")
    .optional()
    .openapi({
      description: "Fecha de consulta en formato YYYY-MM-DD (por defecto, fecha actual en Valdivia/Chile)",
      example: "2026-10-03",
    }),
  delegacionId: z
    .string()
    .uuid("El identificador de delegación debe ser un UUID válido")
    .optional()
    .openapi({
      description: "UUID opcional de la delegación territorial para filtrar contadores específicos",
      example: "11111111-1111-4111-8111-111111111111",
    }),
});

export type IncidentesKpisQuery = z.infer<typeof IncidentesKpisQuerySchema>;

// 2. Contadores individuales por cada uno de los 5 estados canónicos
export const ContadoresEstadoSchema = z.object({
  reportado: z.number().int().min(0).openapi({
    description: "Cantidad de incidentes en estado REPORTADO (ingresados pendientes de verificación)",
    example: 8,
  }),
  verificando: z.number().int().min(0).openapi({
    description: "Cantidad de incidentes en estado VERIFICANDO (con patrulla verificadora en evaluación)",
    example: 3,
  }),
  enAtencion: z.number().int().min(0).openapi({
    description: "Cantidad de incidentes en estado EN_ATENCION (cuadrillas o recursos despachados en terreno)",
    example: 12,
  }),
  noAbordables: z.number().int().min(0).openapi({
    description: "Cantidad de incidentes en estado NO_ABORDABLE (descartados por falsa alarma o fuera de alcance)",
    example: 2,
  }),
  resueltos: z.number().int().min(0).openapi({
    description: "Cantidad de incidentes en estado RESUELTO (emergencia mitigada y cerrada)",
    example: 15,
  }),
});

export type ContadoresEstado = z.infer<typeof ContadoresEstadoSchema>;

// 3. Objeto principal de datos de KPIs
export const IncidentesKpisDataSchema = z.object({
  fecha: z.string().openapi({
    description: "Fecha a la que corresponden los contadores calculados (YYYY-MM-DD)",
    example: "2026-10-03",
  }),
  zonaHoraria: z.literal("America/Santiago").openapi({
    description: "Zona horaria oficial empleada para el corte diario",
    example: "America/Santiago",
  }),
  delegacionId: z.string().uuid().nullable().openapi({
    description: "UUID de delegación aplicada como filtro, o null si corresponde al total comunal",
    example: null,
  }),
  total: z.number().int().min(0).openapi({
    description: "Total general de incidentes registrados en el periodo del día",
    example: 40,
  }),
  contadores: ContadoresEstadoSchema,
  actualizadoEn: z.string().openapi({
    description: "Marca temporal ISO 8601 del momento exacto del cálculo",
    example: "2026-10-03T17:30:00.000Z",
  }),
});

export type IncidentesKpisData = z.infer<typeof IncidentesKpisDataSchema>;

// 4. Esquema de respuesta HTTP completa
export const IncidentesKpisResponseSchema = z.object({
  message: z.string().openapi({
    example: "Contadores de incidentes del día obtenidos exitosamente.",
  }),
  data: IncidentesKpisDataSchema,
});

export type IncidentesKpisResponse = z.infer<typeof IncidentesKpisResponseSchema>;
