import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setSocketServer,
  notificarTelemetriaPosicion,
} from "../index";
import type { PosicionUnidadActivaDTO } from "@/modules/geolocalizacion/telemetria.schema";

describe("Socket.io Telemetría Tests", () => {
  const dummyPosicion: PosicionUnidadActivaDTO = {
    unidadId: "f1000000-0000-4000-8000-000000000001",
    tipoUnidad: "PATRULLA",
    lat: -39.81422,
    lng: -73.24589,
    timestamp: "2026-11-12T15:00:00.000Z",
    rumbo: 180,
    precision: 8.5,
    velocidad: 12.0,
    recibidoEn: "2026-11-12T15:00:01.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe emitir telemetria:posicion a la sala 'mapa' cuando ioInstance está disponible", () => {
    const emitMock = vi.fn();
    const toMock = vi.fn().mockReturnValue({ emit: emitMock });
    const mockIo = {
      to: toMock,
    } as unknown as Parameters<typeof setSocketServer>[0];

    setSocketServer(mockIo);

    notificarTelemetriaPosicion(dummyPosicion);

    expect(toMock).toHaveBeenCalledWith("mapa");
    expect(emitMock).toHaveBeenCalledWith("telemetria:posicion", dummyPosicion);
  });
});
