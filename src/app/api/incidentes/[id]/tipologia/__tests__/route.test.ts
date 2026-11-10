import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import * as tipologiaServiceModule from "@/modules/incidentes/tipologia.service";
import { PERMISO_VERIFICAR_MISION_TERRENO } from "@/modules/seguridad/permisos.constants";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/incidentes/tipologia.service", () => ({
  tipologiaService: {
    reclasificarTipologia: vi.fn(),
    listarTipos: vi.fn(),
  },
}));

describe("Route Handler PATCH /api/incidentes/[id]/tipologia (HU-37)", () => {
  const incidenteId = "50000000-0000-4000-8000-000000000001";
  const patrullaUserId = "00000000-0000-4000-8000-000000000004";
  const tipoIncidenteId = "40000000-0000-4000-8000-000000000001"; // Inundación

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 si no se provee cabecera de autenticación válida", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación Authorization: Bearer <token>.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/incidentes/${incidenteId}/tipologia`,
      {
        method: "PATCH",
        body: JSON.stringify({
          tipoIncidenteId,
          justificacion: "Se constata inundación severa en viviendas.",
        }),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("Authorization");
  });

  it("debe retornar 403 si el usuario no posee el permiso RBAC misiones:terreno:verificar", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError(`No cuenta con el permiso requerido: ${PERMISO_VERIFICAR_MISION_TERRENO}`)
    );

    const req = new NextRequest(
      `http://localhost:3000/api/incidentes/${incidenteId}/tipologia`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer token-invalido" },
        body: JSON.stringify({
          tipoIncidenteId,
          justificacion: "Se constata inundación severa en viviendas.",
        }),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("misiones:terreno:verificar");
  });

  it("debe retornar 400 si el parámetro id de ruta no es un UUID válido", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Patrullero",
      rol: "Patrulla Verificadora",
    });

    const req = new NextRequest(
      "http://localhost:3000/api/incidentes/inc-invalido/tipologia",
      {
        method: "PATCH",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          tipoIncidenteId,
          justificacion: "Se constata inundación severa en viviendas.",
        }),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: "inc-invalido" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("no es un UUID válido");
  });

  it("debe retornar 400 si el body no contiene justificación válida (mínimo 5 caracteres)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Patrullero",
      rol: "Patrulla Verificadora",
    });

    const req = new NextRequest(
      `http://localhost:3000/api/incidentes/${incidenteId}/tipologia`,
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tipoIncidenteId,
          justificacion: "abc", // Menos de 5 caracteres
        }),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("Datos de entrada inválidos");
    expect(json.errors[0].mensaje).toContain("al menos 5 caracteres");
  });

  it("debe retornar 400 si el body no contiene ni tipoIncidenteId ni tipo_incidente_id", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Patrullero",
      rol: "Patrulla Verificadora",
    });

    const req = new NextRequest(
      `http://localhost:3000/api/incidentes/${incidenteId}/tipologia`,
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          justificacion: "Constatación presencial en terreno.",
        }),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("Datos de entrada inválidos");
  });

  it("debe retornar 409 si la misión no ha sido aceptada todavía (se encuentra en DESPACHADA)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Patrullero",
      rol: "Patrulla Verificadora",
    });

    vi.mocked(tipologiaServiceModule.tipologiaService.reclasificarTipologia).mockRejectedValueOnce(
      new ConflictError(
        "La patrulla debe aceptar la misión asignada antes de poder reclasificar la tipología del incidente."
      )
    );

    const req = new NextRequest(
      `http://localhost:3000/api/incidentes/${incidenteId}/tipologia`,
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tipoIncidenteId,
          justificacion: "Desborde fluvial observado directamente en el sitio.",
        }),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.message).toContain("debe aceptar la misión");
  });

  it("debe retornar 404 si el tipo de incidente o el incidente no existen", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Patrullero",
      rol: "Patrulla Verificadora",
    });

    vi.mocked(tipologiaServiceModule.tipologiaService.reclasificarTipologia).mockRejectedValueOnce(
      new NotFoundError("El tipo de incidente seleccionado no existe en el catálogo oficial.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/incidentes/${incidenteId}/tipologia`,
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tipoIncidenteId,
          justificacion: "Evaluación técnica de terreno.",
        }),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.message).toContain("no existe en el catálogo");
  });

  it("debe retornar 200 y actualizar exitosamente la tipología e insertar el hito", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Patrullero Costa",
      rol: "Patrulla Verificadora",
    });

    const mockResponse = {
      message: "Tipología del incidente reclasificada exitosamente en terreno.",
      data: {
        incidente: {
          id: incidenteId,
          codigo: "INC-2026-001",
          tipoIncidenteId,
          tipoAfectacion: "Inundación",
          estado: "VERIFICANDO",
          prioridad: "MEDIA",
          actualizadoEn: new Date().toISOString(),
        },
        hito: {
          id: "70000000-0000-4000-8000-000000000001",
          misionId: "60000000-0000-4000-8000-000000000001",
          hito: "TIPOLOGIA_RECLASIFICADA",
          descripcion:
            "Tipología reclasificada en terreno a: Inundación. Justificación: Constatación de anegamiento total con viviendas afectadas.",
          registradoPorId: patrullaUserId,
          creadoEn: new Date().toISOString(),
        },
      },
    };

    vi.mocked(tipologiaServiceModule.tipologiaService.reclasificarTipologia).mockResolvedValueOnce(
      mockResponse
    );

    const req = new NextRequest(
      `http://localhost:3000/api/incidentes/${incidenteId}/tipologia`,
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tipoIncidenteId,
          justificacion: "Constatación de anegamiento total con viviendas afectadas.",
        }),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.incidente.tipoAfectacion).toBe("Inundación");
    expect(json.data.hito.descripcion).toContain("Tipología reclasificada en terreno a: Inundación");
    expect(json.data.hito.descripcion).toContain("Constatación de anegamiento total");
  });
});

