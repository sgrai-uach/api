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

export const ESTADOS_INCIDENTE = [
  "REPORTADO",
  "VERIFICANDO",
  "EN_ATENCION",
  "NO_ABORDABLE",
  "RESUELTO",
] as const;

export const EstadoIncidenteEnum = z.enum(ESTADOS_INCIDENTE);
export type EstadoIncidente = z.infer<typeof EstadoIncidenteEnum>;

/**
 * Catálogo de estados con títulos y explicaciones en lenguaje claro,
 * sin jerga técnica, para que cualquier ciudadano comprenda la atención de su emergencia.
 */
export const DETALLE_ESTADOS_SEGUIMIENTO: Record<
  EstadoIncidente,
  { etiqueta: string; descripcion: string }
> = {
  REPORTADO: {
    etiqueta: "Reportado",
    descripcion:
      "Hemos recibido tu reporte de emergencia en nuestra central. Pronto será evaluado por el equipo de operaciones.",
  },
  VERIFICANDO: {
    etiqueta: "En Verificación",
    descripcion:
      "Una patrulla municipal de respuesta rápida se dirige o se encuentra en el lugar evaluando la situación y los riesgos en terreno.",
  },
  EN_ATENCION: {
    etiqueta: "En Atención",
    descripcion:
      "El incidente fue confirmado en terreno y una cuadrilla operativa municipal está trabajando en el lugar para atender la emergencia.",
  },
  NO_ABORDABLE: {
    etiqueta: "No Abordable",
    descripcion:
      "El caso fue evaluado por el equipo pero no corresponde al ámbito de acción municipal, o bien no se constató afectación en el lugar.",
  },
  RESUELTO: {
    etiqueta: "Resuelto",
    descripcion:
      "Los trabajos de mitigación y respuesta municipal han finalizado con éxito en el lugar de la emergencia.",
  },
} as const;

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
  codigoSeguimiento: z.string().describe("Código numérico de 8 dígitos entregado al informante"),
  estado: EstadoIncidenteEnum.describe("Estado del incidente en el ciclo de vida ICS"),
  estadoEtiqueta: z.string().describe("Nombre comprensible para el ciudadano: ej. 'En Atención'"),
  estadoDescripcion: z.string().describe("Explicación amigable y clara del estado actual sin jerga técnica"),
  tipoAfectacion: z.string().describe("Categoría de afectación reportada"),
  direccionAproximada: z.string().describe("Ubicación referencial de la emergencia"),
  descripcion: z.string().nullable().describe("Detalle o notas proporcionadas por el informante"),
  creadoEn: z.string().describe("Fecha y hora en que se ingresó el reporte"),
  actualizadoEn: z.string().describe("Fecha y hora de la última actualización de estado"),
  esDuplicado: z.boolean().default(false).describe("Indica si el reporte fue asociado a otro existente en la zona"),
});

export type ConsultaSeguimientoResponse = z.infer<typeof ConsultaSeguimientoResponseSchema>;
