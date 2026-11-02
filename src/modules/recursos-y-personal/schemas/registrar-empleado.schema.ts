import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { EmpleadoConsolidadoSchema } from "./modificar-empleado.schema";

extendZodWithOpenApi(z);

/**
 * Validador algorítmico de RUT chileno mediante Módulo 11.
 * Admite formatos con o sin puntos y con guion (ej. 12.345.678-K, 12345678-k, 12345678-5).
 */
export function validarRutChileno(rutCompleto: string): boolean {
  if (!rutCompleto || typeof rutCompleto !== "string") return false;
  const limpio = rutCompleto.replace(/[\.\-\s]/g, "").toUpperCase();
  if (limpio.length < 8 || limpio.length > 9) return false;

  const cuerpo = limpio.slice(0, -1);
  const dvIngresado = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;

  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  const dvCalculado = resto === 11 ? "0" : resto === 10 ? "K" : resto.toString();
  return dvCalculado === dvIngresado;
}

/**
 * Esquema de validación para el registro de nuevos funcionarios en el sistema SGRAI (HU-10).
 */
export const RegistrarEmpleadoSchema = z
  .object({
    // Datos personales e institucionales (tabla 'usuario')
    rut: z
      .string()
      .regex(
        /^(\d{1,2}\.\d{3}\.\d{3}-[\dkK]|\d{7,8}-[\dkK])$/,
        "Formato de RUT chileno inválido (ej. 12.345.678-K o 12345678-K)"
      )
      .refine(validarRutChileno, "El dígito verificador del RUT ingresado no es válido según algoritmo Módulo 11")
      .openapi({
        description: "RUT chileno del funcionario con dígito verificador",
        example: "12.345.678-5",
      }),
    nombres: z
      .string()
      .min(1, "El nombre es obligatorio y no puede estar vacío")
      .max(100, "El nombre no puede superar los 100 caracteres")
      .openapi({
        description: "Nombres del funcionario",
        example: "Juan Carlos",
      }),
    apellidos: z
      .string()
      .min(1, "El apellido es obligatorio y no puede estar vacío")
      .max(100, "El apellido no puede superar los 100 caracteres")
      .openapi({
        description: "Apellidos del funcionario",
        example: "Pérez González",
      }),
    email: z
      .string()
      .email("Formato de correo electrónico inválido")
      .max(150, "El correo electrónico no puede superar los 150 caracteres")
      .openapi({
        description: "Correo electrónico del funcionario",
        example: "juan.perez@valdivia.cl",
      }),
    telefono: z
      .string()
      .min(1, "El teléfono de contacto es obligatorio y no puede estar vacío")
      .max(50, "El teléfono no puede superar los 50 caracteres")
      .openapi({
        description: "Número telefónico de contacto municipal",
        example: "+56912345678",
      }),
    password: z
      .string()
      .min(8, "La contraseña inicial debe tener al menos 8 caracteres")
      .regex(
        /^(?=.*[a-zA-Z])(?=.*\d)/,
        "La contraseña inicial debe ser alfanumérica (contener al menos una letra y un número)"
      )
      .openapi({
        description: "Contraseña inicial asignada al funcionario (mínimo 8 caracteres alfanuméricos)",
        example: "Valdivia2026!",
      }),
    rol_id: z
      .string()
      .uuid("rol_id debe ser un UUID válido")
      .openapi({
        description: "UUID del rol asignado al funcionario",
        example: "20000000-0000-4000-8000-000000000004",
      }),
    delegacion_id: z
      .string()
      .uuid("delegacion_id debe ser un UUID válido")
      .openapi({
        description: "UUID de la delegación territorial a la que pertenece el funcionario",
        example: "30000000-0000-4000-8000-000000000001",
      }),
    activo: z
      .boolean()
      .optional()
      .default(true)
      .openapi({
        description: "Estado de activación de la cuenta (por defecto true)",
        example: true,
      }),
    fecha_ingreso: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha de ingreso debe ser YYYY-MM-DD")
      .optional()
      .openapi({
        description: "Fecha de ingreso institucional (por defecto la fecha actual)",
        example: "2026-10-01",
      }),

    // Campos técnicos para ficha operativa de terreno (tabla 'personal')
    cargo: z
      .string()
      .max(100, "El cargo no puede superar los 100 caracteres")
      .nullable()
      .optional()
      .openapi({
        description: "Cargo operativo de terreno",
        example: "Brigadista Terreno",
      }),
    especialidad: z
      .string()
      .max(100, "La especialidad no puede superar los 100 caracteres")
      .nullable()
      .optional()
      .openapi({
        description: "Especialidad técnica para labores de terreno",
        example: "Motosierrista y Conductor",
      }),
    estado_operativo: z
      .enum(["disponible", "en_mision", "en_patrulla", "descanso", "licencia", "inactivo"])
      .optional()
      .openapi({
        description:
          "Estado operativo inicial (disponibilidad actual). Se persiste en `usuario.estado_operativo`. Por defecto 'disponible' si la cuenta está activa e 'inactivo' si la cuenta se crea deshabilitada. Los estados 'en_mision' y 'en_patrulla' sólo se admiten para perfiles de terreno.",
        example: "disponible",
      }),
    disponible_terreno: z
      .boolean()
      .optional()
      .openapi({
        description:
          "Capacidad/aptitud para salir a emergencias (sólo ficha de terreno). Por defecto true si es rol de terreno. `null` significa que no aplica (usuario sin ficha de terreno).",
        example: true,
      }),
    observaciones: z
      .string()
      .nullable()
      .optional()
      .openapi({
        description: "Observaciones técnicas o médicas para terreno",
        example: "Apto para faenas pesadas y turnos nocturnos",
      }),
  })
  .strict();

export type RegistrarEmpleadoDTO = z.infer<typeof RegistrarEmpleadoSchema>;

export const RegistrarEmpleadoResponseSchema = z.object({
  mensaje: z.string().openapi({
    description: "Mensaje de confirmación de registro",
    example: "Funcionario registrado exitosamente",
  }),
  data: EmpleadoConsolidadoSchema,
});
