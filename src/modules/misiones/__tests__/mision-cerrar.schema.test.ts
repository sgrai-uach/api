import { describe, it, expect } from "vitest";
import {
  CerrarMisionCuadrillaInputSchema,
  CerrarMisionCuadrillaBodySchema,
} from "../mision.schema";

describe("Esquema CerrarMisionCuadrilla (HU-68)", () => {
  const recursoId1 = "b0000000-0000-4000-8000-000000000010";
  const recursoId2 = "b0000000-0000-4000-8000-000000000011";
  const adjuntoId1 = "f0000000-0000-4000-8000-000000000001";

  it("debe aceptar un informe técnico válido en snake_case sin materiales consumidos", () => {
    const payload = {
      resumen_faenas:
        "Limpieza completa de sumidero obstruido y restablecimiento del escurrimiento normal.",
      horas_hombre: 4.5,
      estado_terreno: "CONTROLADO",
      observaciones: "Tránsito vehicular habilitado sin riesgo.",
    };

    const parsed = CerrarMisionCuadrillaInputSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.resumenFaenas).toContain("Limpieza completa");
      expect(parsed.data.horasHombre).toBe(4.5);
      expect(parsed.data.estadoTerreno).toBe("CONTROLADO");
      expect(parsed.data.materialesConsumidos).toEqual([]);
      expect(parsed.data.requiereApoyoAdicional).toBe(false);
      expect(parsed.data.requiereAsistenciaSocial).toBe(false);
    }
  });

  it("debe aceptar alias en camelCase y normalizar materiales, horas hombre (2 decimales) y adjuntos", () => {
    const payload = {
      resumenFaenas:
        "Contención perimetral ejecutada con sacos de arena y retiro de ramas caídas.",
      horasHombre: 6.336,
      estadoTerreno: "FINALIZADO",
      materialesConsumidos: [
        {
          recursoId: recursoId1,
          cantidad: 20,
          unidad: "sacos",
          observacion: "Muro de contención sector sur",
        },
        {
          recurso_id: recursoId2,
          cantidad: 2,
        },
      ],
      requiereApoyoAdicional: true,
      requiereAsistenciaSocial: true,
      adjuntoIds: [adjuntoId1],
      latitud: -39.819588,
      longitud: -73.245209,
    };

    const parsed = CerrarMisionCuadrillaInputSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.horasHombre).toBe(6.34);
      expect(parsed.data.materialesConsumidos).toHaveLength(2);
      expect(parsed.data.materialesConsumidos[0]).toEqual({
        recursoId: recursoId1,
        cantidad: 20,
        unidad: "sacos",
        observacion: "Muro de contención sector sur",
      });
      expect(parsed.data.adjuntoIds).toEqual([adjuntoId1]);
      expect(parsed.data.requiereApoyoAdicional).toBe(true);
      expect(parsed.data.requiereAsistenciaSocial).toBe(true);
    }
  });

  it("debe rechazar resumen_faenas faltante o menor a 15 caracteres útiles tras trim", () => {
    const corto = CerrarMisionCuadrillaInputSchema.safeParse({
      resumen_faenas: "   Muy corto   ",
      horas_hombre: 2,
      estado_terreno: "ESTABLE",
    });

    expect(corto.success).toBe(false);
    if (!corto.success) {
      expect(corto.error.issues.some((i) => i.path.includes("resumen_faenas"))).toBe(true);
    }

    const bodyCheck = CerrarMisionCuadrillaBodySchema.safeParse({
      resumen_faenas: "   Muy corto   ",
      horas_hombre: 2,
      estado_terreno: "ESTABLE",
    });
    expect(bodyCheck.success).toBe(false);
  });

  it("debe rechazar horas_hombre menores o iguales a 0, no numéricas o superiores a 1000", () => {
    for (const horas of [0, -2, 1000.5, "4"]) {
      const res = CerrarMisionCuadrillaInputSchema.safeParse({
        resumen_faenas: "Despeje total de calzada principal y retiro de escombros.",
        horas_hombre: horas,
        estado_terreno: "CONTROLADO",
      });
      expect(res.success).toBe(false);
    }
  });

  it("debe rechazar estado_terreno fuera del enum canónico", () => {
    const res = CerrarMisionCuadrillaInputSchema.safeParse({
      resumen_faenas: "Despeje total de calzada principal y retiro de escombros.",
      horas_hombre: 3,
      estado_terreno: "DESCONOCIDO",
    });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes("estado_terreno"))).toBe(true);
    }
  });

  it("debe rechazar materiales con recurso_id duplicado, UUID inválido o cantidad no entera <= 0", () => {
    const duplicados = CerrarMisionCuadrillaInputSchema.safeParse({
      resumen_faenas: "Despeje total de calzada principal y retiro de escombros.",
      horas_hombre: 5,
      estado_terreno: "CONTROLADO",
      materiales_consumidos: [
        { recurso_id: recursoId1, cantidad: 4 },
        { recurso_id: recursoId1, cantidad: 2 },
      ],
    });
    expect(duplicados.success).toBe(false);

    const cantidadInvalida = CerrarMisionCuadrillaInputSchema.safeParse({
      resumen_faenas: "Despeje total de calzada principal y retiro de escombros.",
      horas_hombre: 5,
      estado_terreno: "CONTROLADO",
      materiales_consumidos: [{ recurso_id: recursoId1, cantidad: 0 }],
    });
    expect(cantidadInvalida.success).toBe(false);

    const cantidadDecimal = CerrarMisionCuadrillaInputSchema.safeParse({
      resumen_faenas: "Despeje total de calzada principal y retiro de escombros.",
      horas_hombre: 5,
      estado_terreno: "CONTROLADO",
      materiales_consumidos: [{ recurso_id: recursoId1, cantidad: 1.5 }],
    });
    expect(cantidadDecimal.success).toBe(false);

    const uuidInvalido = CerrarMisionCuadrillaInputSchema.safeParse({
      resumen_faenas: "Despeje total de calzada principal y retiro de escombros.",
      horas_hombre: 5,
      estado_terreno: "CONTROLADO",
      materiales_consumidos: [{ recurso_id: "no-uuid", cantidad: 1 }],
    });
    expect(uuidInvalido.success).toBe(false);
  });

  it("debe exigir paridad completa en coordenadas GPS opcionales", () => {
    const soloLatitud = CerrarMisionCuadrillaInputSchema.safeParse({
      resumen_faenas: "Despeje total de calzada principal y retiro de escombros.",
      horas_hombre: 4,
      estado_terreno: "ESTABLE",
      latitud: -39.81,
    });
    expect(soloLatitud.success).toBe(false);

    const sinCoordenadas = CerrarMisionCuadrillaInputSchema.safeParse({
      resumen_faenas: "Despeje total de calzada principal y retiro de escombros.",
      horas_hombre: 4,
      estado_terreno: "ESTABLE",
    });
    expect(sinCoordenadas.success).toBe(true);
  });
});
