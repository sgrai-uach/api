import type { PrioridadIncidente } from "@/lib/db/types";

export type NivelCompromisoVivienda =
  | "SIN_DANO"
  | "LEVE"
  | "MODERADO"
  | "GRAVE_INHABITABLE";

export interface RiesgosActivosEvaluacion {
  riesgoElectrico: boolean;
  riesgoEstructural: boolean;
  riesgoQuimicoSanitario: boolean;
  aislamientoVial: boolean;
}

export interface FamiliaAfectadaItem {
  id?: string;
  referencia?: string;
  nucleoFamiliarTotal: number;
  cantidadNinos: number;
  cantidadAdultosMayores: number;
  personasDiscapacitadas: number;
  personasElectrodependientes: number;
  mascotasAfectadas: number;
  nivelCompromisoVivienda: NivelCompromisoVivienda;
  requiereAsistenciaSocial: boolean;
}

export interface EvaluacionTerrenoNormalizada {
  familias?: FamiliaAfectadaItem[];
  nucleoFamiliarTotal: number;
  familiasAfectadas: number;
  cantidadNinos: number;
  cantidadAdultosMayores: number;
  personasDiscapacitadas: number;
  personasElectrodependientes: number;
  mascotasAfectadas: number;
  viviendasAfectadas: number;
  nivelCompromisoVivienda: NivelCompromisoVivienda;
  requiereEvacuacion: boolean;
  requiereAsistenciaSocial: boolean;
  requiereApoyoAdicional: boolean;
  riesgosActivos: RiesgosActivosEvaluacion;
  detallesAdicionales: string | null;
  accionesRealizadas: string | null;
  danosEstimados: string | null;
}

export interface ResultadoCalculoPrioridad {
  prioridadSugerida: PrioridadIncidente;
  puntajeTotal: number;
  factoresGatillantes: string[];
  requiereAsistenciaSocialSugerido: boolean;
  evaluacionNormalizada: EvaluacionTerrenoNormalizada;
}

/**
 * Normaliza un objeto parcial de evaluación en terreno asegurando valores por defecto seguros.
 */
export function normalizarEvaluacionTerreno(
  raw?: Partial<Record<string, unknown>> | null
): EvaluacionTerrenoNormalizada {
  const fuente = raw ?? {};
  const riesgosRaw =
    typeof fuente.riesgosActivos === "object" && fuente.riesgosActivos !== null
      ? (fuente.riesgosActivos as Record<string, unknown>)
      : typeof fuente.riesgos_activos === "object" && fuente.riesgos_activos !== null
        ? (fuente.riesgos_activos as Record<string, unknown>)
        : {};

  const num = (val: unknown, fallback = 0): number => {
    if (typeof val === "number" && Number.isFinite(val)) {
      return Math.max(0, Math.trunc(val));
    }
    if (typeof val === "string" && val.trim() !== "") {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) return Math.max(0, Math.trunc(parsed));
    }
    return fallback;
  };

  const bool = (val: unknown, fallback = false): boolean => {
    if (typeof val === "boolean") return val;
    if (val === "true" || val === 1) return true;
    if (val === "false" || val === 0) return false;
    return fallback;
  };

  const str = (val: unknown): string | null => {
    if (typeof val === "string") {
      const limpio = val.trim();
      return limpio.length > 0 ? limpio : null;
    }
    return null;
  };

  const compromisosValidos: NivelCompromisoVivienda[] = [
    "SIN_DANO",
    "LEVE",
    "MODERADO",
    "GRAVE_INHABITABLE",
  ];
  const ordenCompromiso: Record<NivelCompromisoVivienda, number> = {
    SIN_DANO: 0,
    LEVE: 1,
    MODERADO: 2,
    GRAVE_INHABITABLE: 3,
  };

  // Si se envían familias individualizadas, consolidar y validar
  const familiasRaw = Array.isArray(fuente.familias) ? (fuente.familias as Record<string, unknown>[]) : null;
  let familiasNormalizadas: FamiliaAfectadaItem[] | undefined = undefined;

  let sumaFamiliasPersonas = 0;
  let sumaFamiliasNinos = 0;
  let sumaFamiliasAdultos = 0;
  let sumaFamiliasDiscap = 0;
  let sumaFamiliasElectro = 0;
  let sumaFamiliasMascotas = 0;
  let maxCompromisoFamilias: NivelCompromisoVivienda = "SIN_DANO";
  let algunaFamiliaFibe = false;

  if (familiasRaw && familiasRaw.length > 0) {
    familiasNormalizadas = familiasRaw.map((f, idx) => {
      const fNinos = num(f.cantidadNinos ?? f.cantidad_ninos, 0);
      const fAdultos = num(f.cantidadAdultosMayores ?? f.cantidad_adultos_mayores, 0);
      const fDiscap = num(f.personasDiscapacitadas ?? f.personas_discapacitadas, 0);
      const fElectro = num(f.personasElectrodependientes ?? f.personas_electrodependientes, 0);
      const fSumaVuln = fNinos + fAdultos + fDiscap + fElectro;
      const fPersDecl = num(f.nucleoFamiliarTotal ?? f.nucleo_familiar_total, 0);
      const fTotal = Math.max(fPersDecl, fSumaVuln);
      const fMascotas = num(f.mascotasAfectadas ?? f.mascotas_afectadas, 0);
      const fCompRaw = String(f.nivelCompromisoVivienda ?? f.nivel_compromiso_vivienda ?? "SIN_DANO").toUpperCase();
      const fComp: NivelCompromisoVivienda = compromisosValidos.includes(fCompRaw as NivelCompromisoVivienda)
        ? (fCompRaw as NivelCompromisoVivienda)
        : "SIN_DANO";
      const fFibe = bool(f.requiereAsistenciaSocial ?? f.requiere_asistencia_social, false);

      sumaFamiliasPersonas += fTotal;
      sumaFamiliasNinos += fNinos;
      sumaFamiliasAdultos += fAdultos;
      sumaFamiliasDiscap += fDiscap;
      sumaFamiliasElectro += fElectro;
      sumaFamiliasMascotas += fMascotas;
      if (ordenCompromiso[fComp] > ordenCompromiso[maxCompromisoFamilias]) {
        maxCompromisoFamilias = fComp;
      }
      if (fFibe) {
        algunaFamiliaFibe = true;
      }

      return {
        id: str(f.id) || `fam-${idx + 1}`,
        referencia: str(f.referencia) || undefined,
        nucleoFamiliarTotal: fTotal,
        cantidadNinos: fNinos,
        cantidadAdultosMayores: fAdultos,
        personasDiscapacitadas: fDiscap,
        personasElectrodependientes: fElectro,
        mascotasAfectadas: fMascotas,
        nivelCompromisoVivienda: fComp,
        requiereAsistenciaSocial: fFibe,
      };
    });
  }

  const cantidadNinos = familiasNormalizadas ? sumaFamiliasNinos : num(fuente.cantidadNinos ?? fuente.cantidad_ninos, 0);
  const cantidadAdultosMayores = familiasNormalizadas
    ? sumaFamiliasAdultos
    : num(fuente.cantidadAdultosMayores ?? fuente.cantidad_adultos_mayores, 0);
  const personasDiscapacitadas = familiasNormalizadas
    ? sumaFamiliasDiscap
    : num(fuente.personasDiscapacitadas ?? fuente.personas_discapacitadas, 0);
  const personasElectrodependientes = familiasNormalizadas
    ? sumaFamiliasElectro
    : num(fuente.personasElectrodependientes ?? fuente.personas_electrodependientes, 0);

  const sumaVulnerables =
    cantidadNinos + cantidadAdultosMayores + personasDiscapacitadas + personasElectrodependientes;

  const nucleoDeclarado = familiasNormalizadas
    ? sumaFamiliasPersonas
    : num(
        fuente.nucleoFamiliarTotal ??
          fuente.nucleo_familiar_total ??
          fuente.personasAfectadas ??
          fuente.personas_afectadas,
        0
      );

  const nucleoFamiliarTotal = Math.max(nucleoDeclarado, sumaVulnerables);
  const familiasAfectadas = familiasNormalizadas
    ? familiasNormalizadas.length
    : num(fuente.familiasAfectadas ?? fuente.familias_afectadas, nucleoFamiliarTotal > 0 ? 1 : 0);
  const mascotasAfectadas = familiasNormalizadas
    ? sumaFamiliasMascotas
    : num(fuente.mascotasAfectadas ?? fuente.mascotas_afectadas, 0);
  const viviendasAfectadas = familiasNormalizadas
    ? familiasNormalizadas.length
    : num(fuente.viviendasAfectadas ?? fuente.viviendas_afectadas, nucleoFamiliarTotal > 0 ? 1 : 0);

  const compromisoRaw = String(
    fuente.nivelCompromisoVivienda ?? fuente.nivel_compromiso_vivienda ?? "SIN_DANO"
  ).toUpperCase();

  const nivelCompromisoVivienda: NivelCompromisoVivienda = familiasNormalizadas
    ? maxCompromisoFamilias
    : compromisosValidos.includes(compromisoRaw as NivelCompromisoVivienda)
      ? (compromisoRaw as NivelCompromisoVivienda)
      : "SIN_DANO";

  const requiereEvacuacion = bool(fuente.requiereEvacuacion ?? fuente.requiere_evacuacion, false);
  const requiereAsistenciaSocial = familiasNormalizadas
    ? algunaFamiliaFibe || bool(fuente.requiereAsistenciaSocial ?? fuente.requiere_asistencia_social, false)
    : bool(fuente.requiereAsistenciaSocial ?? fuente.requiere_asistencia_social, false);
  const requiereApoyoAdicional = bool(
    fuente.requiereApoyoAdicional ?? fuente.requiere_apoyo_adicional,
    false
  );

  const riesgosActivos: RiesgosActivosEvaluacion = {
    riesgoElectrico: bool(
      riesgosRaw.riesgoElectrico ??
        riesgosRaw.riesgo_electrico ??
        fuente.riesgoElectrico ??
        fuente.riesgo_electrico,
      false
    ),
    riesgoEstructural: bool(
      riesgosRaw.riesgoEstructural ??
        riesgosRaw.riesgo_estructural ??
        fuente.riesgoEstructural ??
        fuente.riesgo_estructural,
      false
    ),
    riesgoQuimicoSanitario: bool(
      riesgosRaw.riesgoQuimicoSanitario ??
        riesgosRaw.riesgo_quimico_sanitario ??
        fuente.riesgoQuimicoSanitario ??
        fuente.riesgo_quimico_sanitario,
      false
    ),
    aislamientoVial: bool(
      riesgosRaw.aislamientoVial ??
        riesgosRaw.aislamiento_vial ??
        fuente.aislamientoVial ??
        fuente.aislamiento_vial,
      false
    ),
  };

  return {
    familias: familiasNormalizadas,
    nucleoFamiliarTotal,
    familiasAfectadas,
    cantidadNinos,
    cantidadAdultosMayores,
    personasDiscapacitadas,
    personasElectrodependientes,
    mascotasAfectadas,
    viviendasAfectadas,
    nivelCompromisoVivienda,
    requiereEvacuacion,
    requiereAsistenciaSocial,
    requiereApoyoAdicional,
    riesgosActivos,
    detallesAdicionales: str(
      fuente.detallesAdicionales ?? fuente.detalles_adicionales ?? fuente.observaciones
    ),
    accionesRealizadas: str(fuente.accionesRealizadas ?? fuente.acciones_realizadas),
    danosEstimados: str(fuente.danosEstimados ?? fuente.danos_estimados),
  };
}

/**
 * Calcula de forma determinista la `prioridad_sugerida` ('BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA')
 * basándose en la evaluación técnica presencial levantada por la patrulla verificadora.
 */
export function calcularPrioridadSugerida(
  raw?: Partial<Record<string, unknown>> | null
): ResultadoCalculoPrioridad {
  const ev = normalizarEvaluacionTerreno(raw);
  let puntajeTotal = 0;
  const factoresGatillantes: string[] = [];
  let forzarCritica = false;

  // 1. Tamaño del núcleo familiar afectado
  if (ev.nucleoFamiliarTotal >= 8) {
    puntajeTotal += 20;
    factoresGatillantes.push(
      `Núcleo familiar numeroso afectado: ${ev.nucleoFamiliarTotal} personas (+20 pts)`
    );
  } else if (ev.nucleoFamiliarTotal >= 4) {
    puntajeTotal += 12;
    factoresGatillantes.push(
      `Núcleo familiar afectado: ${ev.nucleoFamiliarTotal} personas (+12 pts)`
    );
  } else if (ev.nucleoFamiliarTotal >= 1) {
    puntajeTotal += 5;
    factoresGatillantes.push(
      `Personas afectadas en el núcleo: ${ev.nucleoFamiliarTotal} (+5 pts)`
    );
  }

  // 2. Niños, niñas y adolescentes (< 14 años)
  if (ev.cantidadNinos > 0) {
    const ptsNinos = Math.min(24, ev.cantidadNinos * 6);
    puntajeTotal += ptsNinos;
    factoresGatillantes.push(`Niños afectados: ${ev.cantidadNinos} (+${ptsNinos} pts)`);
  }

  // 3. Adultos mayores (>= 65 años)
  if (ev.cantidadAdultosMayores > 0) {
    const ptsMayores = Math.min(28, ev.cantidadAdultosMayores * 7);
    puntajeTotal += ptsMayores;
    factoresGatillantes.push(
      `Adultos mayores afectados: ${ev.cantidadAdultosMayores} (+${ptsMayores} pts)`
    );
  }

  // 4. Personas con discapacidad o movilidad reducida
  if (ev.personasDiscapacitadas > 0) {
    const ptsDiscapacidad = Math.min(36, ev.personasDiscapacitadas * 12);
    puntajeTotal += ptsDiscapacidad;
    factoresGatillantes.push(
      `Personas con discapacidad o movilidad reducida: ${ev.personasDiscapacitadas} (+${ptsDiscapacidad} pts)`
    );
  }

  // 5. Personas electrodependientes (Disparo directo a CRITICA)
  if (ev.personasElectrodependientes > 0) {
    const ptsElectro = ev.personasElectrodependientes * 50;
    puntajeTotal += ptsElectro;
    forzarCritica = true;
    factoresGatillantes.push(
      `Pacientes electrodependientes en riesgo vital: ${ev.personasElectrodependientes} (+${ptsElectro} pts — Prioridad CRÍTICA directa)`
    );
  }

  // 6. Mascotas o animales afectados
  if (ev.mascotasAfectadas >= 4) {
    const ptsMascotas = Math.min(10, 5 + (ev.mascotasAfectadas - 4));
    puntajeTotal += ptsMascotas;
    factoresGatillantes.push(`Mascotas/animales afectados: ${ev.mascotasAfectadas} (+${ptsMascotas} pts)`);
  } else if (ev.mascotasAfectadas >= 1) {
    const ptsMascotas = ev.mascotasAfectadas * 2;
    puntajeTotal += ptsMascotas;
    factoresGatillantes.push(`Mascotas afectadas: ${ev.mascotasAfectadas} (+${ptsMascotas} pts)`);
  }

  // 7. Nivel de compromiso habitacional y cantidad de viviendas
  if (ev.nivelCompromisoVivienda === "GRAVE_INHABITABLE") {
    puntajeTotal += 45;
    factoresGatillantes.push("Compromiso de vivienda GRAVE / INHABITABLE (+45 pts)");
  } else if (ev.nivelCompromisoVivienda === "MODERADO") {
    puntajeTotal += 22;
    factoresGatillantes.push("Compromiso de vivienda MODERADO (+22 pts)");
  } else if (ev.nivelCompromisoVivienda === "LEVE") {
    puntajeTotal += 8;
    factoresGatillantes.push("Compromiso de vivienda LEVE (+8 pts)");
  }

  if (ev.viviendasAfectadas >= 6) {
    puntajeTotal += 20;
    factoresGatillantes.push(`Afectación multi-vivienda severa: ${ev.viviendasAfectadas} inmuebles (+20 pts)`);
  } else if (ev.viviendasAfectadas >= 3) {
    puntajeTotal += 10;
    factoresGatillantes.push(`Múltiples viviendas afectadas: ${ev.viviendasAfectadas} inmuebles (+10 pts)`);
  }

  // 8. Evacuación y riesgos activos en el sitio
  if (ev.requiereEvacuacion) {
    puntajeTotal += 35;
    factoresGatillantes.push("Requiere evacuación inmediata de residentes (+35 pts)");
    if (
      ev.personasDiscapacitadas > 0 ||
      ev.cantidadAdultosMayores > 0 ||
      ev.cantidadNinos > 0 ||
      ev.nivelCompromisoVivienda === "GRAVE_INHABITABLE"
    ) {
      forzarCritica = true;
    }
  }

  if (ev.riesgosActivos.riesgoEstructural) {
    puntajeTotal += 25;
    factoresGatillantes.push("Riesgo estructural / peligro de colapso activo (+25 pts)");
  }
  if (ev.riesgosActivos.riesgoElectrico) {
    puntajeTotal += 20;
    factoresGatillantes.push("Riesgo eléctrico activo en el lugar (+20 pts)");
  }
  if (ev.riesgosActivos.riesgoQuimicoSanitario) {
    puntajeTotal += 15;
    factoresGatillantes.push("Riesgo químico o sanitario activo (+15 pts)");
  }
  if (ev.riesgosActivos.aislamientoVial) {
    puntajeTotal += 15;
    factoresGatillantes.push("Aislamiento vial / bloqueo de accesos (+15 pts)");
  }

  if (factoresGatillantes.length === 0) {
    factoresGatillantes.push("Sin afectación humana directa ni riesgos críticos detectados (0 pts)");
  }

  let prioridadSugerida: PrioridadIncidente;
  if (forzarCritica || puntajeTotal >= 60) {
    prioridadSugerida = "CRITICA";
  } else if (puntajeTotal >= 35) {
    prioridadSugerida = "ALTA";
  } else if (puntajeTotal >= 15) {
    prioridadSugerida = "MEDIA";
  } else {
    prioridadSugerida = "BAJA";
  }

  const requiereAsistenciaSocialSugerido =
    ev.requiereAsistenciaSocial ||
    ((ev.nivelCompromisoVivienda === "MODERADO" ||
      ev.nivelCompromisoVivienda === "GRAVE_INHABITABLE") &&
      ev.nucleoFamiliarTotal > 0) ||
    ev.personasElectrodependientes > 0;

  return {
    prioridadSugerida,
    puntajeTotal,
    factoresGatillantes,
    requiereAsistenciaSocialSugerido,
    evaluacionNormalizada: ev,
  };
}

/**
 * Genera el resumen técnico legible para `reporte_terreno.resumen_tecnico` a partir
 * de la evaluación en terreno y el número de versión del reporte.
 */
export function generarResumenTecnicoEvaluacion(
  versionReporte: number,
  ev: EvaluacionTerrenoNormalizada,
  prioridadSugerida: PrioridadIncidente,
  prioridadAsignada: PrioridadIncidente
): string {
  const prefijo =
    versionReporte > 1
      ? `Evaluación en Terreno #${versionReporte} (Rectificación)`
      : `Evaluación en Terreno #1 (Inicial)`;

  const desgloseGrupos: string[] = [];
  if (ev.cantidadNinos > 0) desgloseGrupos.push(`${ev.cantidadNinos} niño(s)`);
  if (ev.cantidadAdultosMayores > 0)
    desgloseGrupos.push(`${ev.cantidadAdultosMayores} adulto(s) mayor(es)`);
  if (ev.personasDiscapacitadas > 0)
    desgloseGrupos.push(`${ev.personasDiscapacitadas} persona(s) con discapacidad`);
  if (ev.personasElectrodependientes > 0)
    desgloseGrupos.push(`${ev.personasElectrodependientes} electrodependiente(s)`);
  if (ev.mascotasAfectadas > 0) desgloseGrupos.push(`${ev.mascotasAfectadas} mascota(s)`);

  const detalleGrupos =
    desgloseGrupos.length > 0 ? ` (${desgloseGrupos.join(", ")})` : "";

  const textoNucleo = `Núcleo familiar afectado: ${ev.nucleoFamiliarTotal} persona(s)${detalleGrupos}.`;
  const textoVivienda = `Viviendas afectadas: ${ev.viviendasAfectadas} (Compromiso: ${ev.nivelCompromisoVivienda}).`;
  const textoPrioridad = `Prioridad sugerida: ${prioridadSugerida} | Prioridad asignada: ${prioridadAsignada}.`;

  return `${prefijo} — ${textoNucleo} ${textoVivienda} ${textoPrioridad}`;
}

