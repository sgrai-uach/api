import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as authService from "@/modules/seguridad/auth.service";
import * as incidentesService from "@/modules/incidentes/aviso-incidente.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Endpoint POST /api/incidentes/verificar-duplicado", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe responder 401 si no se envía la cabecera X-User-Id", async () => {
    vi.spyOn(authService, "verificarPermiso").mockRejectedValue(
      new UnauthorizedError("Se requiere cabecera de autenticación X-User-Id.")
    );

    const req = new NextRequest("http://localhost:3000/api/incidentes/verificar-duplicado", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("debe responder 403 si el usuario no tiene permiso crear_incidente_manual", async () => {
    vi.spyOn(authService, "verificarPermiso").mockRejectedValue(
      new ForbiddenError("No cuenta con el permiso requerido: crear_incidente_manual")
    );

    const req = new NextRequest("http://localhost:3000/api/incidentes/verificar-duplicado", {
      method: "POST",
      headers: { "x-user-id": "user-sin-permiso" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("debe responder 400 si la dirección es demasiado corta", async () => {
    vi.spyOn(authService, "verificarPermiso").mockResolvedValue({
      id: "operador-id",
      nombre: "Operador Call Center",
      rol: "Call Center",
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/verificar-duplicado", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "operador-id",
      },
      body: JSON.stringify({
        tipoAfectacion: "Anegamiento",
        direccion: "Val",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Parámetros inválidos");
  });

  it("debe responder 200 OK con los resultados de la verificación espacial", async () => {
    vi.spyOn(authService, "verificarPermiso").mockResolvedValue({
      id: "operador-id",
      nombre: "Operador Call Center",
      rol: "Call Center",
    });

    vi.spyOn(incidentesService, "verificarDuplicadosManual").mockResolvedValue({
      hayDuplicados: true,
      coincidencias: [
        {
          id: "coincidencia-1",
          codigo: "INC-999001",
          tipoAfectacion: "Anegamiento",
          direccion: "Av. Alemania 540",
          estado: "REPORTADO",
          distanciaMetros: 12.3,
          creadoEn: "2026-09-13T18:00:00Z",
          origen: "incidente",
        },
      ],
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/verificar-duplicado", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "operador-id",
      },
      body: JSON.stringify({
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 550",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.hayDuplicados).toBe(true);
    expect(data.data.coincidencias).toHaveLength(1);
    expect(data.data.coincidencias[0].codigo).toBe("INC-999001");
  });
});
