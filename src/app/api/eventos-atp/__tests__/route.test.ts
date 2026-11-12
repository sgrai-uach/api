import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as eventoAtpService from "@/modules/eventos-atp/evento-atp.service";
import * as authGuard from "@/modules/seguridad/auth.guard";
import {
  ForbiddenError,
} from "@/modules/seguridad/errors";
import type { EventoAtpResponse } from "@/modules/eventos-atp/evento-atp.schema";

describe("Route Handler POST /api/eventos-atp (H61)", () => {
  const adminId = "00000000-0000-4000-8000-000000000001";

  const payloadValido = {
    nombre: "Sistema Frontal Mayo 2026",
    descripcion:
      "Sistema frontal con precipitaciones intensas y vientos moderados a fuertes durante 48 horas.",
    tipoAmenaza: "METEOROLOGICA",
    nivelAlerta: "AMARILLA",
    fechaInicio: "2026-05-01T10:00",
    fechaTermino: "2026-05-03T18:00",
    delegacionIds: ["30000000-0000-4000-8000-000000000001"],
  };

  const respuestaEvento: EventoAtpResponse = {
    id: "50000000-0000-4000-8000-000000000001",
    codigo: "ATP-2026-0001",
    nombre: payloadValido.nombre,
    descripcion: payloadValido.descripcion,
    tipoAmenaza: "METEOROLOGICA",
    nivelAlerta: "AMARILLA",
    fechaInicio: "2026-05-01T10:00:00.000Z",
    fechaTermino: "2026-05-03T18:00:00.000Z",
    estado: "ACTIVO",
    delegaciones: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        codigo: "DEL_NORTE",
        nombre: "Delegación Municipal Norte",
      },
    ],
    creadoPorId: adminId,
    creadoEn: "2026-05-01T09:55:00.000Z",
    actualizadoEn: "2026-05-01T09:55:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe responder 401 si no se proporciona usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("debe responder 400 si el cuerpo no es JSON válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp", {
      method: "POST",
      body: "{no-es-json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("debe responder 400 si la validación Zod falla", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp", {
      method: "POST",
      body: JSON.stringify({
        ...payloadValido,
        nombre: "",
        fechaTermino: "2026-04-01T10:00",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.errors.length).toBeGreaterThan(0);
  });

  it("debe responder 403 si el usuario carece del permiso eventos_atp:crear", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
    vi.spyOn(eventoAtpService, "crearEventoAtpService").mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("debe responder 201 y devolver el Evento ATP creado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
    vi.spyOn(eventoAtpService, "crearEventoAtpService").mockResolvedValueOnce(
      respuestaEvento
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.message).toContain("exitosamente");
    expect(json.data).toMatchObject({
      codigo: "ATP-2026-0001",
      estado: "ACTIVO",
    });
  });
});
