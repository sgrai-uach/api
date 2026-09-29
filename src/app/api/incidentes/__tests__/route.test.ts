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
  listarIncidentesKanbanService: vi.fn(),
}));

describe("Route Handler GET /api/incidentes (Tablero Kanban)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 Unauthorized si falta la cabecera x-user-id", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación X-User-Id.")
    );

    const req = new NextRequest("http://localhost:3001/api/incidentes");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("X-User-Id");
  });

  it("debe retornar 403 Forbidden si el usuario no tiene el permiso incidentes:kanban", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: incidentes:kanban")
    );

    const req = new NextRequest("http://localhost:3001/api/incidentes", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000002" },
    });
    const res = await GET(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("incidentes:kanban");
  });

  it("debe retornar 400 Bad Request si los parámetros de paginación o filtro son inválidos", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      nombre: "Encargado",
      rol: "Encargado",
    });

    const req = new NextRequest("http://localhost:3001/api/incidentes?limit=500", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000003" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("Parámetros de consulta inválidos");
  });

  it("debe retornar 200 OK con la lista paginada de incidentes", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      nombre: "Encargado",
      rol: "Encargado",
    });

    vi.mocked(kanbanService.listarIncidentesKanbanService).mockResolvedValueOnce({
      message: "Listado de incidentes obtenido exitosamente",
      data: [
        {
          id: "a0000000-0000-4000-8000-000000000001",
          codigo: "INC-58291045",
          codigoSeguimiento: "58291045",
          tipoAfectacion: "Inundación",
          descripcion: "Anégose calzada",
          direccion: "Av. Picarte",
          latitud: -39.81,
          longitud: -73.24,
          estado: "REPORTADO",
          prioridad: "ALTA",
          requiereAsistenciaSocial: false,
          fuenteOrigen: "CHATBOT",
          informanteNombre: "Vecino",
          delegacionNombre: "Sur",
          totalMisiones: 0,
          creadoEn: "2026-09-22T10:00:00.000Z",
          actualizadoEn: "2026-09-22T10:00:00.000Z",
        },
      ],
      paginacion: {
        total: 1,
        pagina: 1,
        limite: 20,
        totalPaginas: 1,
        tieneSiguiente: false,
        tieneAnterior: false,
      },
    });

    const req = new NextRequest("http://localhost:3001/api/incidentes?page=1&limit=20&estado=REPORTADO", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000003" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.paginacion.total).toBe(1);
    expect(json.data[0].codigo).toBe("INC-58291045");
  });
});
