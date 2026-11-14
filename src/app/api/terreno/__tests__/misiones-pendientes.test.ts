import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../misiones/pendientes/route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as notifService from "@/modules/misiones/notificacion-mision.service";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  verificarTerrenoMisiones: vi.fn(),
}));

vi.mock("@/modules/misiones/notificacion-mision.service", () => ({
  listarMisionesPendientesTerrenoService: vi.fn(),
}));

function crearNextRequest(url: string, token?: string): NextRequest {
  const headers = new Headers();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "GET",
    headers,
  });
}

describe("Route Handler GET /api/terreno/misiones/pendientes (HU-35)", () => {
  const usuarioTerrenoMock = {
    id: "00000000-0000-4000-8000-000000000010",
    rut: "10000000-1",
    nombre: "Líder Patrulla Norte",
    email: "lider.norte@valdivia.cl",
    rolId: "20000000-0000-4000-8000-000000000004",
    rolNombre: "Patrulla Verificadora",
    activo: true,
    delegacionId: "30000000-0000-4000-8000-000000000001",
    permisos: ["misiones:terreno:verificar"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe responder 401 Unauthorized si no hay token de autenticación", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación Authorization: Bearer <token>.")
    );

    const req = crearNextRequest("http://localhost:3000/api/terreno/misiones/pendientes");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("Se requiere cabecera de autenticación");
  });

  it("debe responder 403 Forbidden si el usuario carece del permiso 'misiones:terreno:verificar'", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockRejectedValueOnce(
      new ForbiddenError("Acceso denegado. Se requiere el permiso 'misiones:terreno:verificar'.")
    );

    const req = crearNextRequest(
      "http://localhost:3000/api/terreno/misiones/pendientes",
      "token_sin_permiso"
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("Acceso denegado");
  });

  it("debe responder 403 Forbidden si el usuario no pertenece a ninguna patrulla activa", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockResolvedValueOnce(usuarioTerrenoMock);
    vi.mocked(notifService.listarMisionesPendientesTerrenoService).mockRejectedValueOnce(
      new ForbiddenError("El usuario autenticado no está asignado a ninguna patrulla verificadora activa.")
    );

    const req = crearNextRequest(
      "http://localhost:3000/api/terreno/misiones/pendientes",
      "token_valido"
    );
    const res = await GET(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("no está asignado a ninguna patrulla verificadora activa");
  });

  it("debe responder 200 OK con la lista de misiones pendientes para reconciliación offline", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockResolvedValueOnce(usuarioTerrenoMock);
    vi.mocked(notifService.listarMisionesPendientesTerrenoService).mockResolvedValueOnce({
      message: "Misiones pendientes obtenidas exitosamente.",
      total: 1,
      data: [
        {
          notificacionId: "70000000-0000-4000-8000-000000000001",
          misionId: "60000000-0000-4000-8000-000000000001",
          codigoMision: "MIS-2026-0001",
          titulo: "Verificación de Aniego",
          descripcion: "Revisar calle Errázuriz",
          tipoMision: "VERIFICACION",
          prioridad: "ALTA",
          estadoMision: "DESPACHADA",
          estadoNotificacion: "PENDIENTE_ENVIO",
          patrullaId: "f1000000-0000-4000-8000-000000000001",
          incidenteId: "50000000-0000-4000-8000-000000000001",
          incidenteCodigo: "INC-2026-8869",
          incidenteFolio: "FOL-8869",
          tipoAfectacion: "Anegamiento",
          direccion: "Calle Errázuriz 400",
          latitud: -39.815,
          longitud: -73.242,
          creadaAt: "2026-11-09T17:00:00.000Z",
          enviadaAt: null,
        },
      ],
    });

    const req = crearNextRequest(
      "http://localhost:3000/api/terreno/misiones/pendientes",
      "token_valido"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.data[0].codigoMision).toBe("MIS-2026-0001");
    expect(body.data[0].estadoNotificacion).toBe("PENDIENTE_ENVIO");
  });
});

