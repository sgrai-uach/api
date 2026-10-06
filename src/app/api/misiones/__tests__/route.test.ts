import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as misionService from "@/modules/misiones/mision-listado.service";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/misiones/mision-listado.service", () => ({
  listarMisionesService: vi.fn(),
}));

describe("Route Handler GET /api/misiones (Listado Encargado - H34)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe responder 401 Unauthorized si no hay cabecera de autenticación", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/misiones");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("Authorization: Bearer");
  });

  it("debe responder 400 Bad Request si los parámetros son inválidos", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce("00000000-0000-4000-8000-000000000001");

    const req = new NextRequest("http://localhost:3000/api/misiones?estado=ESTADO_INVALIDO", {
      headers: { authorization: "Bearer token" },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Parámetros de consulta inválidos");
  });

  it("debe responder 200 OK con la lista paginada y metadatos", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce("00000000-0000-4000-8000-000000000001");
    vi.mocked(misionService.listarMisionesService).mockResolvedValueOnce({
      message: "Listado de misiones obtenido exitosamente",
      data: [
        {
          id: "m0000000-0000-4000-8000-000000000001",
          codigo: "MIS-0001",
          titulo: "Verificación de anegamiento",
          descripcion: null,
          tipoMision: "VERIFICACION",
          estado: "EN_CURSO",
          prioridad: "ALTA",
          creadoEn: "2026-10-04T12:00:00.000Z",
          actualizadoEn: "2026-10-04T12:00:00.000Z",
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    const req = new NextRequest("http://localhost:3000/api/misiones?page=1&limit=20&estado=EN_CURSO", {
      headers: { authorization: "Bearer token" },
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].codigo).toBe("MIS-0001");
  });
});
