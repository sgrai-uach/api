import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "../route";
import * as vinculacionService from "@/modules/eventos-atp/vinculacion.service";
import * as authGuard from "@/modules/seguridad/auth.guard";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";
import type { ResultadoVinculacion } from "@/modules/eventos-atp/evento-atp.schema";

const eventoAtpId = "50000000-0000-4000-8000-000000000001";
const incidenteId = "a0000000-0000-4000-8000-000000000001";
const usuarioId = "00000000-0000-4000-8000-000000000003";

const resultado: ResultadoVinculacion = {
  eventoAtpId,
  accion: "VINCULADO",
  entidades: {
    incidentes: [
      {
        tipo: "INCIDENTE",
        id: incidenteId,
        codigo: "INC-2026-0001",
        nombre: "Inundación",
        eventoAtpIdAnterior: null,
      },
    ],
    eventosPrevencion: [],
    recuperaciones: [],
    eventosAsistenciaSocial: [],
  },
  reasignadas: [],
  noEncontradas: [],
  noDesvinculadas: [],
  vinculadoPorId: usuarioId,
  ocurridoEn: "2026-05-01T10:00:00.000Z",
};

function crearRequest(metodo: "POST" | "DELETE", body: unknown) {
  return new NextRequest(
    `http://localhost:3000/api/eventos-atp/${eventoAtpId}/vinculos`,
    {
      method: metodo,
      headers: { authorization: "Bearer token-valido" },
      body: JSON.stringify(body),
    }
  );
}

const contexto = { params: Promise.resolve({ id: eventoAtpId }) };

describe("Route /api/eventos-atp/[id]/vinculos (H60)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioId);
  });

  it("POST responde 401 si no hay usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const res = await POST(crearRequest("POST", { incidenteIds: [incidenteId] }), contexto);

    expect(res.status).toBe(401);
  });

  it("POST responde 400 si el UUID del Evento ATP es inválido", async () => {
    const res = await POST(crearRequest("POST", { incidenteIds: [incidenteId] }), {
      params: Promise.resolve({ id: "no-es-uuid" }),
    });

    expect(res.status).toBe(400);
  });

  it("POST responde 400 si el cuerpo no es JSON válido", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/${eventoAtpId}/vinculos`,
      { method: "POST", body: "{" }
    );

    const res = await POST(req, contexto);

    expect(res.status).toBe(400);
  });

  it("POST responde 400 si no se indican entidades", async () => {
    const res = await POST(crearRequest("POST", {}), contexto);

    expect(res.status).toBe(400);
  });

  it("POST vincula y responde 200", async () => {
    vi.spyOn(
      vinculacionService,
      "vincularEntidadesEventoAtpService"
    ).mockResolvedValueOnce(resultado);

    const res = await POST(
      crearRequest("POST", { incidenteIds: [incidenteId] }),
      contexto
    );

    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toContain("vinculadas");
    expect(json.data).toEqual(resultado);
    expect(
      vinculacionService.vincularEntidadesEventoAtpService
    ).toHaveBeenCalledWith(
      eventoAtpId,
      expect.objectContaining({ incidenteIds: [incidenteId] }),
      usuarioId
    );
  });

  it("DELETE desvincula y responde 200", async () => {
    const resultadoDesvinculacion: ResultadoVinculacion = {
      ...resultado,
      accion: "DESVINCULADO",
    };
    vi.spyOn(
      vinculacionService,
      "desvincularEntidadesEventoAtpService"
    ).mockResolvedValueOnce(resultadoDesvinculacion);

    const res = await DELETE(
      crearRequest("DELETE", { incidenteIds: [incidenteId] }),
      contexto
    );

    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toContain("desvinculadas");
    expect(json.data.accion).toBe("DESVINCULADO");
  });

  it("mapea los errores de negocio a sus códigos HTTP", async () => {
    const casos: Array<[Error, number]> = [
      [new ForbiddenError(), 403],
      [new BadRequestError(), 400],
      [new NotFoundError(), 404],
      [new ConflictError(), 409],
      [new Error("boom"), 500],
    ];

    for (const [error, status] of casos) {
      vi.spyOn(
        vinculacionService,
        "vincularEntidadesEventoAtpService"
      ).mockRejectedValueOnce(error);

      const res = await POST(
        crearRequest("POST", { incidenteIds: [incidenteId] }),
        contexto
      );

      expect(res.status).toBe(status);
    }
  });
});
