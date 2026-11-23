import { describe, it, expect } from "vitest";
import {
  TelemetriaPosicionPayloadSchema,
} from "../telemetria.schema";

describe("Telemetria Schema Tests", () => {
  it("debe validar correctamente un payload completo de patrulla", () => {
    const payload = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.81422,
      lng: -73.24589,
      timestamp: "2026-11-12T15:00:00.000Z",
      rumbo: 180.5,
      precision: 12.3,
      velocidad: 4.5,
    };

    const resultado = TelemetriaPosicionPayloadSchema.safeParse(payload);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.unidadId).toBe(payload.unidadId);
      expect(resultado.data.tipoUnidad).toBe("PATRULLA");
      expect(resultado.data.lat).toBe(-39.81422);
      expect(resultado.data.lng).toBe(-73.24589);
      expect(resultado.data.rumbo).toBe(180.5);
      expect(resultado.data.precision).toBe(12.3);
      expect(resultado.data.velocidad).toBe(4.5);
    }
  });

  it("debe validar correctamente un payload mínimo de cuadrilla sin campos opcionales", () => {
    const payload = {
      unidadId: "50000000-0000-4000-8000-000000000001",
      tipoUnidad: "CUADRILLA",
      lat: -39.825,
      lng: -73.238,
      timestamp: 1731423600000, // milisegundos numéricos
    };

    const resultado = TelemetriaPosicionPayloadSchema.safeParse(payload);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipoUnidad).toBe("CUADRILLA");
      expect(typeof resultado.data.timestamp).toBe("string");
      expect(resultado.data.rumbo).toBeUndefined();
      expect(resultado.data.precision).toBeUndefined();
    }
  });

  it("debe rechazar un unidadId que no sea UUID", () => {
    const payload = {
      unidadId: "patrulla-123",
      tipoUnidad: "PATRULLA",
      lat: -39.8,
      lng: -73.2,
      timestamp: new Date().toISOString(),
    };

    const resultado = TelemetriaPosicionPayloadSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it("debe rechazar un tipo de unidad inválido", () => {
    const payload = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "HELICOPTERO",
      lat: -39.8,
      lng: -73.2,
      timestamp: new Date().toISOString(),
    };

    const resultado = TelemetriaPosicionPayloadSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it("debe rechazar coordenadas fuera del rango WGS84 (-90 a 90, -180 a 180)", () => {
    const payloadLatInvalida = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -95.0, // menor que -90
      lng: -73.2,
      timestamp: new Date().toISOString(),
    };

    const resultadoLat = TelemetriaPosicionPayloadSchema.safeParse(payloadLatInvalida);
    expect(resultadoLat.success).toBe(false);

    const payloadLngInvalida = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.8,
      lng: 185.0, // mayor que 180
      timestamp: new Date().toISOString(),
    };

    const resultadoLng = TelemetriaPosicionPayloadSchema.safeParse(payloadLngInvalida);
    expect(resultadoLng.success).toBe(false);
  });

  it("debe rechazar rumbo o precision negativos", () => {
    const payload = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.8,
      lng: -73.2,
      timestamp: new Date().toISOString(),
      rumbo: -5,
      precision: -1,
    };

    const resultado = TelemetriaPosicionPayloadSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });
});
