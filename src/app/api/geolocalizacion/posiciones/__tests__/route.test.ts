import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as telemetriaService from "@/modules/geolocalizacion/telemetria.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/errors";

describe("Endpoint GET /api/geolocalizacion/posiciones (HU-70)", () => {
  const dummyEncargadoId = "00000000-0000-4000-8000-000000000003";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe retornar 401 si el usuario no proporciona cabecera de autenticación", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3001/api/geolocalizacion/posiciones");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("Se requiere cabecera de autenticación");
  });

  it("debe retornar 401 si la autenticación falla con UnauthorizedError", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Token de sesión inválido o expirado.")
    );

    const req = new NextRequest("http://localhost:3001/api/geolocalizacion/posiciones");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("inválido o expirado");
  });

  it("debe retornar 403 Forbidden si el rol del usuario carece del permiso misiones:leer (BUG-H70-API-02)", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(
      "00000000-0000-4000-8000-000000000002"
    );
    vi.spyOn(telemetriaService, "listarPosicionesActivasService").mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: misiones:leer")
    );

    const req = new NextRequest("http://localhost:3001/api/geolocalizacion/posiciones");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("misiones:leer");
  });

  it("debe retornar 400 Bad Request ante parámetros de consulta inválidos", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(dummyEncargadoId);

    const req = new NextRequest(
      "http://localhost:3001/api/geolocalizacion/posiciones?tipoUnidad=INVALIDO&unidadId=no-uuid"
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("Parámetros de consulta inválidos");
    expect(Array.isArray(json.errors)).toBe(true);
    expect(json.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("debe retornar 200 y la lista de posiciones activas aplicando filtros válidos", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(dummyEncargadoId);
    const spyListar = vi
      .spyOn(telemetriaService, "listarPosicionesActivasService")
      .mockResolvedValueOnce([
        {
          unidadId: "f1000000-0000-4000-8000-000000000001",
          tipoUnidad: "PATRULLA",
          lat: -39.81422,
          lng: -73.24589,
          timestamp: "2026-11-24T15:00:00.000Z",
          rumbo: 180,
          precision: 10,
          velocidad: 5,
          recibidoEn: "2026-11-24T15:00:01.000Z",
        },
      ]);

    const req = new NextRequest(
      "http://localhost:3001/api/geolocalizacion/posiciones?tipoUnidad=PATRULLA"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(spyListar).toHaveBeenCalledWith(dummyEncargadoId, { tipoUnidad: "PATRULLA" });
    const json = await res.json();
    expect(json.message).toBe("Posiciones activas obtenidas exitosamente.");
    expect(json.data.length).toBe(1);
    expect(json.data[0].unidadId).toBe("f1000000-0000-4000-8000-000000000001");
    expect(json.data[0].lat).toBe(-39.81422);
  });

  it("debe retornar 500 si ocurre un fallo no previsto", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(dummyEncargadoId);
    vi.spyOn(telemetriaService, "listarPosicionesActivasService").mockRejectedValueOnce(
      new Error("Fallo crítico inesperado")
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new NextRequest("http://localhost:3001/api/geolocalizacion/posiciones");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.message).toContain("Error interno");
  });
});
