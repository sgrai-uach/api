import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { validarRutChileno } from "./aviso-incidente.utils";

extendZodWithOpenApi(z);

export const TIPOS_AFECTACION = [
  "Anegamiento",
  "Caída de árbol",
  "Corte de energía",
  "Deslizamiento",
  "Daño estructural",
  "Corte de agua potable",
  "Otro",
] as const;

export const TipoAfectacionEnum = z.enum(TIPOS_AFECTACION);
export type TipoAfectacion = z.infer<typeof TipoAfectacionEnum>;

export const CrearAvisoIncidenteInputSchema = z.object({
  tipoAfectacion: TipoAfectacionEnum,
  direccion: z
    .string()
    .trim()
    .min(5, "La dirección debe tener al menos 5 caracteres"),
  descripcion: z.string().trim().optional(),
  informanteNombre: z
    .string()
    .trim()
    .min(3, "El nombre del informante debe tener al menos 3 caracteres"),
  informanteRut: z
    .string()
    .trim()
    .refine(validarRutChileno, {
      message: "El RUT ingresado no es válido (debe cumplir con el dígito verificador).",
    }),
  informanteTelefono: z.string().trim().optional(),
  latitud: z
    .number()
    .min(-90, "La latitud debe estar entre -90 y 90")
    .max(90, "La latitud debe estar entre -90 y 90")
    .optional(),
  longitud: z
    .number()
    .min(-180, "La longitud debe estar entre -180 y 180")
    .max(180, "La longitud debe estar entre -180 y 180")
    .optional(),
});

export type CrearAvisoIncidenteInput = z.infer<typeof CrearAvisoIncidenteInputSchema>;

export const AvisoIncidenteResponseSchema = z.object({
  id: z.string().uuid(),
  codigoSeguimiento: z.string().describe("Código de seguimiento numérico para el informante"),
  esDuplicado: z.boolean().describe("Indica si el aviso fue detectado como duplicado de otro reporte reciente"),
  mensaje: z.string(),
  tipoAfectacion: z.string(),
  direccion: z.string(),
  estado: z.string(),
  creadoEn: z.string(),
  avisoOriginalId: z.string().uuid().nullable().optional(),
});

export type AvisoIncidenteResponse = z.infer<typeof AvisoIncidenteResponseSchema>;

export const ConsultaSeguimientoResponseSchema = z.object({
  codigoSeguimiento: z.string(),
  estado: z.string(),
  tipoAfectacion: z.string(),
  direccion: z.string(),
  descripcion: z.string().nullable(),
  creadoEn: z.string(),
  esDuplicado: z.boolean(),
});

export type ConsultaSeguimientoResponse = z.infer<typeof ConsultaSeguimientoResponseSchema>;
