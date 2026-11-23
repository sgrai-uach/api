import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/**
 * Esquema de validación para el cuerpo de la petición POST /api/misiones/{id}/llegada
 */
export const ReportarLlegadaBodySchema = z
  .object({
    latitud: z
      .number()
      .min(-90, "La latitud no puede ser menor a -90 grados.")
      .max(90, "La latitud no puede ser mayor a 90 grados.")
      .openapi({
        description: "Latitud WGS84 capturada mediante la Geolocation API",
        example: -39.81422,
      }),
    longitud: z
      .number()
      .min(-180, "La longitud no puede ser menor a -180 grados.")
      .max(180, "La longitud no puede ser mayor a 180 grados.")
      .openapi({
        description: "Longitud WGS84 capturada mediante la Geolocation API",
        example: -73.24591,
      }),
    observaciones: z
      .string()
      .trim()
      .max(500, "Las observaciones no pueden exceder 500 caracteres.")
      .optional()
      .nullable()
      .openapi({
        description: "Observaciones o comentarios de terreno opcionales al reportar arribo",
        example: "Equipo presente en el lugar, evaluando acceso con camión aljibe.",
      }),
  })
  .openapi({
    description: "Coordenadas GPS y observaciones para el reporte de llegada a terreno de la cuadrilla",
  });

export type ReportarLlegadaBody = z.infer<typeof ReportarLlegadaBodySchema>;

/**
 * Esquema de respuesta para POST /api/misiones/{id}/llegada
 */
export const ReportarLlegadaResponseDataSchema = z
  .object({
    hitoId: z.string().uuid().openapi({ description: "Identificador único UUID del hito registrado" }),
    misionId: z.string().uuid().openapi({ description: "Identificador único UUID de la misión" }),
    codigoMision: z.string().openapi({ description: "Código de la misión", example: "MIS-2026-001" }),
    hito: z.literal("LLEGADA_TERRENO").openapi({ description: "Tipo de hito registrado" }),
    descripcion: z.string().openapi({ description: "Glosa descriptiva del hito" }),
    latitud: z.number().openapi({ description: "Latitud registrada" }),
    longitud: z.number().openapi({ description: "Longitud registrada" }),
    registradoEn: z.string().openapi({ description: "Fecha y hora de registro en formato ISO 8601" }),
    registradoPor: z
      .object({
        id: z.string().uuid().openapi({ description: "ID del usuario delegado o administrador" }),
        nombre: z.string().openapi({ description: "Nombre completo del usuario" }),
      })
      .openapi({ description: "Usuario responsable que reportó la llegada" }),
    estadoMision: z.string().openapi({ description: "Nuevo estado de la misión", example: "EN_CURSO" }),
    miembrosActualizados: z.number().openapi({
      description: "Cantidad de funcionarios de la cuadrilla cuya ubicación fue actualizada",
      example: 4,
    }),
  })
  .openapi("ReportarLlegadaResponseData");

export const ReportarLlegadaResponseSchema = z
  .object({
    message: z.string().openapi({ example: "Llegada a terreno reportada exitosamente." }),
    data: ReportarLlegadaResponseDataSchema,
  })
  .openapi("ReportarLlegadaResponse");

export type ReportarLlegadaResponse = z.infer<typeof ReportarLlegadaResponseSchema>;

