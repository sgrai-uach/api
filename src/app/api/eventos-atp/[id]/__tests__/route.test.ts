import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as eventoAtpService from "@/modules/eventos-atp/evento-atp.service";
import * as authGuard from "@/modules/seguridad/auth.guard";
import {
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";
import type { EventoAtpDetalle } from "@/modules/eventos-atp/evento-atp.schema";

const eventoAtpId = "50000000-0000-4000-8000-000000000001";
const usuarioId = "00000000-0000-4000-8000-000000000003";

const detalle: EventoAtpDetalle = {
  id: eventoAtpId,
  codigo: "ATP-2026-0001",
  nombre: "Sistema Frontal Mayo 2026",
  descripcion: "Sistema frontal con precipitaciones intensas.",
  tipoAmenaza: "METEOROLOGICA",
  nivelAlerta: "AMARILLA",
  fechaInicio: "2026-05-01T10:00:00.000Z",
  fechaTermino: "2026-05-03T18:00:00.000Z",
  estado: "ACTIVO",
  delegaciones: [],
  creadoPorId: usuarioId,
  creadoEn: "2026-05-01T09:55:00.000Z",
  actualizadoEn: "2026-05-01T09:55:00.000Z",
  vinculos: {
    incidentes: [
      {
        id: "a0000000-0000-4000-8000-000000000001",
        codigo: "INC-2026-0001",
        nombre: "Inundación",
        estado: "REPORTADO",
        creadoEn: "2026-05-01T10:00:00.000Z",
      },
    ],
    eventosPrevencion: [],
    recuperaciones: [],
    eventosAsistenciaSocial: [],
  },
  totalVinculados: 1,
};

const contexto = { params: Promise.resolve({ id: eventoAtpId }) };

describe("Route GET /api/eventos-atp/[id] (H60)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioId);
  });

  it("responde 401 si no hay usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/${eventoAtpId}`
    );
    const res = await GET(req, contexto);

    expect(res.status).toBe(401);
  });

  it("responde 400 si el identificador no es UUID", async () => {
    const req = new NextRequest("http://localhost:3000/api/eventos-atp/invalido");
    const res = await GET(req, { params: Promise.resolve({ id: "invalido" }) });

    expect(res.status).toBe(400);
  });

  it("responde 200 con el detalle y sus vínculos", async () => {
    vi.spyOn(
      eventoAtpService,
      "obtenerEventoAtpDetalleService"
    ).mockResolvedValueOnce(detalle);

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/${eventoAtpId}`
    );
    const res = await GET(req, contexto);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.totalVinculados).toBe(1);
    expect(json.data.vinculos.incidentes).toHaveLength(1);
  });

  it("responde 404 si el Evento ATP no existe", async () => {
    vi.spyOn(
      eventoAtpService,
      "obtenerEventoAtpDetalleService"
    ).mockRejectedValueOnce(new NotFoundError());

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/${eventoAtpId}`
    );
    const res = await GET(req, contexto);

    expect(res.status).toBe(404);
  });

  it("responde 403 si el control RBAC lo rechaza", async () => {
    vi.spyOn(
      eventoAtpService,
      "obtenerEventoAtpDetalleService"
    ).mockRejectedValueOnce(new ForbiddenError());

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/${eventoAtpId}`
    );
    const res = await GET(req, contexto);

    expect(res.status).toBe(403);
  });
});
