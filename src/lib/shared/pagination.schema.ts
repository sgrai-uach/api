import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/**
 * Parámetros base de paginación para todos los endpoints de listado.
 * Convención estándar SGRAI: siempre `page` y `limit` (inglés).
 */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).openapi({
    description: "Número de página (inicia en 1)",
    example: 1,
  }),
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    description: "Cantidad de elementos por página (máximo 100)",
    example: 20,
  }),
});

/**
 * Metadatos de paginación estándar que acompaña toda respuesta de listado.
 */
export const PaginationMetaSchema = z.object({
  total: z.number().int().openapi({ description: "Total de registros coincidentes" }),
  page: z.number().int().openapi({ description: "Página actual" }),
  limit: z.number().int().openapi({ description: "Elementos por página" }),
  totalPages: z.number().int().openapi({ description: "Total de páginas" }),
  hasNext: z.boolean().openapi({ description: "¿Existe página siguiente?" }),
  hasPrev: z.boolean().openapi({ description: "¿Existe página anterior?" }),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

/**
 * Helper para calcular metadatos de paginación.
 */
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
