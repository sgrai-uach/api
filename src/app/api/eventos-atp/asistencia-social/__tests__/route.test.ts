import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import * as asistenciaSocialService from "@/modules/eventos-atp/asistencia-social.service";
import type {
  EventoAsistenciaSocialResponse,
  ListarEventosAsistenciaSocialResponse,
} from "@/modules/eventos-atp/asistencia-social.schema";
import * as authGuard from "@/modules/seguridad/auth.guard";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Route Handlers /api/eventos-atp/asistencia-social (H28)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const payloadValido = {
    descripcion: "Requerimiento excepcional de levantamiento FIBE por anegamiento.",
    tipoAfectacion: "VIVIENDA_ANEGADA",
    direccionTexto: "Calle Los Alerces 1420, Sector Collico",
    latitud: -39.8234,
    longitud: -73.2189,
    personasAfectadas: 4,
    familiasAfectadas: 1,
    prioridad: "ALTA" as const,
    contactoNombre: "María González",
    contactoTelefono: "+56912345678",
  };

  const mockEventoResponse: EventoAsistenciaSocialResponse = {
    id: "70000000-0000-4000-8000-000000000001",
    codigo: "AS-2026-0001",
    descripcion: payloadValido.descripcion,
    tipoAfectacion: payloadValido.tipoAfectacion,
    personasAfectadas: 4,
    familiasAfectadas: 1,
    direccionTexto: payloadValido.direccionTexto,
    latitud: payloadValido.latitud,
    longitud: payloadValido.longitud,
    prioridad: "ALTA",
    estado: "PENDIENTE",
    contactoNombre: payloadValido.contactoNombre,
    contactoTelefono: payloadValido.contactoTelefono,
    contactoRut: null,
    delegacionId: null,
    delegacionNombre: null,
    incidenteId: null,
    asistenteSocialId: null,
    asistenteSocialNombre: null,
    creadoPor: {
      id: usuarioEncargadoId,
      nombre: "Encargado de Operaciones",
    },
    creadoEn: "2026-10-05T12:00:00.000Z",
    actualizadoEn: "2026-10-05T12:00:00.000Z",
  };

  describe("POST /api/eventos-atp/asistencia-social", () => {
    it("debe responder 401 si no se proporciona usuario autenticado", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/eventos-atp/asistencia-social", {
        method: "POST",
        body: JSON.stringify(payloadValido),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("debe responder 403 si el usuario carece del permiso asistencia_social:crear", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
      vi.spyOn(asistenciaSocialService, "crearEventoAsistenciaSocialService").mockRejectedValueOnce(
        new ForbiddenError("No cuenta con el permiso requerido: asistencia_social:crear")
      );

      const req = new NextRequest("http://localhost:3000/api/eventos-atp/asistencia-social", {
        method: "POST",
        body: JSON.stringify(payloadValido),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.message).toContain("asistencia_social:crear");
    });

    it("debe responder 400 si faltan campos obligatorios en el payload", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

      const payloadIncompleto = {
        tipoAfectacion: "VIVIENDA_ANEGADA",
        // Faltan descripcion, direccionTexto, latitud, longitud
      };

      const req = new NextRequest("http://localhost:3000/api/eventos-atp/asistencia-social", {
        method: "POST",
        body: JSON.stringify(payloadIncompleto),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.errors).toBeDefined();
    });

    it("debe responder 201 y retornar el evento creado exitosamente", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
      vi.spyOn(asistenciaSocialService, "crearEventoAsistenciaSocialService").mockResolvedValueOnce(
        mockEventoResponse
      );

      const req = new NextRequest("http://localhost:3000/api/eventos-atp/asistencia-social", {
        method: "POST",
        body: JSON.stringify(payloadValido),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.codigo).toBe("AS-2026-0001");
      expect(json.data.estado).toBe("PENDIENTE");
      expect(json.data.incidenteId).toBeNull();
    });
  });

  describe("GET /api/eventos-atp/asistencia-social", () => {
    it("debe responder 401 si no hay usuario autenticado", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost:3000/api/eventos-atp/asistencia-social", {
        method: "GET",
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("debe responder 200 con la lista de eventos para el panel de pendientes", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
      const mockListResponse: ListarEventosAsistenciaSocialResponse = {
        data: [mockEventoResponse],
        total: 1,
        pagina: 1,
        limite: 10,
        totalPaginas: 1,
      };

      vi.spyOn(asistenciaSocialService, "listarEventosAsistenciaSocialService").mockResolvedValueOnce(
        mockListResponse
      );

      const req = new NextRequest(
        "http://localhost:3000/api/eventos-atp/asistencia-social?estado=PENDIENTE",
        {
          method: "GET",
        }
      );

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.total).toBe(1);
      expect(json.data[0].codigo).toBe("AS-2026-0001");
    });
  });
});
