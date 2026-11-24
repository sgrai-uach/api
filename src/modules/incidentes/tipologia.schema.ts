import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/**
 * Esquema representativo de un tipo de incidente del catálogo oficial.
 */
export const TipoIncidenteCatalogoItemSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: "Identificador único UUID del tipo de incidente",
      example: "40000000-0000-4000-8000-000000000001",
    }),
    nombre: z.string().openapi({
      description: "Nombre canónico del tipo de incidente o afectación",
      example: "Inundación",
    }),
    descripcion: z.string().nullable().openapi({
      description: "Descripción técnica o alcance del tipo de incidente",
      example: "Acumulación desmedida de agua por crecida de ríos o lluvias torrenciales",
    }),
    activo: z.boolean().openapi({
      description: "Indica si el tipo de incidente se encuentra habilitado para selección",
      example: true,
    }),
  })
  .openapi("TipoIncidenteCatalogoItem");

export type TipoIncidenteCatalogoItem = z.infer<typeof TipoIncidenteCatalogoItemSchema>;

/**
 * Respuesta para GET /api/incidentes/tipos?catalogo=true
 */
export const ListarTiposIncidenteResponseSchema = z
  .object({
    message: z.string().openapi({
      example: "Catálogo oficial de tipos de incidente obtenido exitosamente.",
    }),
    data: z.array(TipoIncidenteCatalogoItemSchema),
  })
  .openapi("ListarTiposIncidenteResponse");

export type ListarTiposIncidenteResponse = z.infer<typeof ListarTiposIncidenteResponseSchema>;

/**
 * Input para PATCH /api/incidentes/{id}/tipologia
 */
export const ReclasificarTipologiaInputSchema = z
  .object({
    tipoIncidenteId: z
      .string()
      .uuid({ message: "El identificador del tipo de incidente debe ser un UUID válido." })
      .optional()
      .openapi({
        description: "UUID del nuevo tipo de incidente según el catálogo oficial",
        example: "40000000-0000-4000-8000-000000000001",
      }),
    tipo_incidente_id: z
      .string()
      .uuid({ message: "El identificador del tipo de incidente debe ser un UUID válido." })
      .optional()
      .openapi({
        description: "Alias en formato snake_case del UUID del nuevo tipo de incidente",
        example: "40000000-0000-4000-8000-000000000001",
      }),
    justificacion: z
      .string({ message: "La justificación del cambio de tipología es obligatoria." })
      .trim()
      .min(5, { message: "La justificación debe contener al menos 5 caracteres." })
      .max(1000, { message: "La justificación no puede exceder los 1000 caracteres." })
      .openapi({
        description: "Justificación técnica u operativa del cambio de tipología constatado en terreno",
        example:
          "Tras evaluación en terreno se constata desborde de cauce con ingreso masivo de agua a viviendas, no un anegamiento menor.",
      }),
    misionId: z
      .string()
      .uuid({ message: "El identificador de la misión debe ser un UUID válido." })
      .optional()
      .openapi({
        description:
          "Identificador UUID de la misión táctica. Opcional: si se omite, el sistema resuelve la misión EN_CURSO asociada al incidente.",
        example: "60000000-0000-4000-8000-000000000001",
      }),
    mision_id: z
      .string()
      .uuid({ message: "El identificador de la misión debe ser un UUID válido." })
      .optional()
      .openapi({
        description: "Alias en formato snake_case de misionId",
        example: "60000000-0000-4000-8000-000000000001",
      }),
  })
  .refine((data) => Boolean(data.tipoIncidenteId || data.tipo_incidente_id), {
    message: "Debe especificar 'tipoIncidenteId' (o 'tipo_incidente_id').",
    path: ["tipoIncidenteId"],
  })
  .openapi("ReclasificarTipologiaInput");

export type ReclasificarTipologiaInput = z.infer<typeof ReclasificarTipologiaInputSchema>;

/**
 * Resumen del incidente devuelto tras la reclasificación
 */
export const IncidenteReclasificadoResumenSchema = z
  .object({
    id: z.string().uuid().openapi({ description: "Identificador único UUID del incidente" }),
    codigo: z.string().openapi({ description: "Código interno del incidente", example: "INC-2026-001" }),
    tipoIncidenteId: z.string().uuid().openapi({ description: "UUID del nuevo tipo de incidente" }),
    tipoAfectacion: z.string().openapi({ description: "Nombre canónico del nuevo tipo de incidente", example: "Inundación" }),
    estado: z.string().openapi({ description: "Estado actual del incidente", example: "VERIFICANDO" }),
    prioridad: z.string().openapi({ description: "Prioridad actual del incidente", example: "ALTA" }),
    actualizadoEn: z.string().openapi({ description: "Fecha y hora de actualización en formato ISO 8601" }),
  })
  .openapi("IncidenteReclasificadoResumen");

export type IncidenteReclasificadoResumen = z.infer<typeof IncidenteReclasificadoResumenSchema>;

/**
 * Resumen del hito registrado en mision_hito
 */
export const MisionHitoTipologiaSchema = z
  .object({
    id: z.string().uuid().openapi({ description: "Identificador único UUID del hito en mision_hito" }),
    misionId: z.string().uuid().openapi({ description: "Identificador de la misión asociada" }),
    hito: z.string().openapi({ description: "Código canónico del hito", example: "TIPOLOGIA_RECLASIFICADA" }),
    descripcion: z.string().openapi({
      description: "Glosa descriptiva del hito con el tipo de incidente y justificación",
      example:
        "Tipología reclasificada en terreno a: Inundación. Justificación: Desborde constatado.",
    }),
    registradoPorId: z.string().uuid().nullable().openapi({
      description: "UUID del evaluador en sesión que ejecutó la reclasificación",
    }),
    metadatos: z
      .object({
        tipoAnterior: z.string().nullable().optional(),
        tipoAnteriorId: z.string().uuid().nullable().optional(),
        tipoNuevo: z.string(),
        tipoNuevoId: z.string().uuid(),
        justificacion: z.string(),
      })
      .nullable()
      .optional()
      .openapi({
        description: "Metadatos estructurados del cambio de tipología (antes y después)",
      }),
    creadoEn: z.string().openapi({ description: "Fecha y hora de registro del hito (ISO 8601)" }),
  })
  .openapi("MisionHitoTipologia");

export type MisionHitoTipologia = z.infer<typeof MisionHitoTipologiaSchema>;

/**
 * Respuesta para PATCH /api/incidentes/{id}/tipologia
 */
export const ReclasificarTipologiaResponseSchema = z
  .object({
    message: z.string().openapi({
      example: "Tipología del incidente reclasificada exitosamente en terreno.",
    }),
    data: z.object({
      incidente: IncidenteReclasificadoResumenSchema,
      hito: MisionHitoTipologiaSchema,
    }),
  })
  .openapi("ReclasificarTipologiaResponse");

export type ReclasificarTipologiaResponse = z.infer<typeof ReclasificarTipologiaResponseSchema>;
