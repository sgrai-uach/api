import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const ModificarEmpleadoSchema = z
  .object({
    // Campos correspondientes a la tabla 'usuarios' (datos generales de empleado)
    rut: z
      .string()
      .regex(/^(\d{1,2}\.\d{3}\.\d{3}-[\dkK]|\d{7,8}-[\dkK])$/, "Formato de RUT chileno inválido (ej. 12.345.678-K)")
      .optional(),
    nombres: z.string().min(1, "El nombre no puede estar vacío").max(100).optional(),
    apellidos: z.string().min(1, "El apellido no puede estar vacío").max(100).optional(),
    email: z.string().email("Formato de correo electrónico inválido").max(150).optional(),
    telefono: z
      .string()
      .min(1, "El número de teléfono es obligatorio y no puede estar vacío")
      .max(50, "El teléfono no puede superar los 50 caracteres")
      .optional(),
    rol_id: z.string().uuid("rol_id debe ser un UUID válido").optional(),
    delegacion_id: z.string().uuid("delegacion_id debe ser un UUID válido").nullable().optional(),
    activo: z.boolean().optional(),
    fecha_ingreso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha de ingreso debe ser YYYY-MM-DD").nullable().optional(),
    fecha_salida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha de salida debe ser YYYY-MM-DD").nullable().optional(),

    // Campos correspondientes a la tabla 'usuario' (disponibilidad actual)
    estado_operativo: z
      .enum(["disponible", "en_mision", "en_patrulla", "descanso", "licencia", "inactivo"])
      .optional()
      .openapi({
        description:
          "Estado operativo (disponibilidad actual) persistido en `usuario.estado_operativo`. Los estados 'en_mision' y 'en_patrulla' sólo se admiten para perfiles de terreno.",
        example: "disponible",
      }),

    // Campos correspondientes a la ficha opcional de terreno (tabla 'personal')
    especialidad: z.string().max(100).nullable().optional(),
    cargo: z.string().max(100).nullable().optional(),
    disponible_terreno: z
      .boolean()
      .optional()
      .openapi({
        description: "Capacidad/aptitud para salir a terreno (sólo aplica a la ficha de terreno).",
        example: true,
      }),
    observaciones: z.string().nullable().optional(),
  })
  .strict();

export type ModificarEmpleadoDTO = z.infer<typeof ModificarEmpleadoSchema>;

export const EmpleadoConsolidadoSchema = z.object({
  usuario_id: z.string().uuid(),
  rut: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  email: z.string().email(),
  telefono: z.string().nullable().optional(),
  usuario_activo: z.boolean(),
  fecha_ingreso: z.string().nullable().optional(),
  fecha_salida: z.string().nullable().optional(),
  rol_id: z.string().uuid(),
  rol_codigo: z.string(),
  rol_nombre: z.string(),
  delegacion_id: z.string().uuid().nullable().optional(),
  delegacion_codigo: z.string().nullable().optional(),
  delegacion_nombre: z.string().nullable().optional(),
  personal_id: z.string().uuid().nullable().optional(),
  especialidad: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
  estado_operativo: z
    .enum(["disponible", "en_mision", "en_patrulla", "descanso", "licencia", "inactivo"])
    .nullable()
    .optional()
    .openapi({
      description: "Disponibilidad actual del funcionario (reside en `usuario.estado_operativo`).",
      example: "disponible",
    }),
  disponible_terreno: z.boolean().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  es_personal: z.boolean().optional(),
  usuario_updated_at: z.date().or(z.string()).optional(),
  personal_updated_at: z.date().or(z.string()).nullable().optional(),
});

export const ListarEmpleadosResponseSchema = z.object({
  data: z.array(EmpleadoConsolidadoSchema),
});

export const ActualizarEmpleadoResponseSchema = z.object({
  mensaje: z.string(),
  data: EmpleadoConsolidadoSchema,
});

export const CatalogosResponseSchema = z.object({
  data: z.object({
    roles: z.array(
      z.object({
        id: z.string().uuid(),
        codigo: z.string(),
        nombre: z.string(),
      })
    ),
    delegaciones: z.array(
      z.object({
        id: z.string().uuid(),
        codigo: z.string(),
        nombre: z.string(),
      })
    ),
    especialidades: z.array(z.string()),
    cargos: z.array(z.string()),
  }),
});

export const DetalleEmpleadoResponseSchema = z.object({
  data: EmpleadoConsolidadoSchema,
});

export const EliminarEmpleadoResponseSchema = z.object({
  message: z.string(),
  mensaje: z.string().optional(),
  data: z.object({
    usuario_id: z.string().uuid(),
    activo: z.boolean(),
    fecha_salida: z.string(),
  }),
});

