import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setRedisClientForTesting } from "@/lib/redis";
import * as socketModule from "@/lib/socket";
import * as authService from "@/modules/seguridad/auth.service";
import { ForbiddenError } from "@/modules/seguridad/errors";
import * as telemetriaRepo from "../telemetria.repository";
import {
  limpiarCacheTelemetria,
  obtenerPosicionUnidad,
  guardarPosicionUnidad,
} from "../telemetria-cache.service";
import {
  procesarTelemetriaPosicionService,
  detenerTelemetriaUnidadService,
  procesarDetencionTelemetriaClienteService,
  listarPosicionesActivasService,
} from "../telemetria.service";

describe("Telemetria Service — Reglas ICS, Seguridad y RBAC (HU-70)", () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const patrullaId = "f1000000-0000-4000-8000-000000000010";
  const liderId = "d1000000-0000-4000-8000-000000000001";

  beforeEach(async () => {
    delete process.env.REDIS_URL;
    setRedisClientForTesting(null);
    await limpiarCacheTelemetria();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalRedisUrl !== undefined) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
  });

  it("debe rechazar telemetría si el socket no está autenticado (BUG-H70-API-01)", async () => {
    const spyEmit = vi.spyOn(socketModule, "notificarTelemetriaPosicion").mockImplementation(() => {});

    const res = await procesarTelemetriaPosicionService(
      {
        unidadId: patrullaId,
        tipoUnidad: "PATRULLA",
        lat: -39.81422,
        lng: -73.24589,
        timestamp: "2026-11-24T15:00:00.000Z",
      },
      {}
    );

    expect(res.ok).toBe(false);
    expect(res.codigo).toBe("NO_AUTENTICADO");
    expect(spyEmit).not.toHaveBeenCalled();
  });

  it("debe rechazar telemetría si el usuario autenticado no pertenece a la unidad (BUG-H70-API-01)", async () => {
    vi.spyOn(telemetriaRepo, "verificarHabilitacionTelemetriaUnidadRepo").mockResolvedValueOnce({
      habilitada: false,
      codigo: "SIN_PERTENENCIA_UNIDAD",
      mensaje: "El usuario autenticado no pertenece a la patrulla verificadora indicada.",
    });
    const spyEmit = vi.spyOn(socketModule, "notificarTelemetriaPosicion").mockImplementation(() => {});

    const res = await procesarTelemetriaPosicionService(
      {
        unidadId: patrullaId,
        tipoUnidad: "PATRULLA",
        lat: -39.81422,
        lng: -73.24589,
        timestamp: "2026-11-24T15:00:00.000Z",
      },
      { usuarioId: "d1000000-0000-4000-8000-000000000099", rolCodigo: "PATRULLA_VERIFICADORA" }
    );

    expect(res.ok).toBe(false);
    expect(res.codigo).toBe("SIN_PERTENENCIA_UNIDAD");
    expect(spyEmit).not.toHaveBeenCalled();
  });

  it("debe rechazar telemetría, purgar Redis y emitir telemetria:inactiva si la unidad volvió a DISPONIBLE (CA-4 / BUG-H70-API-01)", async () => {
    await guardarPosicionUnidad({
      unidadId: patrullaId,
      tipoUnidad: "PATRULLA",
      lat: -39.81422,
      lng: -73.24589,
      timestamp: "2026-11-24T15:00:00.000Z",
    });

    vi.spyOn(telemetriaRepo, "verificarHabilitacionTelemetriaUnidadRepo").mockResolvedValueOnce({
      habilitada: false,
      codigo: "UNIDAD_DISPONIBLE",
      mensaje: "La patrulla verificadora se encuentra en estado DISPONIBLE.",
    });
    const spyInactiva = vi
      .spyOn(socketModule, "notificarTelemetriaInactiva")
      .mockImplementation(() => {});

    const res = await procesarTelemetriaPosicionService(
      {
        unidadId: patrullaId,
        tipoUnidad: "PATRULLA",
        lat: -39.815,
        lng: -73.246,
        timestamp: "2026-11-24T15:01:00.000Z",
      },
      { usuarioId: liderId, rolCodigo: "PATRULLA_VERIFICADORA" }
    );

    expect(res.ok).toBe(false);
    expect(res.codigo).toBe("UNIDAD_DISPONIBLE");
    expect(spyInactiva).toHaveBeenCalledWith(
      expect.objectContaining({
        unidadId: patrullaId,
        tipoUnidad: "PATRULLA",
        motivo: "UNIDAD_DISPONIBLE",
      })
    );
    expect(await obtenerPosicionUnidad("PATRULLA", patrullaId)).toBeNull();
  });

  it("debe persistir y retransmitir telemetría cuando la unidad tiene misión EN_CURSO y usuario autorizado", async () => {
    vi.spyOn(telemetriaRepo, "verificarHabilitacionTelemetriaUnidadRepo").mockResolvedValueOnce({
      habilitada: true,
      misionActivaId: "60000000-0000-4000-8000-000000000001",
      unidadNombre: "Patrulla Rápida Las Ánimas",
    });
    const spyEmit = vi.spyOn(socketModule, "notificarTelemetriaPosicion").mockImplementation(() => {});

    const res = await procesarTelemetriaPosicionService(
      {
        unidadId: patrullaId,
        tipoUnidad: "PATRULLA",
        lat: -39.81422,
        lng: -73.24589,
        timestamp: "2026-11-24T15:00:00.000Z",
        rumbo: 145,
        precision: 9.2,
      },
      { usuarioId: liderId, rolCodigo: "PATRULLA_VERIFICADORA" }
    );

    expect(res.ok).toBe(true);
    expect(res.omitidaPorObsoleta).toBe(false);
    expect(spyEmit).toHaveBeenCalledTimes(1);
    expect(await obtenerPosicionUnidad("PATRULLA", patrullaId)).not.toBeNull();
  });

  it("debe permitir detención explícita de telemetría (telemetria:detener) al integrante autorizado", async () => {
    await guardarPosicionUnidad({
      unidadId: patrullaId,
      tipoUnidad: "PATRULLA",
      lat: -39.81422,
      lng: -73.24589,
      timestamp: "2026-11-24T15:00:00.000Z",
    });

    vi.spyOn(telemetriaRepo, "verificarPertenenciaUnidadRepo").mockResolvedValueOnce({
      autorizada: true,
      unidadNombre: "Patrulla Rápida Las Ánimas",
    });
    const spyInactiva = vi
      .spyOn(socketModule, "notificarTelemetriaInactiva")
      .mockImplementation(() => {});

    const res = await procesarDetencionTelemetriaClienteService(
      { unidadId: patrullaId, tipoUnidad: "PATRULLA", motivo: "MISION_COMPLETADA" },
      { usuarioId: liderId }
    );

    expect(res.ok).toBe(true);
    expect(spyInactiva).toHaveBeenCalledTimes(1);
    expect(await obtenerPosicionUnidad("PATRULLA", patrullaId)).toBeNull();
  });

  it("debe exigir permiso RBAC 'misiones:leer' en listarPosicionesActivasService (BUG-H70-API-02)", async () => {
    vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: misiones:leer")
    );

    await expect(
      listarPosicionesActivasService("00000000-0000-4000-8000-000000000002")
    ).rejects.toThrow(ForbiddenError);
  });

  it("detenerTelemetriaUnidadService no debe emitir telemetria:inactiva si la unidad no tenía posición activa", async () => {
    const spyInactiva = vi
      .spyOn(socketModule, "notificarTelemetriaInactiva")
      .mockImplementation(() => {});

    const res = await detenerTelemetriaUnidadService("PATRULLA", patrullaId, "UNIDAD_DISPONIBLE");
    expect(res.eliminada).toBe(false);
    expect(spyInactiva).not.toHaveBeenCalled();
  });
});

