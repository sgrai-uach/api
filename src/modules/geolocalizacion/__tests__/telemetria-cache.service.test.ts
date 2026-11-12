import { describe, it, expect, beforeEach } from "vitest";
import {
  guardarPosicionUnidad,
  obtenerPosicionUnidad,
  obtenerTodasLasPosicionesActivas,
  limpiarCacheTelemetria,
} from "../telemetria-cache.service";
import type { TelemetriaPosicionDTO } from "../telemetria.schema";

describe("Telemetria Cache Service Tests", () => {
  beforeEach(async () => {
    await limpiarCacheTelemetria();
  });

  it("debe guardar y recuperar la posición de una patrulla", async () => {
    const posicion: TelemetriaPosicionDTO = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.81422,
      lng: -73.24589,
      timestamp: "2026-11-12T15:00:00.000Z",
      rumbo: 90,
      precision: 5.0,
      velocidad: 0,
    };

    const guardado = await guardarPosicionUnidad(posicion);
    expect(guardado.unidadId).toBe(posicion.unidadId);
    expect(guardado.recibidoEn).toBeDefined();

    const recuperado = await obtenerPosicionUnidad("PATRULLA", posicion.unidadId);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.lat).toBe(-39.81422);
    expect(recuperado?.lng).toBe(-73.24589);
    expect(recuperado?.rumbo).toBe(90);
  });

  it("debe retornar null para una unidad que no tiene registros", async () => {
    const recuperado = await obtenerPosicionUnidad(
      "CUADRILLA",
      "00000000-0000-4000-8000-000000000000"
    );
    expect(recuperado).toBeNull();
  });

  it("debe listar todas las posiciones activas de múltiples unidades", async () => {
    const patrulla: TelemetriaPosicionDTO = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.81,
      lng: -73.24,
      timestamp: new Date().toISOString(),
    };

    const cuadrilla: TelemetriaPosicionDTO = {
      unidadId: "c1000000-0000-4000-8000-000000000001",
      tipoUnidad: "CUADRILLA",
      lat: -39.82,
      lng: -73.25,
      timestamp: new Date().toISOString(),
    };

    await guardarPosicionUnidad(patrulla);
    await guardarPosicionUnidad(cuadrilla);

    const todas = await obtenerTodasLasPosicionesActivas();
    expect(todas.length).toBe(2);

    const ids = todas.map((u) => u.unidadId);
    expect(ids).toContain(patrulla.unidadId);
    expect(ids).toContain(cuadrilla.unidadId);
  });
});
