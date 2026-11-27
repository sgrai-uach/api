import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

/**
 * Entidades que pueden vincularse transversalmente a un Evento ATP (H60).
 * El valor interno se traduce a la tabla correspondiente en el repositorio.
 */
export const TipoEntidadVinculableSchema = z.enum([
  "INCIDENTE",
  "EVENTO_PREVENCION",
  "RECUPERACION",
  "EVENTO_ASISTENCIA_SOCIAL",
]);

export type TipoEntidadVinculable = z.infer<typeof TipoEntidadVinculableSchema>;

const ListaIdsSchema = z
  .array(z.string().uuid("Cada identificador debe ser un UUID válido"))
  .max(200, "No se pueden procesar más de 200 entidades por solicitud")
  .optional()
  .default([]);

/**
 * Contrato de vinculación/desvinculación en lote.
 * Al menos uno de los grupos debe contener identificadores.
 */
export const VincularEntidadesInputSchema = z
  .object({
    incidenteIds: ListaIdsSchema,
    eventoPrevencionIds: ListaIdsSchema,
    recuperacionIds: ListaIdsSchema,
    eventoAsistenciaSocialIds: ListaIdsSchema,
  })
  .superRefine((datos, ctx) => {
    const total =
      datos.incidenteIds.length +
      datos.eventoPrevencionIds.length +
      datos.recuperacionIds.length +
      datos.eventoAsistenciaSocialIds.length;

    if (total === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["incidenteIds"],
        message: "Debe indicar al menos una entidad para vincular o desvincular",
      });
    }
  });

export type VincularEntidadesInput = z.infer<typeof VincularEntidadesInputSchema>;

/**
 * Identificador inválido dentro de la solicitud.
 */
export const VinculoNoEncontradoSchema = z.object({
  tipo: TipoEntidadVinculableSchema,
  id: z.string(),
});

/**
 * Entidad afectada por la operación de vinculación.
 */
export const EntidadVinculadaResumenSchema = z.object({
  tipo: TipoEntidadVinculableSchema,
  id: z.string().uuid(),
  codigo: z.string(),
  nombre: z.string().nullable(),
  eventoAtpIdAnterior: z.string().uuid().nullable().optional(),
});
