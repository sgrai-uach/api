import type { EstadoRecurso } from "@/lib/db/types";

/**
 * Determina el estado de un recurso según su stock actual y umbral de alerta.
 *
 * Reglas:
 * - NO_DISPONIBLE: si cantidadInventario === 0
 * - BAJO_STOCK: si cantidadMinima > 0 y cantidadInventario <= cantidadMinima (con stock > 0)
 * - DISPONIBLE: si cantidadInventario > cantidadMinima (o cantidadMinima === 0 con stock > 0)
 */
export function determinarEstadoRecurso(
  cantidadInventario: number,
  cantidadMinima = 0
): EstadoRecurso {
  if (cantidadInventario <= 0) {
    return "NO_DISPONIBLE";
  }

  if (cantidadMinima > 0 && cantidadInventario <= cantidadMinima) {
    return "BAJO_STOCK";
  }

  return "DISPONIBLE";
}
