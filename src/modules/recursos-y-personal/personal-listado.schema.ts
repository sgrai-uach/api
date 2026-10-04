import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  type PaginationMeta,
} from "@/lib/shared/pagination.schema";

extendZodWithOpenApi(z);

export const EstadoOperativoPersonalEnum = z.enum([
  "disponible",
  "en_mision",
  "en_patrulla",
  "descanso",
  "licencia",
  "inactivo",
]);

/**
 * Esquema de consulta para listar personal/empleados con paginación y filtros.
 */
export const ListarPersonalQuerySchema = PaginationQuerySchema.extend({
  delegacionId: z.string().uuid().optional().openapi({
    description: "Filtrar por UUID de delegación territorial",
    example: "30000000-0000-4000-8000-000000000001",
  }),
  delegacion_id: z.string().uuid().optional(),
  rolId: z.string().uuid().optional().openapi({
    description: "Filtrar por UUID de rol",
  }),
  rol_id: z.string().uuid().optional(),
  estadoOperativo: EstadoOperativoPersonalEnum.optional().openapi({
    description: "Filtrar por estado operativo de personal en terreno",
    example: "disponible",
  }),
  estado_operativo: EstadoOperativoPersonalEnum.optional(),
  cargo: z.string().trim().optional().openapi({
    description: "Filtrar por cargo funcional de personal",
    example: "Conductor",
  }),
  especialidad: z.string().trim().optional().openapi({
    description: "Filtrar por especialidad técnica de personal",
    example: "Motosierrista",
  }),
  soloPersonal: z
    .preprocess((val) => val === "true" || val === true, z.boolean().optional())
    .openapi({
      description: "Si es true, solo retorna usuarios con ficha operativa en personal",
    }),
  solo_personal: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean().optional()
  ),
  busqueda: z.string().trim().optional().openapi({
    description: "Búsqueda textual sobre RUT, nombres, apellidos o email",
    example: "Pérez",
  }),
  q: z.string().trim().optional().openapi({
    description: "Alias rápido para búsqueda textual",
  }),
  ordenarPor: z.enum(["apellidos", "nombres", "rut"]).default("apellidos").openapi({
    description: "Campo de ordenamiento",
    example: "apellidos",
  }),
  ordenar_por: z.enum(["apellidos", "nombres", "rut"]).optional(),
  orden: z.enum(["asc", "desc"]).default("asc").openapi({
    description: "Dirección del ordenamiento",
    example: "asc",
  }),
});

export type ListarPersonalQuery = z.infer<typeof ListarPersonalQuerySchema>;

export const PersonalItemSchema = z.object({
  usuario_id: z.string().uuid(),
  rut: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  email: z.string().email(),
  telefono: z.string().nullable(),
  usuario_activo: z.boolean(),
  fecha_ingreso: z.string().nullable().optional(),
  fecha_salida: z.string().nullable().optional(),
  rol_id: z.string().uuid().nullable(),
  rol_codigo: z.string().nullable(),
  rol_nombre: z.string().nullable(),
  delegacion_id: z.string().uuid().nullable(),
  delegacion_codigo: z.string().nullable(),
  delegacion_nombre: z.string().nullable(),
  personal_id: z.string().uuid().nullable(),
  especialidad: z.string().nullable(),
  cargo: z.string().nullable(),
  estado_operativo: z.string().nullable(),
  disponible_terreno: z.boolean().nullable(),
  observaciones: z.string().nullable(),
  personal_updated_at: z.date().nullable().optional(),
  es_personal: z.boolean(),
});

export type PersonalItem = z.infer<typeof PersonalItemSchema>;

export const ListarPersonalResponseSchema = z.object({
  data: z.array(PersonalItemSchema),
  meta: PaginationMetaSchema,
});

export type ListarPersonalResponse = z.infer<typeof ListarPersonalResponseSchema>;
