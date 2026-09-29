import type { EstadoRecurso } from "./recurso.schema";

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

/**
 * Calcula el estado de disponibilidad operativa considerando el uso en terreno y mantención.
 */
export function calcularDisponibilidadOperativa(
  estadoBase: EstadoRecurso,
  cantidadInventario: number,
  cantidadEnUso: number,
  cantidadMinima = 0
): EstadoRecurso {
  if (estadoBase === "EN_MANTENCION") {
    return "EN_MANTENCION";
  }

  const cantidadDisponible = Math.max(0, cantidadInventario - cantidadEnUso);

  if (cantidadInventario <= 0) {
    return "NO_DISPONIBLE";
  }

  if (cantidadDisponible === 0 && cantidadEnUso > 0) {
    return "ASIGNADO";
  }

  if (cantidadMinima > 0 && cantidadDisponible <= cantidadMinima) {
    return "BAJO_STOCK";
  }

  return "DISPONIBLE";
}

/**
 * Retorna la etiqueta descriptiva del tipo de recurso para la presentación en el frontend.
 */
export function obtenerEtiquetaTipoRecurso(esIndividual: boolean): string {
  return esIndividual ? "Vehículo o Maquinaria" : "Material o Insumo";
}
