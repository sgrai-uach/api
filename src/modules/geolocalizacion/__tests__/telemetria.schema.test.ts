import { describe, it, expect } from "vitest";
import {
  TelemetriaPosicionPayloadSchema,
  DetenerTelemetriaPayloadSchema,
  ListarPosicionesQuerySchema,
} from "../telemetria.schema";

describe("Telemetria Schema Tests (HU-70)", () => {
  it("debe validar correctamente un payload completo de patrulla", () => {
    const payload = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.81422,
      lng: -73.24589,
      timestamp: "2026-11-24T15:00:00.000Z",
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

  it("debe validar correctamente un payload mínimo de cuadrilla con timestamp epoch numérico", () => {
    const payload = {
      unidadId: "50000000-0000-4000-8000-000000000001",
      tipoUnidad: "CUADRILLA",
      lat: -39.825,
      lng: -73.238,
      timestamp: 1731423600000,
    };

    const resultado = TelemetriaPosicionPayloadSchema.safeParse(payload);
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.tipoUnidad).toBe("CUADRILLA");
      expect(resultado.data.timestamp).toBe("2024-11-12T15:00:00.000Z");
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
      timestamp: "2026-11-24T15:00:00.000Z",
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
      timestamp: "2026-11-24T15:00:00.000Z",
    };

    const resultado = TelemetriaPosicionPayloadSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it("debe rechazar coordenadas fuera del rango WGS84 (-90 a 90, -180 a 180) o no finitas", () => {
    const casos = [
      { lat: -95.0, lng: -73.2 },
      { lat: -39.8, lng: 185.0 },
      { lat: Number.NaN, lng: -73.2 },
      { lat: -39.8, lng: Number.POSITIVE_INFINITY },
    ];

    for (const coords of casos) {
      const resultado = TelemetriaPosicionPayloadSchema.safeParse({
        unidadId: "f1000000-0000-4000-8000-000000000001",
        tipoUnidad: "PATRULLA",
        ...coords,
        timestamp: "2026-11-24T15:00:00.000Z",
      });
      expect(resultado.success).toBe(false);
    }
  });

  it("debe rechazar rumbo o precision negativos o mayores a 360", () => {
    const payloadNegativo = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.8,
      lng: -73.2,
      timestamp: "2026-11-24T15:00:00.000Z",
      rumbo: -5,
      precision: -1,
    };
    expect(TelemetriaPosicionPayloadSchema.safeParse(payloadNegativo).success).toBe(false);

    const payloadRumboExcedido = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.8,
      lng: -73.2,
      timestamp: "2026-11-24T15:00:00.000Z",
      rumbo: 361,
    };
    expect(TelemetriaPosicionPayloadSchema.safeParse(payloadRumboExcedido).success).toBe(false);
  });

  it("debe rechazar timestamp malformado o epoch fuera de rango sin lanzar RangeError (BUG-H70-API-05)", () => {
    const timestampsInvalidos: unknown[] = [
      "no-es-una-fecha",
      "",
      "   ",
      9e18,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ];

    for (const ts of timestampsInvalidos) {
      const resultado = TelemetriaPosicionPayloadSchema.safeParse({
        unidadId: "f1000000-0000-4000-8000-000000000001",
        tipoUnidad: "PATRULLA",
        lat: -39.81422,
        lng: -73.24589,
        timestamp: ts,
      });
      expect(resultado.success).toBe(false);
    }
  });

  it("debe validar DetenerTelemetriaPayloadSchema y ListarPosicionesQuerySchema", () => {
    expect(
      DetenerTelemetriaPayloadSchema.safeParse({
        unidadId: "f1000000-0000-4000-8000-000000000001",
        tipoUnidad: "PATRULLA",
        motivo: "MISION_COMPLETADA",
      }).success
    ).toBe(true);

    expect(
      ListarPosicionesQuerySchema.safeParse({
        tipoUnidad: "CUADRILLA",
        unidadId: "c1000000-0000-4000-8000-000000000001",
      }).success
    ).toBe(true);

    expect(
      ListarPosicionesQuerySchema.safeParse({
        tipoUnidad: "INVALIDO",
      }).success
    ).toBe(false);

    expect(
      ListarPosicionesQuerySchema.safeParse({
        unidadId: "no-uuid",
      }).success
    ).toBe(false);
  });
});
