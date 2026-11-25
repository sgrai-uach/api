import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getOpenApiSpec } from "@/app/openapi.json/route";

const mockExtraerUsuarioId = vi.fn();
const mockRegistrarFichaFibeService = vi.fn();

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: (...args: unknown[]) => mockExtraerUsuarioId(...args),
}));

vi.mock("@/modules/eventos-atp/asistencia-social.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/modules/eventos-atp/asistencia-social.service")
  >();
  return {
    ...actual,
    registrarFichaFibeService: (...args: unknown[]) =>
      mockRegistrarFichaFibeService(...args),
  };
});

import { PATCH } from "../route";
import {
  EventoAsistenciaSocialNotFoundError,
  EstadoEventoAsistenciaSocialInvalidoError,
  FolioFibeDuplicadoError,
} from "@/modules/eventos-atp/asistencia-social.service";
import { ForbiddenError } from "@/modules/seguridad/auth.errors";

const EVENTO_ID = "70000000-0000-4000-8000-000000000001";
const USUARIO_ID = "00000000-0000-4000-8000-000000000019";

function crearRequest(body: unknown, rawBody?: string) {
  return new NextRequest(
    `http://localhost:3001/api/eventos-atp/asistencia-social/${EVENTO_ID}/fibe`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": USUARIO_ID,
      },
      body: rawBody ?? JSON.stringify(body),
    }
  );
}

describe("PATCH /api/eventos-atp/asistencia-social/[id]/fibe (HU-71)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 si no hay usuario autenticado", async () => {
    mockExtraerUsuarioId.mockResolvedValueOnce(null);

    const res = await PATCH(crearRequest({ folioFibe: "FIBE-2026-0001" }), {
      params: Promise.resolve({ id: EVENTO_ID }),
    });

    expect(res.status).toBe(401);
  });

  it("retorna 400 si el id de ruta no es un UUID válido", async () => {
    mockExtraerUsuarioId.mockResolvedValueOnce(USUARIO_ID);

    const res = await PATCH(crearRequest({ folioFibe: "FIBE-2026-0001" }), {
      params: Promise.resolve({ id: "no-es-uuid" }),
    });

    expect(res.status).toBe(400);
  });

  it("retorna 400 si el JSON es inválido o faltan campos obligatorios", async () => {
    mockExtraerUsuarioId.mockResolvedValueOnce(USUARIO_ID);

    const resJsonInvalido = await PATCH(crearRequest(null, "{bad-json"), {
      params: Promise.resolve({ id: EVENTO_ID }),
    });
    expect(resJsonInvalido.status).toBe(400);

    mockExtraerUsuarioId.mockResolvedValueOnce(USUARIO_ID);
    const resSinFolio = await PATCH(crearRequest({ personasAfectadas: 3 }), {
      params: Promise.resolve({ id: EVENTO_ID }),
    });
    expect(resSinFolio.status).toBe(400);
  });

  it("retorna 403 si el usuario carece del permiso asistencia_social:fibe:gestionar", async () => {
    mockExtraerUsuarioId.mockResolvedValueOnce(USUARIO_ID);
    mockRegistrarFichaFibeService.mockRejectedValueOnce(
      new ForbiddenError("Sin permiso asistencia_social:fibe:gestionar")
    );

    const res = await PATCH(crearRequest({ folioFibe: "FIBE-2026-0001" }), {
      params: Promise.resolve({ id: EVENTO_ID }),
    });

    expect(res.status).toBe(403);
  });

  it("retorna 404 si el evento de asistencia social no existe", async () => {
    mockExtraerUsuarioId.mockResolvedValueOnce(USUARIO_ID);
    mockRegistrarFichaFibeService.mockRejectedValueOnce(
      new EventoAsistenciaSocialNotFoundError()
    );

    const res = await PATCH(crearRequest({ folioFibe: "FIBE-2026-0001" }), {
      params: Promise.resolve({ id: EVENTO_ID }),
    });

    expect(res.status).toBe(404);
  });

  it("retorna 409 si el folio_fibe está duplicado o el estado del evento es inválido", async () => {
    mockExtraerUsuarioId.mockResolvedValueOnce(USUARIO_ID);
    mockRegistrarFichaFibeService.mockRejectedValueOnce(
      new FolioFibeDuplicadoError("Folio duplicado")
    );

    const resDuplicado = await PATCH(crearRequest({ folioFibe: "FIBE-2026-0001" }), {
      params: Promise.resolve({ id: EVENTO_ID }),
    });
    expect(resDuplicado.status).toBe(409);

    mockExtraerUsuarioId.mockResolvedValueOnce(USUARIO_ID);
    mockRegistrarFichaFibeService.mockRejectedValueOnce(
      new EstadoEventoAsistenciaSocialInvalidoError("Estado inválido")
    );

    const resEstado = await PATCH(crearRequest({ folioFibe: "FIBE-2026-0001" }), {
      params: Promise.resolve({ id: EVENTO_ID }),
    });
    expect(resEstado.status).toBe(409);
  });

  it("retorna 200 con los datos actualizados cuando la Ficha FIBE se registra correctamente", async () => {
    mockExtraerUsuarioId.mockResolvedValueOnce(USUARIO_ID);
    mockRegistrarFichaFibeService.mockResolvedValueOnce({
      id: EVENTO_ID,
      codigo: "AS-2026-0001",
      estado: "EN_EVALUACION_FIBE",
      folioFibe: "FIBE-2026-0001",
      personasAfectadas: 4,
      nivelDanoVivienda: "MODERADO",
      observacionesFibe: "Evaluación completada en terreno.",
    });

    const res = await PATCH(
      crearRequest({
        folioFibe: "fibe-2026-0001",
        personasAfectadas: 4,
        nivelDanoVivienda: "MODERADO",
        observacionesSociales: "Evaluación completada en terreno.",
      }),
      { params: Promise.resolve({ id: EVENTO_ID }) }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.estado).toBe("EN_EVALUACION_FIBE");
    expect(json.data.folioFibe).toBe("FIBE-2026-0001");
  });

  it("expone PATCH /api/eventos-atp/asistencia-social/{id}/fibe en el documento OpenAPI", async () => {
    const res = await getOpenApiSpec();
    const doc = await res.json();
    const pathItem = doc.paths?.["/api/eventos-atp/asistencia-social/{id}/fibe"];
    expect(pathItem?.patch).toBeDefined();
    expect(pathItem?.patch?.responses?.["200"]).toBeDefined();
    expect(pathItem?.patch?.responses?.["409"]).toBeDefined();
  });
});
