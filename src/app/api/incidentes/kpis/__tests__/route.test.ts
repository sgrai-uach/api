import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";
import * as authService from "@/modules/seguridad/auth.service";
import * as kpiService from "@/modules/incidentes/incidente-kpi.service";

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/incidentes/incidente-kpi.service", () => ({
  obtenerIncidentesKpisService: vi.fn(),
}));

describe("Route Handler GET /api/incidentes/kpis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 Unauthorized si falta la cabecera x-user-id", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación X-User-Id.")
    );

    const req = new NextRequest("http://localhost:3001/api/incidentes/kpis");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("X-User-Id");
  });

  it("debe retornar 403 Forbidden si el usuario carece del permiso incidentes:kanban", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: incidentes:kanban")
    );

    const req = new NextRequest("http://localhost:3001/api/incidentes/kpis", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000002" },
    });
    const res = await GET(req);

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("incidentes:kanban");
  });

  it("debe retornar 400 Bad Request si la fecha tiene formato incorrecto", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      nombre: "Encargado de Emergencias",
      rol: "Encargado",
    });

    const req = new NextRequest("http://localhost:3001/api/incidentes/kpis?fecha=2026/10/03", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toBe("Parámetros de consulta inválidos.");
    expect(json.errors[0].campo).toBe("fecha");
  });

  it("debe retornar 400 Bad Request si delegacionId no es un UUID válido", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      nombre: "Encargado",
      rol: "Encargado",
    });

    const req = new NextRequest("http://localhost:3001/api/incidentes/kpis?delegacionId=123", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors[0].campo).toBe("delegacionId");
  });

  it("debe retornar 200 OK con los contadores calculados ante parámetros válidos", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      nombre: "Encargado",
      rol: "Encargado",
    });

    const mockResponse = {
      message: "Contadores de incidentes del día obtenidos exitosamente.",
      data: {
        fecha: "2026-10-03",
        zonaHoraria: "America/Santiago" as const,
        delegacionId: null,
        total: 10,
        contadores: {
          reportado: 3,
          verificando: 2,
          enAtencion: 3,
          noAbordables: 1,
          resueltos: 1,
        },
        actualizadoEn: new Date().toISOString(),
      },
    };

    vi.mocked(kpiService.obtenerIncidentesKpisService).mockResolvedValueOnce(mockResponse);

    const req = new NextRequest("http://localhost:3001/api/incidentes/kpis?fecha=2026-10-03", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.contadores.reportado).toBe(3);
    expect(json.data.contadores.enAtencion).toBe(3);
    expect(json.data.total).toBe(10);
  });

  it("debe retornar 500 si ocurre un error no controlado en el servicio", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      nombre: "Encargado",
      rol: "Encargado",
    });

    vi.mocked(kpiService.obtenerIncidentesKpisService).mockRejectedValueOnce(
      new Error("Fallo de conexión a la base de datos")
    );

    const req = new NextRequest("http://localhost:3001/api/incidentes/kpis", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.message).toContain("Error interno del servidor");
  });
});
