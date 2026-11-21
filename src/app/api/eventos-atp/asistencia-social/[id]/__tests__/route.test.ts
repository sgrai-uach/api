import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";
import * as asistenciaSocialService from "@/modules/eventos-atp/asistencia-social.service";
import type { EventoAsistenciaSocialResponse } from "@/modules/eventos-atp/asistencia-social.schema";
import * as authGuard from "@/modules/seguridad/auth.guard";
import { ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Route Handler PATCH /api/eventos-atp/asistencia-social/[id] (H31)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";
  const eventoId = "70000000-0000-4000-8000-000000000001";
  const asistenteSocialId = "00000000-0000-4000-8000-000000000006";

  const mockEventoAsignado: EventoAsistenciaSocialResponse = {
    id: eventoId,
    codigo: "AS-2026-0001",
    descripcion: "Requerimiento excepcional de levantamiento FIBE por anegamiento.",
    tipoAfectacion: "VIVIENDA_ANEGADA",
    personasAfectadas: 4,
    familiasAfectadas: 1,
    direccionTexto: "Calle Los Alerces 1420, Sector Collico",
    latitud: -39.8234,
    longitud: -73.2189,
    prioridad: "ALTA",
    estado: "ASIGNADO",
    contactoNombre: "María González",
    contactoTelefono: "+56912345678",
    contactoRut: "12.345.678-9",
    delegacionId: "30000000-0000-4000-8000-000000000001",
    delegacionNombre: "Delegación Municipal Costa",
    incidenteId: null,
    asistenteSocialId,
    asistenteSocialNombre: "Claudia Rojas",
    creadoPor: {
      id: usuarioEncargadoId,
      nombre: "Encargado de Operaciones",
    },
    creadoEn: "2026-10-05T12:00:00.000Z",
    actualizadoEn: "2026-10-05T12:30:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function crearRequest(body: unknown, withAuth = true): NextRequest {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (withAuth) {
      headers["X-User-Id"] = usuarioEncargadoId;
    }

    return new NextRequest(`http://localhost:3000/api/eventos-atp/asistencia-social/${eventoId}`, {
      method: "PATCH",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("debe responder 401 si no viene cabecera de autenticación", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const res = await PATCH(crearRequest({ asistenteSocialId }, false), {
      params: Promise.resolve({ id: eventoId }),
    });

    expect(res.status).toBe(401);
  });

  it("debe responder 400 si el id de la ruta no es un UUID válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

    const res = await PATCH(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: "id-invalido" }),
    });

    expect(res.status).toBe(400);
  });

  it("debe responder 400 si el body no tiene un UUID de asistenteSocialId válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

    const res = await PATCH(crearRequest({ asistenteSocialId: "no-es-uuid" }), {
      params: Promise.resolve({ id: eventoId }),
    });

    expect(res.status).toBe(400);
  });

  it("debe responder 403 si el usuario carece del permiso asistencia_social:crear", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(asistenciaSocialService, "asignarAsistenteSocialService").mockRejectedValueOnce(
      new ForbiddenError("Sin permiso asistencia_social:crear")
    );

    const res = await PATCH(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: eventoId }),
    });

    expect(res.status).toBe(403);
  });

  it("debe responder 404 si el evento o el asistente social no existen", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(asistenciaSocialService, "asignarAsistenteSocialService").mockRejectedValueOnce(
      new asistenciaSocialService.EventoAsistenciaSocialNotFoundError()
    );

    const res = await PATCH(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: eventoId }),
    });

    expect(res.status).toBe(404);
  });

  it("debe responder 409 si el evento no está en estado PENDIENTE o el asistente no está disponible", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(asistenciaSocialService, "asignarAsistenteSocialService").mockRejectedValueOnce(
      new asistenciaSocialService.EstadoEventoAsistenciaSocialInvalidoError()
    );

    const res = await PATCH(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: eventoId }),
    });

    expect(res.status).toBe(409);
  });

  it("debe responder 200 con el evento en estado ASIGNADO cuando la asignación es exitosa", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(asistenciaSocialService, "asignarAsistenteSocialService").mockResolvedValueOnce(
      mockEventoAsignado
    );

    const res = await PATCH(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: eventoId }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe(eventoId);
    expect(json.data.estado).toBe("ASIGNADO");
    expect(json.data.asistenteSocialId).toBe(asistenteSocialId);
    expect(json.data.asistenteSocialNombre).toBe("Claudia Rojas");
  });
});
