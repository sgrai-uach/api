import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as telemetriaCache from "@/modules/geolocalizacion/telemetria-cache.service";
import { UnauthorizedError } from "@/modules/seguridad/errors";

describe("Endpoint GET /api/geolocalizacion/posiciones (HU-70)", () => {
  const dummyUsuarioId = "00000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe retornar 401 si el usuario no proporciona cabecera de autenticación", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null as unknown as string);

    const req = new NextRequest("http://localhost:3000/api/geolocalizacion/posiciones");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("Se requiere cabecera de autenticación");
  });

  it("debe retornar 401 si la autenticación falla con UnauthorizedError", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Token expirado")
    );

    const req = new NextRequest("http://localhost:3000/api/geolocalizacion/posiciones");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("Token expirado");
  });

  it("debe retornar 200 y la lista de posiciones activas", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(dummyUsuarioId);
    vi.spyOn(telemetriaCache, "obtenerTodasLasPosicionesActivas").mockResolvedValueOnce([
      {
        unidadId: "f1000000-0000-4000-8000-000000000001",
        tipoUnidad: "PATRULLA",
        lat: -39.81422,
        lng: -73.24589,
        timestamp: "2026-11-12T15:00:00.000Z",
        rumbo: 180,
        precision: 10,
        velocidad: 5,
        recibidoEn: "2026-11-12T15:00:01.000Z",
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/geolocalizacion/posiciones");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe("Posiciones activas obtenidas exitosamente.");
    expect(json.data.length).toBe(1);
    expect(json.data[0].unidadId).toBe("f1000000-0000-4000-8000-000000000001");
    expect(json.data[0].lat).toBe(-39.81422);
  });

  it("debe retornar 500 si ocurre un fallo no previsto", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(dummyUsuarioId);
    vi.spyOn(telemetriaCache, "obtenerTodasLasPosicionesActivas").mockRejectedValueOnce(
      new Error("Fallo crítico en Redis")
    );

    const req = new NextRequest("http://localhost:3000/api/geolocalizacion/posiciones");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.message).toContain("Error interno");
  });
});
