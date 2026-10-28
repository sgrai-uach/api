import type { EstadoOperativo } from "@/lib/db/types";

/**
 * Reglas de dominio del estado operativo (H11).
 *
 * El estado operativo representa la *disponibilidad actual* del funcionario y reside
 * en `usuario.estado_operativo`. La aptitud para salir a terreno es un atributo distinto
 * (`personal.disponible_terreno`).
 */

/** Estados que sólo tienen sentido para funcionarios con perfil de terreno. */
export const ESTADOS_OPERATIVOS_TERRENO: EstadoOperativo[] = [
  "en_mision",
  "en_patrulla",
];

/** Estados permitidos para usuarios administrativos (sin ficha de terreno). */
export const ESTADOS_OPERATIVOS_ADMINISTRATIVOS: EstadoOperativo[] = [
  "disponible",
  "descanso",
  "licencia",
  "inactivo",
];

export const ESTADOS_OPERATIVOS: EstadoOperativo[] = [
  "disponible",
  "en_mision",
  "en_patrulla",
  "descanso",
  "licencia",
  "inactivo",
];

/** Códigos de rol que poseen ficha operativa de terreno. */
export const ROLES_TERRENO = [
  "PATRULLA_VERIFICADORA",
  "DELEGADO_CUADRILLA",
  "BRIGADISTA",
];

export function esRolTerreno(codigoRol?: string | null): boolean {
  return ROLES_TERRENO.includes((codigoRol || "").toUpperCase());
}

export function esEstadoOperativoDeTerreno(estado?: EstadoOperativo | null): boolean {
  return estado ? ESTADOS_OPERATIVOS_TERRENO.includes(estado) : false;
}

export class EstadoOperativoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EstadoOperativoInvalidoError";
  }
}

/**
 * Resuelve el estado operativo final a persistir en `usuario.estado_operativo`.
 *
 * Reglas:
 * - Si el usuario está inactivo (`activo = false`), el estado sólo puede ser `inactivo`.
 * - `en_mision` y `en_patrulla` son exclusivos de perfiles de terreno (rol de terreno o
 *   `disponible_terreno = true`).
 * - Los usuarios administrativos sólo admiten disponible, descanso, licencia o inactivo.
 */
export function resolverEstadoOperativo(params: {
  estadoSolicitado?: EstadoOperativo | null;
  esRolTerreno: boolean;
  disponibleTerreno?: boolean | null;
  activo: boolean;
  estadoActual?: EstadoOperativo | null;
}): EstadoOperativo {
  const { estadoSolicitado, esRolTerreno, disponibleTerreno, activo, estadoActual } = params;

  if (!activo) {
    return "inactivo";
  }

  if (!estadoSolicitado) {
    return estadoActual ?? "disponible";
  }

  const esTerrenoEfectivo = esRolTerreno || disponibleTerreno === true;

  if (esEstadoOperativoDeTerreno(estadoSolicitado) && !esTerrenoEfectivo) {
    throw new EstadoOperativoInvalidoError(
      `El estado '${estadoSolicitado}' sólo es válido para funcionarios con perfil de terreno.`
    );
  }

  if (!esTerrenoEfectivo && !ESTADOS_OPERATIVOS_ADMINISTRATIVOS.includes(estadoSolicitado)) {
    throw new EstadoOperativoInvalidoError(
      `El estado '${estadoSolicitado}' no es válido para un funcionario administrativo.`
    );
  }

  return estadoSolicitado;
}
