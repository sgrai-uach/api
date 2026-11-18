import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "../route";
import * as recuperacionService from "@/modules/eventos-atp/recuperacion.service";
import type {
  EventoRecuperacionResponse,
  ListarRecuperacionesResponse,
} from "@/modules/eventos-atp/recuperacion.schema";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import type { UsuarioAutenticado } from "@/modules/seguridad/auth.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Route Handler POST /api/eventos-atp/recuperacion (HU-29)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";
  const mockUsuarioAutenticado: UsuarioAutenticado = {
    id: usuarioEncargadoId,
    nombre: "Encargado de Operaciones",
    rol: "ENCARGADO",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const payloadValido = {
    nombre: "Entrega de frazadas en Sector Collico",
    descripcion: "Damnificados por temporal",
    sector: "Collico",
    direccionTexto: "Calle Los Robles 123",
    prioridad: "ALTA" as const,
    latitud: -39.8142,
    longitud: -73.2459,
    patrullaId: "50000000-0000-4000-8000-000000000001",
    familiasAfectadas: 4,
    recursos: [
      {
        recursoId: "80000000-0000-4000-8000-000000000001",
        cantidad: 10,
      },
    ],
  };

  it("debe responder 401 si no hay cabecera de autenticación válida", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Cabecera X-User-Id requerida")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("X-User-Id");
  });

  it("debe responder 403 si el usuario carece del permiso recuperacion:crear", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
      new ForbiddenError("No posee el permiso requerido: recuperacion:crear")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion", {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("recuperacion:crear");
  });

  it("debe responder 400 si el cuerpo de la solicitud no es JSON válido o está vacío", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion", {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: "no-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("cuerpo de la solicitud");
  });

  it("debe responder 400 si la validación de Zod falla (ej. sin recursos asignados)", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);

    const payloadInvalido = { ...payloadValido, recursos: [] };
    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion", {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadInvalido),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("inválidos");
    expect(body.errors).toBeDefined();
  });

  it("debe responder 404 si la patrulla o algún recurso no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "crearEventoRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.NotFoundError("La patrulla verificadora indicada no fue encontrada.")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion", {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("no fue encontrada");
  });

  it("debe responder 409 si la patrulla no se encuentra en estado DISPONIBLE", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "crearEventoRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.PatrullaNoDisponibleError("La patrulla se encuentra ocupada")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion", {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("ocupada");
  });

  it("debe responder 409 si hay stock insuficiente para los recursos solicitados", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "crearEventoRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.StockInsuficienteError("Stock insuficiente para el recurso")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion", {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("Stock insuficiente");
  });

  it("debe responder 201 y retornar la estructura creada ante una solicitud válida", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);

    const respuestaMock: EventoRecuperacionResponse = {
      id: "70000000-0000-4000-8000-000000000001",
      codigo: "REC-2026-0001",
      nombre: payloadValido.nombre,
      descripcion: payloadValido.descripcion,
      sector: payloadValido.sector,
      direccionTexto: payloadValido.direccionTexto,
      prioridad: payloadValido.prioridad,
      contactoNombre: null,
      contactoTelefono: null,
      latitud: payloadValido.latitud,
      longitud: payloadValido.longitud,
      estado: "PLANIFICADA",
      familiasAfectadas: payloadValido.familiasAfectadas,
      delegacion: null,
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0001",
        titulo: payloadValido.nombre,
        estado: "DESPACHADA",
        tipoMision: "RECUPERACION",
      },
      patrulla: {
        id: payloadValido.patrullaId,
        nombre: "Patrulla Verificadora Alfa",
        estado: "EN_RECUPERACION",
      },
      recursos: [
        {
          recursoId: "80000000-0000-4000-8000-000000000001",
          nombre: "Frazadas Térmicas",
          cantidadAsignada: 10,
        },
      ],
      creadoPorId: usuarioEncargadoId,
      creadoEn: "2026-10-04T12:00:00.000Z",
      actualizadoEn: "2026-10-04T12:00:00.000Z",
    };

    vi.spyOn(recuperacionService, "crearEventoRecuperacionService").mockResolvedValueOnce(respuestaMock);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion", {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toContain("exitosamente");
    expect(body.data.codigo).toBe("REC-2026-0001");
    expect(body.data.patrulla.estado).toBe("EN_RECUPERACION");
  });
});

describe("Route Handler GET /api/eventos-atp/recuperacion (HU-73)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe responder 401 si no hay usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("autenticación");
  });

  it("debe responder 403 si el usuario carece de permiso recuperacion:leer", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(recuperacionService, "listarEventosRecuperacionService").mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: recuperacion:leer")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion", {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("recuperacion:leer");
  });

  it("debe responder 400 si los query params son inválidos", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion?limit=500", {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("inválidos");
    expect(body.errors).toBeDefined();
  });

  it("debe responder 200 y retornar listado paginado bajo estándar H34", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

    const respuestaMock: ListarRecuperacionesResponse = {
      message: "Listado de operativos de recuperación obtenido exitosamente",
      data: [
        {
          id: "70000000-0000-4000-8000-000000000001",
          codigo: "REC-2026-0001",
          nombre: "Entrega de frazadas en Collico",
          descripcion: "Temporal de viento",
          sector: "Collico",
          direccionTexto: "Calle Los Robles 123",
          prioridad: "ALTA",
          estado: "PLANIFICADA",
          familiasAfectadas: 4,
          delegacion: {
            id: "30000000-0000-4000-8000-000000000001",
            codigo: "DEL-SUR",
            nombre: "Delegación Municipal Sur",
          },
          cantidadInsumosAsignados: 15,
          totalTiposInsumos: 2,
          recursosResumen: [
            {
              recursoId: "80000000-0000-4000-8000-000000000001",
              nombre: "Frazadas Térmicas",
              cantidadAsignada: 10,
            },
          ],
          creadoEn: "2026-11-01T10:00:00.000Z",
          actualizadoEn: "2026-11-01T10:00:00.000Z",
          fechaCierre: null,
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
    };

    vi.spyOn(recuperacionService, "listarEventosRecuperacionService").mockResolvedValueOnce(respuestaMock);

    const req = new NextRequest(
      "http://localhost:3000/api/eventos-atp/recuperacion?delegacionId=30000000-0000-4000-8000-000000000001&estado=PLANIFICADA",
      {
        headers: { "x-user-id": usuarioEncargadoId },
      }
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].codigo).toBe("REC-2026-0001");
    expect(body.data[0].cantidadInsumosAsignados).toBe(15);
    expect(body.meta.totalPages).toBe(1);
  });
});
