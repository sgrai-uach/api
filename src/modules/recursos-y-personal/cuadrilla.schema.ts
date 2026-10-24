import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/**
 * Estados operativos posibles para una cuadrilla táctica municipal.
 */
export const EstadoCuadrillaSchema = z.enum([
  "DISPONIBLE",
  "EN_MISION",
  "NO_DISPONIBLE",
]);

export type EstadoCuadrilla = z.infer<typeof EstadoCuadrillaSchema>;

/**
 * Esquema de entrada para registrar una nueva cuadrilla operativa (H79).
 */
export const CrearCuadrillaInputSchema = z
  .object({
    nombre: z
      .string({ message: "El nombre de la cuadrilla es obligatorio" })
      .trim()
      .min(3, "El nombre de la cuadrilla debe tener al menos 3 caracteres")
      .max(100, "El nombre de la cuadrilla no puede exceder 100 caracteres")
      .openapi({
        example: "Cuadrilla Vías y Calles",
        description: "Nombre único identificador de la cuadrilla operativa municipal",
      }),
    delegacionId: z
      .string({ message: "La delegación municipal base es obligatoria" })
      .uuid("El identificador de delegación debe ser un UUID válido")
      .openapi({
        example: "30000000-0000-4000-8000-000000000001",
        description: "Identificador de la delegación municipal base adscrita",
      }),
    usuarioDelegadoId: z
      .string({ message: "El delegado de cuadrilla es obligatorio" })
      .uuid("El identificador del delegado debe ser un UUID válido")
      .openapi({
        example: "00000000-0000-4000-8000-000000000005",
        description: "Identificador del usuario asignado como delegado de cuadrilla",
      }),
  })
  .openapi({
    title: "CrearCuadrillaInput",
    description: "Cuerpo de solicitud para dar de alta una nueva cuadrilla operativa",
  });

export type CrearCuadrillaInput = z.infer<typeof CrearCuadrillaInputSchema>;

export const CuadrillaDelegacionSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
});

export const CuadrillaDelegadoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  email: z.string().email(),
  rut: z.string().nullable().optional(),
});

/**
 * Esquema de respuesta para la cuadrilla operativa conformada.
 */
export const CuadrillaResponseSchema = z
  .object({
    id: z.string().uuid(),
    nombre: z.string(),
    estado: EstadoCuadrillaSchema,
    delegacion: CuadrillaDelegacionSchema,
    delegado: CuadrillaDelegadoSchema,
    creadoEn: z.string(),
    creadoPorId: z.string().uuid().nullable().optional(),
  })
  .openapi({
    title: "CuadrillaResponse",
    description: "Información detallada de la cuadrilla operativa registrada",
  });

export type CuadrillaResponse = z.infer<typeof CuadrillaResponseSchema>;

export const CrearCuadrillaResponseSchema = z
  .object({
    message: z.string().openapi({ example: "Cuadrilla operativa creada exitosamente" }),
    data: CuadrillaResponseSchema,
  })
  .openapi({
    title: "CrearCuadrillaResponse",
    description: "Respuesta de éxito tras registrar una cuadrilla operativa",
  });

export type CrearCuadrillaResponse = z.infer<typeof CrearCuadrillaResponseSchema>;
