import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import * as misionService from "@/modules/misiones/mision.service";
import {
  ForbiddenError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  rechazarMisionService: vi.fn(),
}));

describe("Route Handler POST /api/misiones/[id]/rechazar (HU-69)", () => {
  const misionIdValido = "60000000-0000-4000-8000-000000000050";
  const patrullaUsuarioMock: authService.UsuarioAutenticado = {
    id: "00000000-0000-4000-8000-000000000004",
    nombre: "Patrullero Juan",
    rol: "PATRULLA_VERIFICADORA",
  };

  const contextValido = {
    params: Promise.resolve({ id: misionIdValido }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe responder 401 Unauthorized si no hay token de autenticación", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación Authorization: Bearer <token>.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      body: JSON.stringify({ justificacion_rechazo: "Desperfecto mecánico" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("autenticación");
  });

  it("debe responder 403 Forbidden si el usuario carece del permiso 'misiones:terreno:verificar'", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce("usuario-sin-permiso");
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError("No tiene permiso para gestionar misiones en terreno.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      body: JSON.stringify({ justificacion_rechazo: "Desperfecto mecánico" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("No tiene permiso");
  });

  it("debe responder 400 Bad Request si el parámetro de ruta no es un UUID válido", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce(patrullaUsuarioMock);

    const contextInvalido = {
      params: Promise.resolve({ id: "no-es-uuid" }),
    };

    const req = new NextRequest("http://localhost:3000/api/misiones/no-es-uuid/rechazar", {
      method: "POST",
      body: JSON.stringify({ justificacion_rechazo: "Desperfecto mecánico" }),
    });

    const res = await POST(req, contextInvalido);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("no es un UUID válido");
  });

  it("debe responder 400 Bad Request si el body no es un JSON válido", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce(patrullaUsuarioMock);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "json-invalido-{{{",
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("formato JSON válido");
  });

  it("debe responder 400 Bad Request si la justificación tiene menos de 5 caracteres (ej. 4 caracteres)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce(patrullaUsuarioMock);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Pana" }), // 4 caracteres
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Datos de entrada inválidos");
    expect(body.errors[0].mensaje).toContain("al menos 5 caracteres");
  });

  it("debe responder 400 Bad Request si se envía justificación vacía", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce(patrullaUsuarioMock);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "    " }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors[0].mensaje).toContain("al menos 5 caracteres");
  });

  it("debe responder 404 Not Found si la misión no existe", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce(patrullaUsuarioMock);
    vi.mocked(misionService.rechazarMisionService).mockRejectedValueOnce(
      new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Desperfecto mecánico en vehículo" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("No se encontró ninguna misión");
  });

  it("debe responder 409 Conflict si la misión ya no está en estado DESPACHADA o ya fue rechazada", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce(patrullaUsuarioMock);
    vi.mocked(misionService.rechazarMisionService).mockRejectedValueOnce(
      new ConflictError("La misión ya ha sido rechazada previamente.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Desperfecto mecánico en vehículo" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("ya ha sido rechazada previamente");
  });

  it("debe responder 200 OK con los datos actualizados cuando el rechazo es exitoso (>= 5 caracteres)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce(patrullaUsuarioMock);
    vi.mocked(misionService.rechazarMisionService).mockResolvedValueOnce({
      message:
        "Misión rechazada exitosamente. El incidente ha vuelto a estado REPORTADO para su reasignación.",
      data: {
        mision: {
          id: misionIdValido,
          codigo: "MIS-2026-8341",
          estado: "RECHAZADA",
          justificacionRechazo: "Desperfecto mecánico en vehículo de patrulla",
          actualizadoEn: "2026-11-03T18:45:00.000Z",
        },
        patrulla: {
          id: "f1000000-0000-4000-8000-000000000001",
          nombre: "Patrulla Ánimas Norte 1",
          estado: "DISPONIBLE",
        },
        incidente: {
          id: "50000000-0000-4000-8000-000000000001",
          codigo: "INC-2026-1042",
          estado: "REPORTADO",
        },
        hito: {
          id: "70000000-0000-4000-8000-000000000002",
          hito: "RECHAZADA",
          descripcion:
            "Misión rechazada por patrulla: Desperfecto mecánico en vehículo de patrulla",
          creadoEn: "2026-11-03T18:45:00.000Z",
        },
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        justificacion_rechazo: "Desperfecto mecánico en vehículo de patrulla",
      }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("Misión rechazada exitosamente");
    expect(body.data.mision.estado).toBe("RECHAZADA");
    expect(body.data.patrulla.estado).toBe("DISPONIBLE");
    expect(body.data.incidente.estado).toBe("REPORTADO");
  });
});

