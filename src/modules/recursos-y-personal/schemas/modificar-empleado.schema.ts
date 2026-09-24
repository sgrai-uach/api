import { z } from "zod";

export const ModificarEmpleadoSchema = z
  .object({
    // Campos correspondientes a la tabla 'usuarios' (datos generales de empleado)
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

    // Campos correspondientes a la tabla 'personal' (especialización operativa de terreno)
    especialidad: z.string().max(100).nullable().optional(),
    cargo: z.string().max(100).nullable().optional(),
    estado_operativo: z
      .enum(["disponible", "en_mision", "en_patrulla", "descanso", "licencia", "inactivo"])
      .optional(),
    disponible_terreno: z.boolean().optional(),
    observaciones: z.string().nullable().optional(),
  })
  .strict();

export type ModificarEmpleadoDTO = z.infer<typeof ModificarEmpleadoSchema>;
