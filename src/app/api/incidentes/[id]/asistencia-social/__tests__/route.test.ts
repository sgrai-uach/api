import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as asistenciaSocialService from "@/modules/eventos-atp/asistencia-social.service";
import type { DerivarAsistenciaSocialIncidenteResponse } from "@/modules/eventos-atp/asistencia-social.schema";
import * as authGuard from "@/modules/seguridad/auth.guard";
import { ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Route Handler POST /api/incidentes/[id]/asistencia-social (HU-25)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";
  const incidenteId = "a1000000-0000-4000-8000-000000000006";
  const asistenteSocialId = "00000000-0000-4000-8000-000000000019";

  const mockRespuestaCreada: DerivarAsistenciaSocialIncidenteResponse = {
    message:
      "Incidente derivado a Asistencia Social y profesional asignado para levantamiento de ficha FIBE.",
    accion: "CREADO",
    data: {
      id: "70000000-0000-4000-8000-000000000010",
      codigo: "AS-2026-0001",
      descripcion: "Anegamiento en vivienda con pérdida de enseres",
      tipoAfectacion: "Inundación",
      personasAfectadas: 4,
      familiasAfectadas: 1,
      direccionTexto: "Av. Pedro Montt 1100, Valdivia",
      latitud: -39.831,
      longitud: -73.238,
      prioridad: "MEDIA",
      estado: "ASIGNADO",
      contactoNombre: "Juan Pérez González",
      contactoTelefono: "+56991112233",
      contactoRut: "12.345.678-5",
      delegacionId: "30000000-0000-4000-8000-000000000002",
      delegacionNombre: "Delegación Municipal Sur",
      incidenteId,
      incidenteCodigo: "INC-2026-0006",
      asistenteSocialId,
      asistenteSocialNombre: "Claudia Rojas Vidal",
      detallesEvaluacion: null,
      creadoPor: {
        id: usuarioEncargadoId,
        nombre: "Encargado de Operaciones",
      },
      creadoEn: "2026-11-21T20:00:00.000Z",
      actualizadoEn: "2026-11-21T20:00:00.000Z",
    },
    hito: {
      id: "80000000-0000-4000-8000-000000000001",
      misionId: "d1000000-0000-4000-8000-000000000004",
      hito: "DERIVACION_ASISTENCIA_SOCIAL",
      descripcion:
        "Incidente INC-2026-0006 derivado a Asistencia Social (DGRD / FIBE) mediante evento AS-2026-0001, asignado a Claudia Rojas Vidal.",
      registradoPorId: usuarioEncargadoId,
      metadatos: { eventoAsistenciaSocialCodigo: "AS-2026-0001" },
      creadoEn: "2026-11-21T20:00:00.000Z",
    },
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

    return new NextRequest(
      `http://localhost:3000/api/incidentes/${incidenteId}/asistencia-social`,
      {
        method: "POST",
        headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
      }
    );
  }

  it("debe responder 401 si no viene cabecera de autenticación", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const res = await POST(crearRequest({ asistenteSocialId }, false), {
      params: Promise.resolve({ id: incidenteId }),
    });

    expect(res.status).toBe(401);
  });

  it("debe responder 400 si el identificador de incidente o el body es inválido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioEncargadoId);

    const resIdInvalido = await POST(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: "id-invalido" }),
    });
    expect(resIdInvalido.status).toBe(400);

    const resJsonInvalido = await POST(crearRequest("{invalido"), {
      params: Promise.resolve({ id: incidenteId }),
    });
    expect(resJsonInvalido.status).toBe(400);

    const resBodyInvalido = await POST(crearRequest({ asistenteSocialId: "no-uuid" }), {
      params: Promise.resolve({ id: incidenteId }),
    });
    expect(resBodyInvalido.status).toBe(400);
  });

  it("debe responder 403 si el usuario carece del permiso asistencia_social:crear", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(
      asistenciaSocialService,
      "derivarIncidenteAAsistenciaSocialService"
    ).mockRejectedValueOnce(new ForbiddenError("Sin permiso asistencia_social:crear"));

    const res = await POST(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: incidenteId }),
    });

    expect(res.status).toBe(403);
  });

  it("debe responder 404 si el incidente o el asistente social no existen", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioEncargadoId);
    vi.spyOn(
      asistenciaSocialService,
      "derivarIncidenteAAsistenciaSocialService"
    ).mockRejectedValueOnce(new asistenciaSocialService.IncidenteNoEncontradoError());

    const res1 = await POST(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: incidenteId }),
    });
    expect(res1.status).toBe(404);

    vi.spyOn(
      asistenciaSocialService,
      "derivarIncidenteAAsistenciaSocialService"
    ).mockRejectedValueOnce(new asistenciaSocialService.AsistenteSocialNotFoundError());

    const res2 = await POST(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: incidenteId }),
    });
    expect(res2.status).toBe(404);
  });

  it("debe responder 409 si el incidente no es elegible, el profesional no está disponible o ya está en evaluación FIBE", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioEncargadoId);

    for (const err of [
      new asistenciaSocialService.IncidenteNoElegibleAsistenciaSocialError(),
      new asistenciaSocialService.AsistenteSocialNoDisponibleError(),
      new asistenciaSocialService.EventoAsistenciaSocialEnProcesoError(),
    ]) {
      vi.spyOn(
        asistenciaSocialService,
        "derivarIncidenteAAsistenciaSocialService"
      ).mockRejectedValueOnce(err);

      const res = await POST(crearRequest({ asistenteSocialId }), {
        params: Promise.resolve({ id: incidenteId }),
      });
      expect(res.status).toBe(409);
    }
  });

  it("debe responder 500 ante un error inesperado no controlado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(
      asistenciaSocialService,
      "derivarIncidenteAAsistenciaSocialService"
    ).mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await POST(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: incidenteId }),
    });

    expect(res.status).toBe(500);
  });

  it("debe responder 201 cuando crea un nuevo evento en ASIGNADO y 200 cuando actualiza uno previo", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioEncargadoId);
    vi.spyOn(
      asistenciaSocialService,
      "derivarIncidenteAAsistenciaSocialService"
    ).mockResolvedValueOnce(mockRespuestaCreada);

    const res201 = await POST(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: incidenteId }),
    });
    const json201 = await res201.json();
    expect(res201.status).toBe(201);
    expect(json201.accion).toBe("CREADO");
    expect(json201.data.estado).toBe("ASIGNADO");
    expect(json201.hito.hito).toBe("DERIVACION_ASISTENCIA_SOCIAL");

    vi.spyOn(
      asistenciaSocialService,
      "derivarIncidenteAAsistenciaSocialService"
    ).mockResolvedValueOnce({
      ...mockRespuestaCreada,
      accion: "ACTUALIZADO",
    });

    const res200 = await POST(crearRequest({ asistenteSocialId }), {
      params: Promise.resolve({ id: incidenteId }),
    });
    const json200 = await res200.json();
    expect(res200.status).toBe(200);
    expect(json200.accion).toBe("ACTUALIZADO");
  });
});
