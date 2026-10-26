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
  codigo: z.string().nullable().optional(),
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
    recursos: z.array(CuadrillaRecursoDetalleSchema).default([]),
    trabajadores: z.array(CuadrillaTrabajadorDetalleSchema).default([]),
    totalRecursos: z.number().optional(),
    totalTrabajadores: z.number().optional(),
    activo: z.boolean().default(true).optional(),
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

/**
 * Esquema individual dentro del listado de cuadrillas (incluye conteos agregados).
 */
export const CuadrillaItemResponseSchema = CuadrillaResponseSchema.extend({
  totalRecursos: z.number().openapi({ example: 1, description: "Cantidad total de recursos asignados" }),
  totalTrabajadores: z.number().openapi({ example: 1, description: "Cantidad total de trabajadores asignados" }),
}).openapi({
  title: "CuadrillaItemResponse",
  description: "Ítem de cuadrilla con datos consolidados y conteos para listado",
});

export type CuadrillaItemResponse = z.infer<typeof CuadrillaItemResponseSchema>;

/**
 * Esquema de consulta para listado paginado de cuadrillas con filtros.
 */
export const ListarCuadrillasQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().positive().max(100).default(10).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  busqueda: z.string().trim().optional(),
  q: z.string().trim().optional(),
  delegacionId: z.string().uuid("El identificador de delegación debe ser un UUID válido").optional(),
  estado: EstadoCuadrillaSchema.optional(),
});

export type ListarCuadrillasQuery = z.infer<typeof ListarCuadrillasQuerySchema>;

export const PaginacionMetaSchema = z.object({
  total: z.number(),
  pagina: z.number(),
  limite: z.number(),
  paginasTotales: z.number(),
});

export const ListarCuadrillasResponseSchema = z
  .object({
    message: z.string().openapi({ example: "Listado de cuadrillas obtenido exitosamente" }),
    data: z.array(CuadrillaItemResponseSchema),
    meta: PaginacionMetaSchema,
  })
  .openapi({
    title: "ListarCuadrillasResponse",
    description: "Respuesta paginada del listado de cuadrillas operativas con filtros",
  });

export type ListarCuadrillasResponse = z.infer<typeof ListarCuadrillasResponseSchema>;

export const DetalleCuadrillaResponseSchema = z
  .object({
    message: z.string().openapi({ example: "Detalle de cuadrilla operativa obtenido exitosamente" }),
    data: CuadrillaResponseSchema,
  })
  .openapi({
    title: "DetalleCuadrillaResponse",
    description: "Respuesta de éxito con el detalle unitario de la cuadrilla operativa",
  });

export type DetalleCuadrillaResponse = z.infer<typeof DetalleCuadrillaResponseSchema>;

export const CrearCuadrillaResponseSchema = z
  .object({
    message: z.string().openapi({ example: "Cuadrilla operativa creada exitosamente" }),
    data: CuadrillaResponseSchema,
  })
  .openapi({
    title: "CrearCuadrillaResponse",
    description: "Respuesta de éxito tras registrar una nueva cuadrilla operativa",
  });

export type CrearCuadrillaResponse = z.infer<typeof CrearCuadrillaResponseSchema>;

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

export const DesactivarCuadrillaResponseSchema = z
  .object({
    message: z.string().openapi({ example: "Cuadrilla operativa desactivada exitosamente" }),
    data: z.object({
      id: z.string().uuid(),
      nombre: z.string(),
      activo: z.boolean().openapi({ example: false }),
      estado: z.string().openapi({ example: "NO_DISPONIBLE" }),
      recursosDesvinculados: z.number().openapi({ example: 2 }),
      trabajadoresDesvinculados: z.number().openapi({ example: 3 }),
      delegadoRevertido: z.boolean().openapi({ example: true }),
      eliminadoEn: z.string(),
      eliminadoPorId: z.string().uuid().nullable().optional(),
    }),
  })
  .openapi({
    title: "DesactivarCuadrillaResponse",
    description: "Respuesta de confirmación tras desactivar mediante baja lógica una cuadrilla operativa",
  });

export type DesactivarCuadrillaResponse = z.infer<typeof DesactivarCuadrillaResponseSchema>;

