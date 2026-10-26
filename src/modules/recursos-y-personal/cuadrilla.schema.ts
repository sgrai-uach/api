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

export const CuadrillaIdParamSchema = z.object({
  id: z.string().uuid("El identificador de cuadrilla debe ser un UUID válido"),
});

export type CuadrillaIdParam = z.infer<typeof CuadrillaIdParamSchema>;

/**
 * Esquema de recurso asignado a la cuadrilla.
 */
export const ItemRecursoCuadrillaInputSchema = z
  .object({
    recursoId: z
      .string({ message: "El identificador del recurso es obligatorio" })
      .uuid("El identificador de recurso debe ser un UUID válido")
      .openapi({
        example: "e1000000-0000-4000-8000-000000000001",
        description: "UUID del recurso logístico, maquinaria o vehículo a dotar",
      }),
    cantidad: z
      .number({ message: "La cantidad asignada debe ser un número" })
      .int("La cantidad asignada debe ser un entero")
      .positive("La cantidad asignada debe ser mayor a 0")
      .default(1)
      .openapi({
        example: 1,
        description: "Cantidad de unidades del recurso a asignar",
      }),
  })
  .openapi({
    title: "ItemRecursoCuadrillaInput",
    description: "Recurso logístico a dotar en la cuadrilla",
  });

export type ItemRecursoCuadrillaInput = z.infer<typeof ItemRecursoCuadrillaInputSchema>;

/**
 * Esquema de trabajador operativo asignado a la cuadrilla.
 */
export const ItemTrabajadorCuadrillaInputSchema = z
  .object({
    personalId: z
      .string({ message: "El identificador de personal es obligatorio" })
      .uuid("El identificador de personal debe ser un UUID válido")
      .openapi({
        example: "40000000-0000-4000-8000-000000000001",
        description: "UUID de la ficha operativa de personal del funcionario",
      }),
  })
  .openapi({
    title: "ItemTrabajadorCuadrillaInput",
    description: "Funcionario operativo asignado a la cuadrilla",
  });

export type ItemTrabajadorCuadrillaInput = z.infer<typeof ItemTrabajadorCuadrillaInputSchema>;

/**
 * Esquema de entrada para modificar los datos y dotación de una cuadrilla (H81).
 */
export const EditarCuadrillaInputSchema = z
  .object({
    nombre: z
      .string({ message: "El nombre de la cuadrilla es obligatorio" })
      .trim()
      .min(3, "El nombre de la cuadrilla debe tener al menos 3 caracteres")
      .max(100, "El nombre de la cuadrilla no puede exceder 100 caracteres")
      .openapi({
        example: "Cuadrilla Vías y Calles Central",
        description: "Nombre único actualizado de la cuadrilla",
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
        description: "Identificador del usuario asignado como líder/delegado de la cuadrilla",
      }),
    recursos: z
      .array(ItemRecursoCuadrillaInputSchema)
      .default([])
      .openapi({
        description: "Listado de recursos materiales, vehículos y maquinarias que conforman la dotación",
      }),
    trabajadores: z
      .array(ItemTrabajadorCuadrillaInputSchema)
      .default([])
      .openapi({
        description: "Listado de trabajadores operativos asignados a la cuadrilla",
      }),
  })
  .openapi({
    title: "EditarCuadrillaInput",
    description: "Cuerpo de solicitud para actualizar los datos, delegado y dotación de una cuadrilla",
  });

export type EditarCuadrillaInput = z.infer<typeof EditarCuadrillaInputSchema>;

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

export const CuadrillaRecursoDetalleSchema = z.object({
  id: z.string().uuid(),
  recursoId: z.string().uuid(),
  nombre: z.string(),
  cantidadAsignada: z.number(),
  esIndividual: z.boolean(),
});

export const CuadrillaTrabajadorDetalleSchema = z.object({
  id: z.string().uuid(),
  personalId: z.string().uuid(),
  usuarioId: z.string().uuid(),
  nombre: z.string(),
  rut: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
  especialidad: z.string().nullable().optional(),
  asignadoEn: z.string(),
});

/**
 * Esquema de respuesta completo para una cuadrilla operativa con dotación.
 */
export const CuadrillaResponseSchema = z
  .object({
    id: z.string().uuid(),
    nombre: z.string(),
    estado: EstadoCuadrillaSchema,
    delegacion: CuadrillaDelegacionSchema,
    delegado: CuadrillaDelegadoSchema,
    recursos: z.array(CuadrillaRecursoDetalleSchema),
    trabajadores: z.array(CuadrillaTrabajadorDetalleSchema),
    creadoEn: z.string(),
    actualizadoEn: z.string().nullable().optional(),
    actualizadoPorId: z.string().uuid().nullable().optional(),
    creadoPorId: z.string().uuid().nullable().optional(),
  })
  .openapi({
    title: "CuadrillaResponse",
    description: "Información detallada de la cuadrilla operativa y su dotación",
  });

export type CuadrillaResponse = z.infer<typeof CuadrillaResponseSchema>;

export const EditarCuadrillaResponseSchema = z
  .object({
    message: z.string().openapi({ example: "Cuadrilla operativa actualizada exitosamente" }),
    data: CuadrillaResponseSchema,
  })
  .openapi({
    title: "EditarCuadrillaResponse",
    description: "Respuesta de éxito tras actualizar la cuadrilla operativa",
  });

export type EditarCuadrillaResponse = z.infer<typeof EditarCuadrillaResponseSchema>;
