import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import * as misionService from "@/modules/misiones/mision.service";
import { PERMISO_VERIFICAR_MISION_TERRENO } from "@/modules/seguridad/permisos.constants";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  aceptarMisionService: vi.fn(),
}));

describe("Route Handler POST /api/misiones/[id]/aceptar (HU-36)", () => {
  const misionId = "60000000-0000-4000-8000-000000000001";
  const patrullaUserId = "00000000-0000-4000-8000-000000000004";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 si no se proporciona autenticación válida", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación Authorization: Bearer <token>.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionId}/aceptar`, {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("Authorization");
  });

  it("debe retornar 403 si el usuario no posee el permiso misiones:terreno:verificar", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError(`No cuenta con el permiso requerido: ${PERMISO_VERIFICAR_MISION_TERRENO}`)
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionId}/aceptar`, {
      method: "POST",
      headers: { authorization: "Bearer valid-jwt" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("misiones:terreno:verificar");
    expect(authService.verificarPermiso).toHaveBeenCalledWith(
      patrullaUserId,
      PERMISO_VERIFICAR_MISION_TERRENO
    );
  });

  it("debe retornar 400 si el parámetro id no es un UUID válido", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Líder Patrulla Costa",
      rol: "Patrulla Verificadora",
    });

    const req = new NextRequest("http://localhost:3000/api/misiones/no-es-uuid/aceptar", {
      method: "POST",
      headers: { authorization: "Bearer valid-jwt" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: "no-es-uuid" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("no es un UUID válido");
  });

  it("debe retornar 400 si las coordenadas opcionales están fuera de rango", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Líder Patrulla Costa",
      rol: "Patrulla Verificadora",
    });

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionId}/aceptar`, {
      method: "POST",
      headers: {
        authorization: "Bearer valid-jwt",
        "content-type": "application/json",
      },
      body: JSON.stringify({ latitud: -120, longitud: -73.245 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBe("Datos de entrada inválidos.");
  });

  it("debe retornar 400 si se envía latitud sin longitud o viceversa (BUG-H36-API-05)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Líder Patrulla Costa",
      rol: "Patrulla Verificadora",
    });

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionId}/aceptar`, {
      method: "POST",
      headers: {
        authorization: "Bearer valid-jwt",
        "content-type": "application/json",
      },
      body: JSON.stringify({ latitud: -39.819588 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBe("Datos de entrada inválidos.");
    expect(json.errors[0].mensaje).toContain("tanto latitud como longitud");
  });

  it("debe retornar 404 si la misión no existe", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Líder Patrulla Costa",
      rol: "Patrulla Verificadora",
    });
    vi.mocked(misionService.aceptarMisionService).mockRejectedValueOnce(
      new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionId}/aceptar`, {
      method: "POST",
      headers: { authorization: "Bearer valid-jwt" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.message).toContain("No se encontró ninguna misión");
  });

  it("debe retornar 409 si la misión no está en estado DESPACHADA", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Líder Patrulla Costa",
      rol: "Patrulla Verificadora",
    });
    vi.mocked(misionService.aceptarMisionService).mockRejectedValueOnce(
      new ConflictError(
        "La misión no puede ser aceptada porque su estado actual es 'EN_CURSO'. Solo se pueden aceptar misiones en estado 'DESPACHADA'."
      )
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionId}/aceptar`, {
      method: "POST",
      headers: { authorization: "Bearer valid-jwt" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.message).toContain("DESPACHADA");
  });

  it("debe retornar 200 OK al aceptar exitosamente la misión sin body o con coordenadas opcionales", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Líder Patrulla Costa",
      rol: "Patrulla Verificadora",
    });

    const mockResponse = {
      message:
        "Misión aceptada exitosamente. La patrulla se encuentra en trayecto para iniciar la evaluación.",
      data: {
        mision: {
          id: misionId,
          codigo: "MIS-2026-0001",
          titulo: "Verificación de Incidente INC-2026-0001",
          descripcion: "Evaluar caída de árbol",
          tipoMision: "VERIFICACION" as const,
          estado: "EN_CURSO" as const,
          prioridad: "ALTA" as const,
          incidenteId: "a0000000-0000-4000-8000-000000000001",
          patrullaId: "f1000000-0000-4000-8000-000000000001",
          fechaInicio: "2026-11-01T21:00:00.000Z",
          actualizadoEn: "2026-11-01T21:00:00.000Z",
        },
        patrulla: {
          id: "f1000000-0000-4000-8000-000000000001",
          nombre: "Patrulla Rápida Costa-1",
          estado: "EN_VERIFICACION",
        },
        incidente: {
          id: "a0000000-0000-4000-8000-000000000001",
          codigo: "INC-2026-0001",
          estado: "VERIFICANDO",
        },
        hito: {
          id: "70000000-0000-4000-8000-000000000001",
          misionId,
          hito: "MISION_ACEPTADA",
          descripcion: "Misión Aceptada por Patrulla",
          registradoPorId: patrullaUserId,
          latitud: null,
          longitud: null,
          creadoEn: "2026-11-01T21:00:00.000Z",
        },
      },
    };

    vi.mocked(misionService.aceptarMisionService).mockResolvedValueOnce(mockResponse);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionId}/aceptar`, {
      method: "POST",
      headers: { authorization: "Bearer valid-jwt" },
    });

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.mision.estado).toBe("EN_CURSO");
    expect(json.data.patrulla.estado).toBe("EN_VERIFICACION");
    expect(json.data.incidente.estado).toBe("VERIFICANDO");
    expect(json.data.hito.hito).toBe("MISION_ACEPTADA");
    expect(json.data.hito.descripcion).toBe("Misión Aceptada por Patrulla");
  });
});

