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
import {
  PERMISO_EJECUTAR_MISION_TERRENO,
  PERMISO_VERIFICAR_MISION_TERRENO,
} from "@/modules/seguridad/permisos.constants";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarAlgunPermiso: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  rechazarMisionService: vi.fn(),
}));

describe("Route Handler POST /api/misiones/[id]/rechazar (HU-41 Cuadrilla / HU-69 Patrulla)", () => {
  const misionCuadrillaId = "70000000-0000-4000-8000-000000000001";
  const misionPatrullaId = "60000000-0000-4000-8000-000000000050";
  const delegadoIdValido = "d0000000-0000-4000-8000-000000000001";

  const delegadoUsuarioMock: authService.UsuarioAutenticadoConPermisos = {
    id: delegadoIdValido,
    nombre: "Delegado Cuadrilla",
    rol: "DELEGADO_CUADRILLA",
    permisos: [PERMISO_EJECUTAR_MISION_TERRENO],
  };

  const patrullaUsuarioMock: authService.UsuarioAutenticadoConPermisos = {
    id: "00000000-0000-4000-8000-000000000004",
    nombre: "Patrullero Juan",
    rol: "PATRULLA_VERIFICADORA",
    permisos: [PERMISO_VERIFICAR_MISION_TERRENO],
  };

  const contextCuadrilla = {
    params: Promise.resolve({ id: misionCuadrillaId }),
  };

  const contextPatrulla = {
    params: Promise.resolve({ id: misionPatrullaId }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe responder 401 Unauthorized si no hay token de autenticación", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
    vi.mocked(authService.verificarAlgunPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación Authorization: Bearer <token>.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionPatrullaId}/rechazar`, {
      method: "POST",
      body: JSON.stringify({ justificacion_rechazo: "Desperfecto mecánico" }),
    });

    const res = await POST(req, contextPatrulla);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("autenticación");
  });

  it("debe responder 401 Unauthorized si el usuario autenticado se encuentra inactivo", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce("usuario-inactivo-id");
    vi.mocked(authService.verificarAlgunPermiso).mockRejectedValueOnce(
      new UnauthorizedError("El usuario especificado se encuentra inactivo en la institución.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionPatrullaId}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Desperfecto mecánico" }),
    });

    const res = await POST(req, contextPatrulla);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("inactivo en la institución");
  });

  it("debe responder 403 Forbidden si el usuario carece de permisos de terreno (ejecutar/verificar)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce("usuario-sin-permiso");
    vi.mocked(authService.verificarAlgunPermiso).mockRejectedValueOnce(
      new ForbiddenError(
        `No cuenta con ninguno de los permisos requeridos: ${PERMISO_EJECUTAR_MISION_TERRENO}, ${PERMISO_VERIFICAR_MISION_TERRENO}`
      )
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionCuadrillaId}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Falla mecánica grave" }),
    });

    const res = await POST(req, contextCuadrilla);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("permisos requeridos");
  });

  it("debe responder 400 Bad Request si el parámetro de ruta no es un UUID válido", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarAlgunPermiso).mockResolvedValueOnce(patrullaUsuarioMock);

    const req = new NextRequest("http://localhost:3000/api/misiones/no-es-uuid/rechazar", {
      method: "POST",
      body: JSON.stringify({ justificacion_rechazo: "Desperfecto mecánico" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "no-es-uuid" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("no es un UUID válido");
  });

  it("debe responder 400 Bad Request si el body no es un JSON válido", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarAlgunPermiso).mockResolvedValueOnce(patrullaUsuarioMock);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionPatrullaId}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "json-invalido-{{{",
    });

    const res = await POST(req, contextPatrulla);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("formato JSON válido");
  });

  it("debe responder 400 Bad Request si la justificación tiene menos de 5 caracteres (ej. 4 caracteres)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarAlgunPermiso).mockResolvedValueOnce(patrullaUsuarioMock);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionPatrullaId}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Pana" }),
    });

    const res = await POST(req, contextPatrulla);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Datos de entrada inválidos");
    expect(body.errors[0].mensaje).toContain("al menos 5 caracteres");
  });

  it("debe responder 400 Bad Request si se envía justificación vacía", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarAlgunPermiso).mockResolvedValueOnce(delegadoUsuarioMock);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionCuadrillaId}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "    " }),
    });

    const res = await POST(req, contextCuadrilla);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors[0].campo).toBe("justificacion_rechazo");
    expect(body.errors[0].mensaje).toContain("al menos 5 caracteres");
  });

  it("debe responder 400 Bad Request si se envían coordenadas geográficas fuera de rango WGS84", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarAlgunPermiso).mockResolvedValueOnce(patrullaUsuarioMock);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionPatrullaId}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        justificacion_rechazo: "Desperfecto mecánico en vehículo de patrulla",
        latitud: 1000,
        longitud: -200,
      }),
    });

    const res = await POST(req, contextPatrulla);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Datos de entrada inválidos");
  });

  it("debe responder 404 Not Found si la misión no existe", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarAlgunPermiso).mockResolvedValueOnce(delegadoUsuarioMock);
    vi.mocked(misionService.rechazarMisionService).mockRejectedValueOnce(
      new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionCuadrillaId}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Falla mecánica grave" }),
    });

    const res = await POST(req, contextCuadrilla);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("No se encontró ninguna misión");
  });

  it("debe responder 409 Conflict si la misión ya no está en estado DESPACHADA o ya fue rechazada", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarAlgunPermiso).mockResolvedValueOnce(patrullaUsuarioMock);
    vi.mocked(misionService.rechazarMisionService).mockRejectedValueOnce(
      new ConflictError("La misión ya ha sido rechazada previamente.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionPatrullaId}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ justificacion_rechazo: "Desperfecto mecánico en vehículo" }),
    });

    const res = await POST(req, contextPatrulla);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("ya ha sido rechazada previamente");
  });

  it("debe responder 200 OK cuando el Delegado de Cuadrilla rechaza la misión con justificación válida (HU-41)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarAlgunPermiso).mockResolvedValueOnce(delegadoUsuarioMock);

    const respuestaMock: RechazarMisionResponse = {
      message:
        "Misión rechazada exitosamente. La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a VERIFICANDO para su reasignación.",
      data: {
        mision: {
          id: misionCuadrillaId,
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
          misionId: misionCuadrillaId,
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

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionCuadrillaId}/rechazar`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer token-delegado",
      },
      body: JSON.stringify({ justificacion_rechazo: "Falla hidráulica en camión tolva" }),
    });

    const res = await POST(req, contextCuadrilla);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mision.estado).toBe("RECHAZADA");
    expect(body.data.cuadrilla.estado).toBe("DISPONIBLE");
    expect(body.data.incidente.estado).toBe("VERIFICANDO");
    expect(body.data.hito.hito).toBe("RECHAZADA");
  });

  it("debe responder 200 OK cuando la Patrulla Verificadora rechaza la misión exitosamente (HU-69)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUsuarioMock.id);
    vi.mocked(authService.verificarAlgunPermiso).mockResolvedValueOnce(patrullaUsuarioMock);
    vi.mocked(misionService.rechazarMisionService).mockResolvedValueOnce({
      message:
        "Misión rechazada exitosamente. El incidente ha vuelto a estado REPORTADO para su reasignación.",
      data: {
        mision: {
          id: misionPatrullaId,
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

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionPatrullaId}/rechazar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        justificacion_rechazo: "Desperfecto mecánico en vehículo de patrulla",
      }),
    });

    const res = await POST(req, contextPatrulla);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("Misión rechazada exitosamente");
    expect(body.data.mision.estado).toBe("RECHAZADA");
    expect(body.data.patrulla.estado).toBe("DISPONIBLE");
    expect(body.data.incidente.estado).toBe("REPORTADO");
  });
});
