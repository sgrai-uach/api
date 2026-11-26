import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const MAX_ADJUNTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const MIME_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
] as const;

export type MimePermitido = (typeof MIME_PERMITIDOS)[number];

export class PayloadTooLargeError extends Error {
  constructor(message = "El archivo excede el tamaño máximo permitido de 10 MB.") {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export class UnsupportedMediaTypeError extends Error {
  constructor(
    message = "Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG, PNG, WebP), videos (MP4, WebM, MOV) y documentos PDF."
  ) {
    super(message);
    this.name = "UnsupportedMediaTypeError";
  }
}

export const SubirAdjuntoFieldsSchema = z
  .object({
    incidente_id: z
      .string()
      .uuid("El incidente_id debe ser un UUID válido.")
      .optional()
      .openapi({
        description: "UUID del incidente al que se asocia la evidencia",
        example: "50000000-0000-4000-8000-000000000001",
      }),
    reporte_terreno_id: z
      .string()
      .uuid("El reporte_terreno_id debe ser un UUID válido.")
      .optional()
      .openapi({
        description: "UUID del reporte de terreno al que se asocia la evidencia",
        example: "70000000-0000-4000-8000-000000000001",
      }),
  })
  .refine((data) => Boolean(data.incidente_id || data.reporte_terreno_id), {
    message: "Debe proporcionar al menos incidente_id o reporte_terreno_id.",
  });

export type SubirAdjuntoFields = z.infer<typeof SubirAdjuntoFieldsSchema>;

export const AdjuntoCreadoResponseSchema = z
  .object({
    id: z.string().uuid().openapi({ description: "UUID del registro en tabla adjunto" }),
    nombreArchivo: z.string().openapi({ example: "evidencia_terreno.jpg" }),
    url: z.string().openapi({ example: "/uploads/evidencia/a1b2c3d4.webp" }),
    tipoMime: z.string().openapi({ example: "image/webp" }),
    tamanoBytes: z.number().int().nonnegative().openapi({ example: 145820 }),
    incidenteId: z.string().uuid().nullable(),
    reporteTerrenoId: z.string().uuid().nullable(),
    misionId: z.string().uuid().nullable().optional(),
    creadoEn: z.string().datetime(),
  })
  .openapi("AdjuntoCreadoResponse");

export type AdjuntoCreadoResponse = z.infer<typeof AdjuntoCreadoResponseSchema>;

export const ListarAdjuntosQuerySchema = z
  .object({
    incidente_id: z
      .string()
      .uuid("El incidente_id debe ser un UUID válido.")
      .optional(),
    reporte_terreno_id: z
      .string()
      .uuid("El reporte_terreno_id debe ser un UUID válido.")
      .optional(),
  })
  .refine((data) => Boolean(data.incidente_id || data.reporte_terreno_id), {
    message: "Debe proporcionar al menos incidente_id o reporte_terreno_id.",
  });

export type ListarAdjuntosQuery = z.infer<typeof ListarAdjuntosQuerySchema>;

export const ListarAdjuntosResponseSchema = z
  .object({
    data: z.array(AdjuntoCreadoResponseSchema),
  })
  .openapi("ListarAdjuntosResponse");

export type ListarAdjuntosResponse = z.infer<typeof ListarAdjuntosResponseSchema>;
