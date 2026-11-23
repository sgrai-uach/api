import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const TipoUnidadTelemetriaEnum = z.enum(["PATRULLA", "CUADRILLA"]);
export type TipoUnidadTelemetria = z.infer<typeof TipoUnidadTelemetriaEnum>;

/**
 * Esquema de validación del payload transmitido por la PWA móvil en el evento `telemetria:posicion`.
 */
export const TelemetriaPosicionPayloadSchema = z.object({
  unidadId: z.string().uuid({
    message: "El identificador de la unidad debe ser un UUID válido.",
  }).openapi({
    description: "UUID de la patrulla verificadora o cuadrilla operativa en terreno",
    example: "f1000000-0000-4000-8000-000000000001",
  }),
  tipoUnidad: TipoUnidadTelemetriaEnum.openapi({
    description: "Tipo de unidad operativa",
    example: "PATRULLA",
  }),
  lat: z
    .number({
      message: "La latitud debe ser un número decimal válido.",
    })
    .min(-90, { message: "La latitud no puede ser menor a -90 grados." })
    .max(90, { message: "La latitud no puede ser mayor a 90 grados." })
    .openapi({
      description: "Latitud en formato estándar WGS84",
      example: -39.81422,
    }),
  lng: z
    .number({
      message: "La longitud debe ser un número decimal válido.",
    })
    .min(-180, { message: "La longitud no puede ser menor a -180 grados." })
    .max(180, { message: "La longitud no puede ser mayor a 180 grados." })
    .openapi({
      description: "Longitud en formato estándar WGS84",
      example: -73.24589,
    }),
  timestamp: z
    .union([z.string(), z.number()])
    .transform((val) => {
      if (typeof val === "number") {
        return new Date(val).toISOString();
      }
      const parsedDate = new Date(val);
      if (isNaN(parsedDate.getTime())) {
        return new Date().toISOString();
      }
      return parsedDate.toISOString();
    })
    .openapi({
      description: "Marca temporal del reporte GPS (ISO 8601)",
      example: "2026-11-12T15:00:00.000Z",
    }),
  rumbo: z
    .number()
    .min(0, { message: "El rumbo debe ser igual o superior a 0 grados." })
    .max(360, { message: "El rumbo no puede exceder los 360 grados." })
    .nullable()
    .optional()
    .openapi({
      description: "Rumbo / orientación de desplazamiento en grados sexagesimales (0-360)",
      example: 180.5,
    }),
  precision: z
    .number()
    .min(0, { message: "La precisión no puede ser negativa." })
    .nullable()
    .optional()
    .openapi({
      description: "Radio de precisión o exactitud satelital en metros (GeolocationCoordinates.accuracy)",
      example: 10.5,
    }),
  velocidad: z
    .number()
    .min(0, { message: "La velocidad no puede ser negativa." })
    .nullable()
    .optional()
    .openapi({
      description: "Velocidad de desplazamiento instantánea en metros por segundo (m/s)",
      example: 5.2,
    }),
}).openapi({
  description: "Payload de coordenadas GPS emitido periódicamente por la PWA de terreno",
});

export type TelemetriaPosicionDTO = z.infer<typeof TelemetriaPosicionPayloadSchema>;

/**
 * Esquema de respuesta para el listado de últimas posiciones activas (hidratación inicial del mapa web).
 */
export const PosicionUnidadActivaSchema = z.object({
  unidadId: z.string().uuid().openapi({ description: "UUID de la unidad" }),
  tipoUnidad: TipoUnidadTelemetriaEnum.openapi({ description: "Tipo de unidad" }),
  lat: z.number().openapi({ description: "Latitud actual" }),
  lng: z.number().openapi({ description: "Longitud actual" }),
  timestamp: z.string().openapi({ description: "Timestamp reportado por el dispositivo" }),
  rumbo: z.number().nullable().optional().openapi({ description: "Rumbo en grados" }),
  precision: z.number().nullable().optional().openapi({ description: "Precisión en metros" }),
  velocidad: z.number().nullable().optional().openapi({ description: "Velocidad en m/s" }),
  recibidoEn: z.string().openapi({ description: "Fecha y hora en que la API persistió la telemetría" }),
});

export type PosicionUnidadActivaDTO = z.infer<typeof PosicionUnidadActivaSchema>;

export const PosicionesActivasResponseSchema = z.object({
  message: z.string().openapi({ example: "Posiciones activas obtenidas exitosamente" }),
  data: z.array(PosicionUnidadActivaSchema),
});
