import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../notificaciones/[id]/estado/route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as notifService from "@/modules/misiones/notificacion-mision.service";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  verificarTerrenoMisiones: vi.fn(),
}));

vi.mock("@/modules/misiones/notificacion-mision.service", () => ({
  actualizarEstadoNotificacionService: vi.fn(),
}));

function crearNextRequest(
  url: string,
  method = "PATCH",
  body?: unknown,
  token?: string
): NextRequest {
  const headers = new Headers();
  headers.set("content-type", "application/json");
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("Route Handler PATCH /api/terreno/notificaciones/[id]/estado (HU-35)", () => {
  const notificacionIdValido = "70000000-0000-4000-8000-000000000001";
  const contextMock = { params: Promise.resolve({ id: notificacionIdValido }) };

  const usuarioTerrenoMock = {
    id: "00000000-0000-4000-8000-000000000010",
    rut: "10000000-1",
    nombre: "Líder Patrulla Norte",
    email: "lider.norte@valdivia.cl",
    rolId: "20000000-0000-4000-8000-000000000004",
    rolNombre: "Patrulla Verificadora",
    rolCodigo: "PATRULLA_VERIFICADORA",
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

    const req = crearNextRequest(
      `http://localhost:3000/api/terreno/notificaciones/${notificacionIdValido}/estado`,
      "PATCH",
      { estado: "RECIBIDA" }
    );

    const res = await PATCH(req, contextMock);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.message).toContain("Se requiere cabecera de autenticación");
  });

  it("debe responder 403 Forbidden si el usuario carece del permiso 'misiones:terreno:verificar'", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockRejectedValueOnce(
      new ForbiddenError("Acceso denegado. Se requiere el permiso 'misiones:terreno:verificar'.")
    );

    const req = crearNextRequest(
      `http://localhost:3000/api/terreno/notificaciones/${notificacionIdValido}/estado`,
      "PATCH",
      { estado: "RECIBIDA" },
      "token_sin_permiso"
    );

    const res = await PATCH(req, contextMock);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.message).toContain("Acceso denegado");
  });

  it("debe responder 400 Bad Request si el parámetro :id no es un UUID válido", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockResolvedValueOnce(usuarioTerrenoMock);

    const req = crearNextRequest(
      "http://localhost:3000/api/terreno/notificaciones/id-invalido/estado",
      "PATCH",
      { estado: "RECIBIDA" },
      "token_valido"
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: "id-invalido" }) });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.message).toContain("no es un identificador UUID válido");
  });

  it("debe responder 400 Bad Request si el estado del payload es inválido", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockResolvedValueOnce(usuarioTerrenoMock);

    const req = crearNextRequest(
      `http://localhost:3000/api/terreno/notificaciones/${notificacionIdValido}/estado`,
      "PATCH",
      { estado: "PENDIENTE_ENVIO" },
      "token_valido"
    );

    const res = await PATCH(req, contextMock);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.message).toContain("Datos de acuse de notificación inválidos");
  });

  it("debe responder 404 Not Found si la notificación no existe", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockResolvedValueOnce(usuarioTerrenoMock);
    vi.mocked(notifService.actualizarEstadoNotificacionService).mockRejectedValueOnce(
      new NotFoundError(`Notificación con ID '${notificacionIdValido}' no encontrada.`)
    );

    const req = crearNextRequest(
      `http://localhost:3000/api/terreno/notificaciones/${notificacionIdValido}/estado`,
      "PATCH",
      { estado: "RECIBIDA" },
      "token_valido"
    );

    const res = await PATCH(req, contextMock);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.message).toContain("no encontrada");
  });

  it("debe responder 403 Forbidden si el usuario intenta confirmar una notificación asignada a otra patrulla", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockResolvedValueOnce(usuarioTerrenoMock);
    vi.mocked(notifService.actualizarEstadoNotificacionService).mockRejectedValueOnce(
      new ForbiddenError("No está autorizado para confirmar notificaciones asignadas a otra patrulla verificadora.")
    );

    const req = crearNextRequest(
      `http://localhost:3000/api/terreno/notificaciones/${notificacionIdValido}/estado`,
      "PATCH",
      { estado: "RECIBIDA" },
      "token_valido"
    );

    const res = await PATCH(req, contextMock);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.message).toContain("No está autorizado para confirmar notificaciones asignadas a otra patrulla");
  });

  it("debe responder 200 OK con los datos actualizados al confirmar 'RECIBIDA'", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockResolvedValueOnce(usuarioTerrenoMock);
    vi.mocked(notifService.actualizarEstadoNotificacionService).mockResolvedValueOnce({
      message: "Estado de notificación actualizado exitosamente.",
      data: {
        id: notificacionIdValido,
        misionId: "60000000-0000-4000-8000-000000000001",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
        estado: "RECIBIDA",
        intentosEnvio: 1,
        creadaAt: "2026-11-09T17:00:00.000Z",
        enviadaAt: "2026-11-09T17:00:01.000Z",
        recibidaAt: "2026-11-09T17:00:05.000Z",
        leidaAt: null,
      },
    });

    const req = crearNextRequest(
      `http://localhost:3000/api/terreno/notificaciones/${notificacionIdValido}/estado`,
      "PATCH",
      { estado: "RECIBIDA" },
      "token_valido"
    );

    const res = await PATCH(req, contextMock);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.estado).toBe("RECIBIDA");
    expect(body.data.recibidaAt).toBeDefined();
  });

  it("debe responder 200 OK con los datos actualizados al confirmar 'LEIDA'", async () => {
    vi.mocked(authGuard.verificarTerrenoMisiones).mockResolvedValueOnce(usuarioTerrenoMock);
    vi.mocked(notifService.actualizarEstadoNotificacionService).mockResolvedValueOnce({
      message: "Estado de notificación actualizado exitosamente.",
      data: {
        id: notificacionIdValido,
        misionId: "60000000-0000-4000-8000-000000000001",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
        estado: "LEIDA",
        intentosEnvio: 1,
        creadaAt: "2026-11-09T17:00:00.000Z",
        enviadaAt: "2026-11-09T17:00:01.000Z",
        recibidaAt: "2026-11-09T17:00:05.000Z",
        leidaAt: "2026-11-09T17:00:15.000Z",
      },
    });

    const req = crearNextRequest(
      `http://localhost:3000/api/terreno/notificaciones/${notificacionIdValido}/estado`,
      "PATCH",
      { estado: "LEIDA" },
      "token_valido"
    );

    const res = await PATCH(req, contextMock);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.estado).toBe("LEIDA");
    expect(body.data.leidaAt).toBeDefined();
  });
});

