import { describe, it, expect } from "vitest";
import {
  calcularPrioridadSugerida,
  generarResumenTecnicoEvaluacion,
  normalizarEvaluacionTerreno,
} from "../prioridad.utils";

describe("Motor de Cálculo de Prioridad Sugerida en Terreno (HU-38)", () => {
  it("debe calcular prioridad BAJA cuando no hay vulnerables ni riesgos críticos", () => {
    const resultado = calcularPrioridadSugerida({
      nucleoFamiliarTotal: 1,
      cantidadNinos: 0,
      cantidadAdultosMayores: 0,
      personasDiscapacitadas: 0,
      personasElectrodependientes: 0,
      mascotasAfectadas: 1,
      viviendasAfectadas: 1,
      nivelCompromisoVivienda: "SIN_DANO",
    });

    expect(resultado.prioridadSugerida).toBe("BAJA");
    expect(resultado.puntajeTotal).toBe(7); // 5 (1 persona) + 2 (1 mascota)
    expect(resultado.requiereAsistenciaSocialSugerido).toBe(false);
  });

  it("debe calcular prioridad MEDIA ante un núcleo familiar con daño LEVE y niños/mascotas", () => {
    const resultado = calcularPrioridadSugerida({
      nucleoFamiliarTotal: 4,
      cantidadNinos: 1,
      mascotasAfectadas: 1,
      viviendasAfectadas: 1,
      nivelCompromisoVivienda: "LEVE",
    });

    // 12 (4 personas) + 6 (1 niño) + 2 (1 mascota) + 8 (LEVE) = 28 pts -> MEDIA
    expect(resultado.prioridadSugerida).toBe("MEDIA");
    expect(resultado.puntajeTotal).toBe(28);
  });

  it("debe calcular prioridad ALTA ante daño MODERADO en vivienda con adultos mayores y niños", () => {
    const resultado = calcularPrioridadSugerida({
      nucleoFamiliarTotal: 4,
      cantidadNinos: 1,
      cantidadAdultosMayores: 1,
      viviendasAfectadas: 1,
      nivelCompromisoVivienda: "MODERADO",
    });

    // 12 (4 personas) + 6 (1 niño) + 7 (1 adulto mayor) + 22 (MODERADO) = 47 pts -> ALTA
    expect(resultado.prioridadSugerida).toBe("ALTA");
    expect(resultado.puntajeTotal).toBe(47);
    expect(resultado.requiereAsistenciaSocialSugerido).toBe(true);
  });

  it("debe calcular prioridad CRITICA inmediatamente si existe al menos una persona electrodependiente", () => {
    const resultado = calcularPrioridadSugerida({
      nucleoFamiliarTotal: 1,
      personasElectrodependientes: 1,
      nivelCompromisoVivienda: "SIN_DANO",
    });

    expect(resultado.prioridadSugerida).toBe("CRITICA");
    expect(resultado.requiereAsistenciaSocialSugerido).toBe(true);
    expect(
      resultado.factoresGatillantes.some((f) => f.includes("electrodependientes"))
    ).toBe(true);
  });

  it("debe calcular prioridad CRITICA ante puntaje acumulado >= 60 por vulnerabilidad, discapacidad y riesgos activos", () => {
    const resultado = calcularPrioridadSugerida({
      nucleoFamiliarTotal: 5,
      cantidadNinos: 2,
      personasDiscapacitadas: 1,
      mascotasAfectadas: 2,
      viviendasAfectadas: 1,
      nivelCompromisoVivienda: "MODERADO",
      riesgosActivos: {
        riesgoElectrico: true,
        riesgoEstructural: false,
        riesgoQuimicoSanitario: false,
        aislamientoVial: false,
      },
      detallesAdicionales: "Agua alcanza enchufes en primer piso.",
    });

    expect(resultado.prioridadSugerida).toBe("CRITICA");
    expect(resultado.puntajeTotal).toBeGreaterThanOrEqual(60);
    expect(resultado.evaluacionNormalizada.detallesAdicionales).toBe(
      "Agua alcanza enchufes en primer piso."
    );
  });

  it("debe ajustar nucleoFamiliarTotal si la suma de subgrupos vulnerables supera el total declarado y generar resumen técnico versionado", () => {
    const ev = normalizarEvaluacionTerreno({
      nucleoFamiliarTotal: 1,
      cantidadNinos: 2,
      personasDiscapacitadas: 1,
      mascotasAfectadas: 3,
      nivelCompromisoVivienda: "MODERADO",
    });

    expect(ev.nucleoFamiliarTotal).toBe(3);

    const resumenV1 = generarResumenTecnicoEvaluacion(1, ev, "ALTA", "CRITICA");
    expect(resumenV1).toContain("Evaluación en Terreno #1 (Inicial)");
    expect(resumenV1).toContain("2 niño(s)");
    expect(resumenV1).toContain("1 persona(s) con discapacidad");
    expect(resumenV1).toContain("3 mascota(s)");

    const resumenV2 = generarResumenTecnicoEvaluacion(2, ev, "ALTA", "CRITICA");
    expect(resumenV2).toContain("Evaluación en Terreno #2 (Rectificación)");
  });
});

