import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import {
  PaginationQuerySchema,
  PaginationMetaSchema,
  type PaginationMeta,
} from "@/lib/shared/pagination.schema";

extendZodWithOpenApi(z);

export const EstadoMisionEnum = z.enum([
  "PLANIFICADA",
  "DESPACHADA",
  "EN_CURSO",
  "COMPLETADA",
  "CANCELADA",
  "RECHAZADA",
]);

export const TipoMisionEnum = z.enum([
  "VERIFICACION",
  "ATENCION_CUADRILLA",
  "PREVENCION",
  "RECUPERACION",
  "ASISTENCIA_SOCIAL",
]);

export const PrioridadMisionEnum = z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]);

export const ListarMisionesQuerySchema = PaginationQuerySchema.extend({
  estado: EstadoMisionEnum.optional().openapi({
    description: "Filtrar por estado operativo de la misión",
    example: "EN_CURSO",
  }),
  tipoMision: TipoMisionEnum.optional().openapi({
    description: "Filtrar por tipo táctico de misión",
    example: "VERIFICACION",
  }),
  prioridad: PrioridadMisionEnum.optional().openapi({
    description: "Filtrar por nivel de severidad o prioridad",
    example: "ALTA",
  }),
  delegacionId: z.string().uuid().optional().openapi({
    description: "Filtrar por UUID de delegación territorial asociada (vía incidente o patrulla/cuadrilla)",
    example: "30000000-0000-4000-8000-000000000001",
  }),
  incidenteId: z.string().uuid().optional().openapi({
    description: "Filtrar por UUID de incidente específico",
  }),
  cuadrillaId: z.string().uuid().optional().openapi({
    description: "Filtrar por UUID de cuadrilla asignada",
  }),
  patrullaId: z.string().uuid().optional().openapi({
    description: "Filtrar por UUID de patrulla verificadora asignada",
  }),
  busqueda: z.string().trim().optional().openapi({
    description: "Búsqueda textual sobre código, título o descripción de la misión",
    example: "Inundación",
  }),
  ordenarPor: z.enum(["creadoEn", "codigo", "prioridad"]).default("creadoEn").openapi({
    description: "Campo de ordenamiento",
    example: "creadoEn",
  }),
  orden: z.enum(["asc", "desc"]).default("desc").openapi({
    description: "Dirección de ordenamiento",
    example: "desc",
  }),
});

export type ListarMisionesQuery = z.infer<typeof ListarMisionesQuerySchema>;

export const MisionItemSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identificador único UUID de la misión" }),
  codigo: z.string().openapi({ description: "Código oficial de la misión (ej. MIS-12345)" }),
  titulo: z.string().openapi({ description: "Título breve descriptivo del objetivo" }),
  descripcion: z.string().nullable().openapi({ description: "Instrucciones detalladas de la orden de operación" }),
  tipoMision: TipoMisionEnum.openapi({ description: "Tipo táctico de misión" }),
  estado: EstadoMisionEnum.openapi({ description: "Estado operativo actual" }),
  prioridad: PrioridadMisionEnum.openapi({ description: "Nivel de prioridad o severidad" }),
  justificacionRechazo: z.string().nullable().optional().openapi({ description: "Justificación si la misión fue rechazada" }),
  incidenteId: z.string().uuid().nullable().optional().openapi({ description: "UUID de incidente asociado si aplica" }),
  incidenteCodigo: z.string().nullable().optional().openapi({ description: "Código legible del incidente" }),
  cuadrillaId: z.string().uuid().nullable().optional(),
  cuadrillaNombre: z.string().nullable().optional(),
  patrullaId: z.string().uuid().nullable().optional(),
  patrullaNombre: z.string().nullable().optional(),
  delegacionId: z.string().uuid().nullable().optional(),
  delegacionNombre: z.string().nullable().optional(),
  fechaInicio: z.string().nullable().optional(),
  fechaCierre: z.string().nullable().optional(),
  creadoEn: z.string().openapi({ description: "Fecha de registro ISO 8601" }),
  actualizadoEn: z.string().openapi({ description: "Fecha de última modificación ISO 8601" }),
});

export type MisionItem = z.infer<typeof MisionItemSchema>;

export const ListarMisionesResponseSchema = z.object({
  message: z.string().openapi({ example: "Listado de misiones obtenido exitosamente" }),
  data: z.array(MisionItemSchema),
  meta: PaginationMetaSchema,
});

export type ListarMisionesResponse = z.infer<typeof ListarMisionesResponseSchema>;
