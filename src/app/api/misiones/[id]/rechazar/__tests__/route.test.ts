import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import * as misionService from "@/modules/misiones/mision.service";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";
import type { RechazarMisionResponse } from "@/modules/misiones/mision.schema";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  rechazarMisionService: vi.fn(),
}));

describe("Route Handler POST /api/misiones/[id]/rechazar (HU-41)", () => {
  const misionIdValido = "70000000-0000-4000-8000-000000000001";
  const delegadoIdValido = "d0000000-0000-4000-8000-000000000001";

  const contextValido = {
    params: Promise.resolve({ id: misionIdValido }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe responder 401 Unauthorized si no hay usuario autenticado", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación Authorization: Bearer <token>.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Falla mecánica grave" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(401);
  });

  it("debe responder 403 Forbidden si el usuario carece del permiso misiones:terreno:ejecutar", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: misiones:terreno:ejecutar")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Falla mecánica grave" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("misiones:terreno:ejecutar");
  });

  it("debe responder 400 Bad Request si el id de misión no es un UUID válido", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Delegado Cuadrilla",
      rol: "DELEGADO_CUADRILLA",
    });

    const req = new NextRequest("http://localhost:3000/api/misiones/no-es-uuid/rechazar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Falla mecánica grave" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "no-es-uuid" }) });
    expect(res.status).toBe(400);
  });

  it("debe responder 400 Bad Request si justificacion_rechazo está vacía (Regla §3.3)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Delegado Cuadrilla",
      rol: "DELEGADO_CUADRILLA",
    });

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors[0].mensaje).toContain("al menos 5 caracteres");
  });

  it("debe responder 400 Bad Request si justificacion_rechazo tiene menos de 5 caracteres (Regla §3.3)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Delegado Cuadrilla",
      rol: "DELEGADO_CUADRILLA",
    });

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "hola" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors[0].campo).toBe("justificacion_rechazo");
  });

  it("debe responder 404 Not Found si la misión no existe", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Delegado Cuadrilla",
      rol: "DELEGADO_CUADRILLA",
    });
    vi.mocked(misionService.rechazarMisionService).mockRejectedValueOnce(
      new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Falla mecánica grave" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(404);
  });

  it("debe responder 409 Conflict si la misión ya no está en estado DESPACHADA", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Delegado Cuadrilla",
      rol: "DELEGADO_CUADRILLA",
    });
    vi.mocked(misionService.rechazarMisionService).mockRejectedValueOnce(
      new ConflictError("La misión no se encuentra en estado 'DESPACHADA' para ser rechazada.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Falla mecánica grave" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(409);
  });

  it("debe responder 200 OK cuando el Delegado de Cuadrilla rechaza la misión con justificación válida", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Delegado Cuadrilla",
      rol: "DELEGADO_CUADRILLA",
    });

    const respuestaMock: RechazarMisionResponse = {
      message:
        "Misión rechazada exitosamente. La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a VERIFICANDO para su reasignación.",
      data: {
        mision: {
          id: misionIdValido,
          codigo: "MIS-2026-0005",
          tipoMision: "ATENCION_CUADRILLA",
          estado: "RECHAZADA",
          justificacionRechazo: "Falla hidráulica en camión tolva",
          fechaCierre: "2026-11-16T23:15:00.000Z",
          actualizadoEn: "2026-11-16T23:15:00.000Z",
        },
        cuadrilla: {
          id: "50000000-0000-4000-8000-000000000001",
          nombre: "Cuadrilla Vías y Canales 1",
          estado: "DISPONIBLE",
          delegacionId: "30000000-0000-4000-8000-000000000002",
          usuarioDelegadoId: delegadoIdValido,
        },
        incidente: {
          id: "30000000-0000-4000-8000-000000000001",
          codigo: "INC-2026-0001",
          estado: "VERIFICANDO",
          prioridad: "ALTA",
        },
        hito: {
          id: "80000000-0000-4000-8000-000000000099",
          misionId: misionIdValido,
          hito: "RECHAZADA",
          descripcion: "Misión rechazada por cuadrilla: Falla hidráulica en camión tolva",
          registradoPorId: delegadoIdValido,
          latitud: null,
          longitud: null,
          creadoEn: "2026-11-16T23:15:00.000Z",
        },
      },
    };

    vi.mocked(misionService.rechazarMisionService).mockResolvedValueOnce(respuestaMock);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/rechazar`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token-delegado",
      },
      body: JSON.stringify({ justificacion_rechazo: "Falla hidráulica en camión tolva" }),
    });

    const res = await POST(req, contextValido);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mision.estado).toBe("RECHAZADA");
    expect(body.data.cuadrilla.estado).toBe("DISPONIBLE");
    expect(body.data.incidente.estado).toBe("VERIFICANDO");
    expect(body.data.hito.hito).toBe("RECHAZADA");
  });
});
