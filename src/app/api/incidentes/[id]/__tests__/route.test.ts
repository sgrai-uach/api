import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";
import * as authService from "@/modules/seguridad/auth.service";
import * as kanbanService from "@/modules/incidentes/incidente-kanban.service";

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/incidentes/incidente-kanban.service", () => ({
  obtenerDetalleIncidenteService: vi.fn(),
}));

describe("Route Handler GET /api/incidentes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 si falta cabecera de autenticación", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación X-User-Id.")
    );

    const req = new NextRequest("http://localhost:3001/api/incidentes/a0000000-0000-4000-8000-000000000001");
    const res = await GET(req, {
      params: Promise.resolve({ id: "a0000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el rol no posee el permiso incidentes:kanban", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: incidentes:kanban")
    );

    const req = new NextRequest("http://localhost:3001/api/incidentes/a0000000-0000-4000-8000-000000000001", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000002" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "a0000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(403);
  });

  it("debe retornar 400 si el parámetro id no es un UUID", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      nombre: "Encargado",
      rol: "Encargado",
    });

    const req = new NextRequest("http://localhost:3001/api/incidentes/codigo-invalido", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000003" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "codigo-invalido" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("no es un UUID válido");
  });

  it("debe retornar 404 si el incidente no existe", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      nombre: "Encargado",
      rol: "Encargado",
    });

    vi.mocked(kanbanService.obtenerDetalleIncidenteService).mockResolvedValueOnce(null);

    const req = new NextRequest(
      "http://localhost:3001/api/incidentes/a0000000-0000-4000-8000-000000000099",
      { headers: { "x-user-id": "00000000-0000-4000-8000-000000000003" } }
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "a0000000-0000-4000-8000-000000000099" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.message).toContain("No se encontró ningún incidente");
  });

  it("debe retornar 200 con el detalle completo del incidente", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      nombre: "Encargado",
      rol: "Encargado",
    });

    const mockDetalle = {
      id: "a0000000-0000-4000-8000-000000000001",
      codigo: "INC-58291045",
      codigoSeguimiento: "58291045",
      tipoAfectacion: "Inundación",
      descripcion: "Anegamiento total",
      direccion: "Picarte 1200",
      latitud: -39.81,
      longitud: -73.24,
      estado: "EN_ATENCION" as const,
      prioridad: "ALTA" as const,
      requiereAsistenciaSocial: false,
      fuenteOrigen: "CHATBOT",
      asteriskCallId: null,
      asteriskCallerPhone: null,
      informante: {
        id: "b0000000-0000-4000-8000-000000000001",
        rut: "12345678-9",
        nombre: "Juan Perez",
        telefono: "+56911223344",
      },
      delegacion: {
        id: "30000000-0000-4000-8000-000000000001",
        nombre: "Sur",
        descripcion: null,
      },
      creadoPor: null,
      encargado: null,
      misiones: [],
      recursosAsociados: [],
      creadoEn: "2026-09-22T10:00:00.000Z",
      actualizadoEn: "2026-09-22T10:30:00.000Z",
    };

    vi.mocked(kanbanService.obtenerDetalleIncidenteService).mockResolvedValueOnce(mockDetalle);

    const req = new NextRequest(
      "http://localhost:3001/api/incidentes/a0000000-0000-4000-8000-000000000001",
      { headers: { "x-user-id": "00000000-0000-4000-8000-000000000003" } }
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "a0000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.codigo).toBe("INC-58291045");
    expect(json.data.informante.nombre).toBe("Juan Perez");
  });
});
