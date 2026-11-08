import { describe, it, expect } from "vitest";
import {
  ReportarLlegadaBodySchema,
  ReportarLlegadaResponseSchema,
} from "../mision-llegada.schema";

describe("ReportarLlegadaBodySchema", () => {
  it("debe validar exitosamente coordenadas correctas dentro de rango", () => {
    const inputValido = {
      latitud: -39.81422,
      longitud: -73.24591,
      observaciones: "Arribo de cuadrilla al sector Isla Teja",
    };

    const resultado = ReportarLlegadaBodySchema.safeParse(inputValido);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.latitud).toBe(-39.81422);
      expect(resultado.data.longitud).toBe(-73.24591);
      expect(resultado.data.observaciones).toBe("Arribo de cuadrilla al sector Isla Teja");
    }
  });

  it("debe aceptar cuerpo sin observaciones opcionales", () => {
    const inputSinObservaciones = {
      latitud: -39.81422,
      longitud: -73.24591,
    };

    const resultado = ReportarLlegadaBodySchema.safeParse(inputSinObservaciones);
    expect(resultado.success).toBe(true);
  });

  it("debe rechazar latitud menor a -90 grados", () => {
    const inputLatInvalida = {
      latitud: -91.0,
      longitud: -73.24591,
    };

    const resultado = ReportarLlegadaBodySchema.safeParse(inputLatInvalida);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toContain("menor a -90");
    }
  });

  it("debe rechazar latitud mayor a 90 grados", () => {
    const inputLatInvalida = {
      latitud: 91.5,
      longitud: -73.24591,
    };

    const resultado = ReportarLlegadaBodySchema.safeParse(inputLatInvalida);
    expect(resultado.success).toBe(false);
  });

  it("debe rechazar longitud fuera de rango (-180 a 180)", () => {
    const inputLonInvalida = {
      latitud: -39.8,
      longitud: 181.0,
    };

    const resultado = ReportarLlegadaBodySchema.safeParse(inputLonInvalida);
    expect(resultado.success).toBe(false);
  });

  it("debe rechazar si falta latitud o longitud", () => {
    const inputFaltante = {
      observaciones: "Solo observaciones sin GPS",
    };

    const resultado = ReportarLlegadaBodySchema.safeParse(inputFaltante);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("debe rechazar observaciones que superen 500 caracteres", () => {
    const inputLargo = {
      latitud: -39.8,
      longitud: -73.2,
      observaciones: "A".repeat(501),
    };

    const resultado = ReportarLlegadaBodySchema.safeParse(inputLargo);
    expect(resultado.success).toBe(false);
  });
});

describe("ReportarLlegadaResponseSchema", () => {
  it("debe validar la estructura completa de respuesta exitosa", () => {
    const responseData = {
      message: "Llegada a terreno reportada exitosamente.",
      data: {
        hitoId: "80000000-0000-4000-8000-000000000001",
        misionId: "60000000-0000-4000-8000-000000000001",
        codigoMision: "MIS-2026-001",
        hito: "LLEGADA_TERRENO" as const,
        descripcion: "Llegada a terreno reportada por la brigada operativa.",
        latitud: -39.81422,
        longitud: -73.24591,
        registradoEn: "2026-11-08T19:30:00.000Z",
        registradoPor: {
          id: "00000000-0000-4000-8000-000000000005",
          nombre: "Pedro Delegado",
        },
        estadoMision: "EN_CURSO",
        miembrosActualizados: 3,
      },
    };

    const resultado = ReportarLlegadaResponseSchema.safeParse(responseData);
    expect(resultado.success).toBe(true);
  });
});

