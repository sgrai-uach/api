import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Redis from "ioredis";
import { setRedisClientForTesting } from "@/lib/redis";
import {
  guardarPosicionUnidad,
  obtenerPosicionUnidad,
  eliminarPosicionUnidad,
  obtenerTodasLasPosicionesActivas,
  limpiarCacheTelemetria,
} from "../telemetria-cache.service";
import type { TelemetriaPosicionDTO } from "../telemetria.schema";

describe("Telemetria Cache Service Tests (HU-70)", () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(async () => {
    delete process.env.REDIS_URL;
    setRedisClientForTesting(null);
    await limpiarCacheTelemetria();
  });

  afterEach(async () => {
    setRedisClientForTesting(null);
    if (originalRedisUrl !== undefined) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
    vi.restoreAllMocks();
  });

  it("debe guardar y recuperar la posición de una patrulla", async () => {
    const posicion: TelemetriaPosicionDTO = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.81422,
      lng: -73.24589,
      timestamp: "2026-11-24T15:00:00.000Z",
      rumbo: 90,
      precision: 5.0,
      velocidad: 0,
    };

    const { actualizada, posicion: guardado } = await guardarPosicionUnidad(posicion);
    expect(actualizada).toBe(true);
    expect(guardado.unidadId).toBe(posicion.unidadId);
    expect(guardado.recibidoEn).toBeDefined();

    const recuperado = await obtenerPosicionUnidad("PATRULLA", posicion.unidadId);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.lat).toBe(-39.81422);
    expect(recuperado?.lng).toBe(-73.24589);
    expect(recuperado?.rumbo).toBe(90);
  });

  it("debe ignorar paquetes GPS desordenados con timestamp más antiguo que el almacenado (BUG-H70-API-06)", async () => {
    const masReciente: TelemetriaPosicionDTO = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.82,
      lng: -73.25,
      timestamp: "2026-11-24T15:02:00.000Z",
    };
    const atrasada: TelemetriaPosicionDTO = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.81,
      lng: -73.24,
      timestamp: "2026-11-24T15:01:00.000Z",
    };

    const r1 = await guardarPosicionUnidad(masReciente);
    expect(r1.actualizada).toBe(true);

    const r2 = await guardarPosicionUnidad(atrasada);
    expect(r2.actualizada).toBe(false);
    expect(r2.posicion.lat).toBe(-39.82);

    const actual = await obtenerPosicionUnidad("PATRULLA", masReciente.unidadId);
    expect(actual?.lat).toBe(-39.82);
  });

  it("debe retornar null para una unidad que no tiene registros", async () => {
    const recuperado = await obtenerPosicionUnidad(
      "CUADRILLA",
      "00000000-0000-4000-8000-000000000000"
    );
    expect(recuperado).toBeNull();
  });

  it("debe listar, filtrar por tipoUnidad/unidadId y eliminar posiciones activas (CA-4)", async () => {
    const patrulla: TelemetriaPosicionDTO = {
      unidadId: "f1000000-0000-4000-8000-000000000001",
      tipoUnidad: "PATRULLA",
      lat: -39.81,
      lng: -73.24,
      timestamp: "2026-11-24T15:00:00.000Z",
    };

    const cuadrilla: TelemetriaPosicionDTO = {
      unidadId: "c1000000-0000-4000-8000-000000000001",
      tipoUnidad: "CUADRILLA",
      lat: -39.82,
      lng: -73.25,
      timestamp: "2026-11-24T15:01:00.000Z",
    };

    await guardarPosicionUnidad(patrulla);
    await guardarPosicionUnidad(cuadrilla);

    const todas = await obtenerTodasLasPosicionesActivas();
    expect(todas.length).toBe(2);

    const soloPatrullas = await obtenerTodasLasPosicionesActivas({ tipoUnidad: "PATRULLA" });
    expect(soloPatrullas.length).toBe(1);
    expect(soloPatrullas[0].unidadId).toBe(patrulla.unidadId);

    const eliminada = await eliminarPosicionUnidad("PATRULLA", patrulla.unidadId);
    expect(eliminada).toBe(true);

    const restantes = await obtenerTodasLasPosicionesActivas();
    expect(restantes.length).toBe(1);
    expect(restantes[0].unidadId).toBe(cuadrilla.unidadId);
  });

  it("debe activar fallback en memoria si pipeline.exec() de Redis retorna errores por comando (BUG-H70-API-06)", async () => {
    process.env.REDIS_URL = "redis://mock:6379";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mockRedis = {
      status: "ready",
      get: vi.fn().mockResolvedValue(null),
      smembers: vi.fn().mockResolvedValue([]),
      mget: vi.fn().mockResolvedValue([]),
      pipeline: vi.fn().mockReturnValue({
        set: vi.fn(),
        sadd: vi.fn(),
        exec: vi.fn().mockResolvedValue([[new Error("READONLY Redis replica"), null]]),
      }),
    } as unknown as Redis;

    setRedisClientForTesting(mockRedis);

    const posicion: TelemetriaPosicionDTO = {
      unidadId: "f1000000-0000-4000-8000-000000000099",
      tipoUnidad: "PATRULLA",
      lat: -39.83,
      lng: -73.26,
      timestamp: "2026-11-24T15:05:00.000Z",
    };

    const res = await guardarPosicionUnidad(posicion);
    expect(res.actualizada).toBe(true);
    expect(warnSpy).toHaveBeenCalled();

    const recuperada = await obtenerPosicionUnidad("PATRULLA", posicion.unidadId);
    expect(recuperada?.lat).toBe(-39.83);
  });
});
