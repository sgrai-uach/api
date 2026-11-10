import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { NextRequest } from "next/server";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as misionListadoService from "@/modules/misiones/mision-listado.service";
import * as misionService from "@/modules/misiones/mision.service";
import {
  ForbiddenError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
  verificarAsignarMision: vi.fn(),
}));

vi.mock("@/modules/misiones/mision-listado.service", () => ({
  listarMisionesService: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  asignarCuadrillaMisionService: vi.fn(),
  asignarPatrullaVerificacionService: vi.fn(),
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
    vi.mocked(misionListadoService.listarMisionesService).mockResolvedValueOnce({
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

describe("Route Handler POST /api/misiones (HU-20: Asignar Patrulla Verificadora)", () => {
  const usuarioEncargadoMock = {
    id: "00000000-0000-4000-8000-000000000003",
    email: "encargado@valdivia.cl",
    rut: "12.345.678-9",
    nombre: "Encargado Municipal",
    rolId: "20000000-0000-4000-8000-000000000003",
    rolNombre: "Encargado",
    activo: true,
  };

  const payloadValido = {
    incidenteId: "50000000-0000-4000-8000-000000000001",
    patrullaId: "f1000000-0000-4000-8000-000000000001",
    titulo: "Verificación de anegamiento",
    descripcion: "Evaluar anegamiento en calzada",
    prioridad: "ALTA",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe responder 401 Unauthorized si no hay token de autenticación", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockRejectedValueOnce(
      new UnauthorizedError("No autorizado.")
    );

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("debe responder 403 Forbidden si el usuario carece del permiso 'misiones:asignar'", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockRejectedValueOnce(
      new ForbiddenError("Acceso denegado. Se requiere el permiso 'misiones:asignar'.")
    );

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("misiones:asignar");
  });

  it("debe responder 400 Bad Request si el payload no es un JSON válido", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      body: "no-json-body",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("formato JSON válido");
  });

  it("debe responder 400 Bad Request si los datos de misión violan el esquema Zod", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      body: JSON.stringify({
        incidenteId: "no-es-uuid",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Datos de misión inválidos");
    expect(body.errors).toBeDefined();
  });

  it("debe responder 404 Not Found si el incidente o patrulla no existen", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);
    vi.mocked(misionService.asignarPatrullaVerificacionService).mockRejectedValueOnce(
      new NotFoundError("Incidente no encontrado.")
    );

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("Incidente no encontrado");
  });

  it("debe responder 409 Conflict si la patrulla ya no está DISPONIBLE o el incidente no está en REPORTADO", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);
    vi.mocked(misionService.asignarPatrullaVerificacionService).mockRejectedValueOnce(
      new ConflictError("La patrulla verificadora ya no se encuentra en estado 'DISPONIBLE'.")
    );

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("ya no se encuentra en estado 'DISPONIBLE'");
  });

  it("debe responder 201 Created al despachar exitosamente la patrulla al incidente", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);
    vi.mocked(misionService.asignarPatrullaVerificacionService).mockResolvedValueOnce({
      message: "Misión de verificación creada y patrulla despachada exitosamente.",
      data: {
        mision: {
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-5555",
          titulo: "Verificación de anegamiento",
          descripcion: "Evaluar anegamiento en calzada",
          tipoMision: "VERIFICACION",
          estado: "DESPACHADA",
          prioridad: "ALTA",
          incidenteId: payloadValido.incidenteId,
          patrullaId: payloadValido.patrullaId,
          encargadoId: usuarioEncargadoMock.id,
          fechaInicio: null,
          creadoEn: "2026-10-27T17:00:00.000Z",
        },
        incidente: {
          id: payloadValido.incidenteId,
          codigo: "INC-2026-0001",
          estado: "VERIFICANDO",
        },
        patrulla: {
          id: payloadValido.patrullaId,
          nombre: "Patrulla Norte 1",
          estado: "EN_VERIFICACION",
        },
        hitoInicial: {
          id: "70000000-0000-4000-8000-000000000001",
          hito: "DESPACHADA",
          descripcion: "Misión de verificación asignada y despachada a la patrulla Patrulla Norte 1.",
          creadoEn: "2026-10-27T17:00:00.000Z",
        },
      },
    });

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toContain("Misión de verificación creada y patrulla despachada exitosamente");
    expect(body.data.mision.estado).toBe("DESPACHADA");
    expect(body.data.incidente.estado).toBe("VERIFICANDO");
    expect(body.data.patrulla.estado).toBe("EN_VERIFICACION");
    expect(body.data.hitoInicial.hito).toBe("DESPACHADA");
  });
});

describe("Route Handler POST /api/misiones (Asignar Cuadrilla y Liberar Patrulla - HU-21)", () => {
  const usuarioEncargadoMock = {
    id: "10000000-0000-4000-8000-000000000002",
    email: "encargado@valdivia.cl",
    rut: "12.345.678-9",
    nombre: "Encargado Operaciones",
    rolId: "20000000-0000-4000-8000-000000000003",
    rolNombre: "Encargado",
    activo: true,
  };
  const incidenteValidoId = "30000000-0000-4000-8000-000000000001";
  const cuadrillaValidaId = "50000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe responder 400 Bad Request si los datos de asignación de cuadrilla son inválidos", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      headers: { authorization: "Bearer token_valido" },
      body: JSON.stringify({
        tipoMision: "ATENCION_CUADRILLA",
        incidenteId: "no-es-uuid",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Parámetros de entrada inválidos");
  });

  it("debe responder 404 Not Found si el incidente o la cuadrilla no existen", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);

    vi.mocked(misionService.asignarCuadrillaMisionService).mockRejectedValueOnce(
      new NotFoundError("No se encontró ningún incidente con el identificador proporcionado.")
    );

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      headers: { authorization: "Bearer token_valido" },
      body: JSON.stringify({
        tipoMision: "ATENCION_CUADRILLA",
        incidenteId: incidenteValidoId,
        cuadrillaId: cuadrillaValidaId,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("No se encontró ningún incidente");
  });

  it("debe responder 409 Conflict si la cuadrilla no está disponible", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);

    vi.mocked(misionService.asignarCuadrillaMisionService).mockRejectedValueOnce(
      new ConflictError("La cuadrilla 'Cuadrilla 1' no está disponible para asignación (estado actual: 'EN_MISION').")
    );

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      headers: { authorization: "Bearer token_valido" },
      body: JSON.stringify({
        tipoMision: "ATENCION_CUADRILLA",
        incidenteId: incidenteValidoId,
        cuadrillaId: cuadrillaValidaId,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("no está disponible");
  });

  it("debe responder 409 Conflict con estructura de negocio 'VERIFICACION_EN_CURSO' si la patrulla no ha finalizado evaluación", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);

    vi.mocked(misionService.asignarCuadrillaMisionService).mockRejectedValueOnce(
      new ConflictError(
        "No es posible despachar una cuadrilla operativa: la patrulla verificadora asignada ('Patrulla Alfa-1') aún no ha finalizado la evaluación técnica en terreno.",
        "VERIFICACION_EN_CURSO",
        {
          incidenteId: incidenteValidoId,
          misionVerificacionId: "60000000-0000-4000-8000-000000000001",
          patrullaId: "f1000000-0000-4000-8000-000000000001",
          patrullaNombre: "Patrulla Alfa-1",
          estadoMision: "EN_CURSO",
        }
      )
    );

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      headers: { authorization: "Bearer token_valido" },
      body: JSON.stringify({
        tipoMision: "ATENCION_CUADRILLA",
        incidenteId: incidenteValidoId,
        cuadrillaId: cuadrillaValidaId,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.statusCode).toBe(409);
    expect(body.error).toBe("Conflict");
    expect(body.codigo).toBe("VERIFICACION_EN_CURSO");
    expect(body.message).toContain("aún no ha finalizado la evaluación técnica en terreno");
    expect(body.detalles.patrullaNombre).toBe("Patrulla Alfa-1");
  });

  it("debe responder 201 Created cuando la cuadrilla se asigna exitosamente y libera la patrulla", async () => {
    vi.mocked(authGuard.verificarAsignarMision).mockResolvedValueOnce(usuarioEncargadoMock);

    vi.mocked(misionService.asignarCuadrillaMisionService).mockResolvedValueOnce({
      message: "Cuadrilla 'Cuadrilla Vías y Canales 1' asignada exitosamente al incidente INC-2026-0001. La patrulla verificadora previa ha sido liberada a estado DISPONIBLE.",
      data: {
        mision: {
          id: "70000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0005",
          titulo: "Atención táctica - Incidente INC-2026-0001",
          descripcion: "Despeje de calzada",
          tipoMision: "ATENCION_CUADRILLA",
          estado: "DESPACHADA",
          prioridad: "ALTA",
          incidenteId: incidenteValidoId,
          cuadrillaId: cuadrillaValidaId,
          encargadoId: usuarioEncargadoMock.id,
          creadoPorId: usuarioEncargadoMock.id,
          fechaInicio: null,
          creadoEn: "2026-10-04T12:30:00.000Z",
        },
        cuadrilla: {
          id: cuadrillaValidaId,
          nombre: "Cuadrilla Vías y Canales 1",
          estado: "EN_MISION",
        },
        incidente: {
          id: incidenteValidoId,
          codigo: "INC-2026-0001",
          estado: "EN_ATENCION",
          prioridad: "ALTA",
        },
        patrullaLiberada: {
          id: "f1000000-0000-4000-8000-000000000001",
          nombre: "Patrulla Rápida Costa-1",
          estado: "DISPONIBLE",
          misionPreviaId: "60000000-0000-4000-8000-000000000001",
        },
        hitoCuadrilla: {
          id: "80000000-0000-4000-8000-000000000001",
          misionId: "70000000-0000-4000-8000-000000000001",
          hito: "CUADRILLA_DESPACHADA",
          descripcion: "Cuadrilla despachada a terreno para resolución táctica del incidente",
          creadoEn: "2026-10-04T12:30:00.000Z",
        },
        hitoPatrulla: {
          id: "80000000-0000-4000-8000-000000000002",
          misionId: "60000000-0000-4000-8000-000000000001",
          hito: "VERIFICACION_FINALIZADA",
          descripcion: "Misión de verificación concluida automáticamente por asignación y relevo de cuadrilla operativa",
          creadoEn: "2026-10-04T12:30:00.000Z",
        },
      },
    });

    const req = new NextRequest("http://localhost:3000/api/misiones", {
      method: "POST",
      headers: { authorization: "Bearer token_valido" },
      body: JSON.stringify({
        tipoMision: "ATENCION_CUADRILLA",
        incidenteId: incidenteValidoId,
        cuadrillaId: cuadrillaValidaId,
        titulo: "Atención táctica - Incidente INC-2026-0001",
        descripcion: "Despeje de calzada",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.mision.estado).toBe("DESPACHADA");
    expect(body.data.cuadrilla.estado).toBe("EN_MISION");
    expect(body.data.incidente.estado).toBe("EN_ATENCION");
    expect(body.data.patrullaLiberada.estado).toBe("DISPONIBLE");
    expect(body.data.hitoCuadrilla.hito).toBe("CUADRILLA_DESPACHADA");
    expect(body.data.hitoPatrulla.hito).toBe("VERIFICACION_FINALIZADA");
  });
});
