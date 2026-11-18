import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";
import * as recuperacionService from "@/modules/eventos-atp/recuperacion.service";
import type {
  EventoRecuperacionResponse,
  RecuperacionDetalleResponse,
} from "@/modules/eventos-atp/recuperacion.schema";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import type { UsuarioAutenticado } from "@/modules/seguridad/auth.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Route Handler GET /api/eventos-atp/recuperacion/[id] (HU-73 - Drawer)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";
  const operativoValidoId = "70000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe responder 401 si no hay usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoValidoId}`);
    const res = await GET(req, { params: Promise.resolve({ id: operativoValidoId }) });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("autenticación");
  });

  it("debe responder 400 si el parámetro id no es un UUID válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion/id-no-valido");
    const res = await GET(req, { params: Promise.resolve({ id: "id-no-valido" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("no es un UUID válido");
  });

  it("debe responder 403 si el usuario carece de permiso recuperacion:leer", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(recuperacionService, "obtenerDetalleRecuperacionService").mockRejectedValueOnce(
      new ForbiddenError("No posee el permiso requerido: recuperacion:leer")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoValidoId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: operativoValidoId }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("recuperacion:leer");
  });

  it("debe responder 404 si el operativo no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(recuperacionService, "obtenerDetalleRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.NotFoundError("Operativo de recuperación no encontrado")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoValidoId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: operativoValidoId }) });

    expect(res.status).toBe(404);
  });

  it("debe responder 200 OK con el detalle consolidado del operativo", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

    const detalleMock: RecuperacionDetalleResponse = {
      id: operativoValidoId,
      codigo: "REC-2026-0001",
      nombre: "Operativo Collico",
      descripcion: "Familias damnificadas",
      sector: "Collico",
      direccionTexto: "Calle Los Robles 123",
      prioridad: "ALTA",
      contactoNombre: "Juan Pérez",
      contactoTelefono: "+56912345678",
      latitud: -39.8142,
      longitud: -73.2459,
      estado: "PLANIFICADA",
      familiasAfectadas: 4,
      delegacion: {
        id: "30000000-0000-4000-8000-000000000001",
        codigo: "DEL-NORTE",
        nombre: "Delegación Norte",
      },
      creadoPor: {
        id: usuarioEncargadoId,
        nombre: "Encargado de Operaciones",
      },
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0001",
        titulo: "Operativo Collico",
        estado: "DESPACHADA",
        tipoMision: "RECUPERACION",
      },
      patrulla: {
        id: "50000000-0000-4000-8000-000000000001",
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
      cantidadInsumosAsignados: 10,
      totalTiposInsumos: 1,
      historial: [
        {
          id: `rec-creacion-${operativoValidoId}`,
          tipo: "CREACION",
          titulo: "Operativo Planificado y Despachado",
          descripcion: "Familias damnificadas",
          registradoPor: {
            id: usuarioEncargadoId,
            nombre: "Encargado de Operaciones",
          },
          creadoEn: "2026-11-01T10:00:00.000Z",
        },
      ],
      creadoEn: "2026-11-01T10:00:00.000Z",
      actualizadoEn: "2026-11-01T10:00:00.000Z",
      fechaCierre: null,
      observacionesCierre: null,
    };

    vi.spyOn(recuperacionService, "obtenerDetalleRecuperacionService").mockResolvedValueOnce(detalleMock);

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoValidoId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: operativoValidoId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.codigo).toBe("REC-2026-0001");
    expect(body.data.historial).toHaveLength(1);
    expect(body.data.recursos[0].nombre).toBe("Frazadas Térmicas");
  });

  it("debe responder 200 OK para un operativo planificado sin mision ni patrulla asignada (REC-2026-0013)", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

    const operativoPlanificadoId = "73100000-0000-4000-8000-000000000003";
    const detallePlanificadoMock: RecuperacionDetalleResponse = {
      id: operativoPlanificadoId,
      codigo: "REC-2026-0013",
      nombre: "Distribución de víveres y kits de calefacción en campamento",
      descripcion: "Entrega de cajas de alimentos de emergencia",
      sector: "Campamento Los Jazmines, Angachilla",
      direccionTexto: "Acceso Sur Poniente s/n",
      prioridad: "CRITICA",
      contactoNombre: "Rosa Alarcón",
      contactoTelefono: "+56965432109",
      latitud: -39.831,
      longitud: -73.2289,
      estado: "PLANIFICADA",
      familiasAfectadas: 42,
      delegacion: {
        id: "30000000-0000-4000-8000-000000000002",
        codigo: "DEL-SUR",
        nombre: "Delegación Sur",
      },
      creadoPor: {
        id: usuarioEncargadoId,
        nombre: "Encargado de Operaciones",
      },
      mision: null,
      patrulla: null,
      recursos: [
        {
          recursoId: "73000000-0000-4000-8000-000000000002",
          nombre: "Cajas de Alimentos",
          cantidadAsignada: 45,
        },
      ],
      cantidadInsumosAsignados: 45,
      totalTiposInsumos: 1,
      historial: [
        {
          id: `rec-creacion-${operativoPlanificadoId}`,
          tipo: "CREACION",
          titulo: "Operativo Planificado",
          descripcion: "Entrega de cajas de alimentos de emergencia",
          registradoPor: {
            id: usuarioEncargadoId,
            nombre: "Encargado de Operaciones",
          },
          creadoEn: "2026-11-01T10:00:00.000Z",
        },
      ],
      creadoEn: "2026-11-01T10:00:00.000Z",
      actualizadoEn: "2026-11-01T10:00:00.000Z",
      fechaEstimadaFin: null,
      actualizadoPorId: null,
      fechaCierre: null,
      observacionesCierre: null,
    };

    vi.spyOn(recuperacionService, "obtenerDetalleRecuperacionService").mockResolvedValueOnce(detallePlanificadoMock);

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoPlanificadoId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: operativoPlanificadoId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.codigo).toBe("REC-2026-0013");
    expect(body.data.mision).toBeNull();
    expect(body.data.patrulla).toBeNull();
    expect(body.data.fechaEstimadaFin).toBeNull();
    expect(body.data.estado).toBe("PLANIFICADA");
  });
});

describe("Route Handler PATCH /api/eventos-atp/recuperacion/[id] (HU-74)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";
  const recuperacionId = "70000000-0000-4000-8000-000000000001";
  const mockUsuarioAutenticado: UsuarioAutenticado = {
    id: usuarioEncargadoId,
    nombre: "Encargado de Operaciones",
    rol: "ENCARGADO",
  };

  const makeContext = (id = recuperacionId) => ({
    params: Promise.resolve({ id }),
  });

  const payloadValido = {
    descripcion: "Actualización de tareas en terreno",
    fechaEstimadaFin: "2026-11-20T18:00:00.000Z",
    recursos: [
      {
        recursoId: "80000000-0000-4000-8000-000000000001",
        cantidad: 12,
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe responder 401 si no hay cabecera de autenticación válida", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Cabecera X-User-Id requerida")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(401);
  });

  it("debe responder 403 si el usuario carece del permiso recuperacion:editar", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
      new ForbiddenError("No posee el permiso requerido: recuperacion:editar")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "PATCH",
        headers: { "x-user-id": usuarioEncargadoId },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("recuperacion:editar");
  });

  it("debe responder 400 si el parámetro id no es un UUID válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);

    const req = new NextRequest(
      "http://localhost:3000/api/eventos-atp/recuperacion/id-no-valido",
      {
        method: "PATCH",
        headers: { "x-user-id": usuarioEncargadoId },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, makeContext("id-no-valido"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("no es un UUID válido");
  });

  it("debe responder 400 si el cuerpo no es JSON válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "PATCH",
        headers: { "x-user-id": usuarioEncargadoId },
        body: "no-json",
      }
    );

    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("cuerpo de la solicitud");
  });

  it("debe responder 409 si el operativo está en estado COMPLETADA o CANCELADA", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "editarEventoRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.RecuperacionNoEditableError(
        "No se puede modificar un operativo de recuperación en estado COMPLETADA."
      )
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "PATCH",
        headers: { "x-user-id": usuarioEncargadoId },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("COMPLETADA");
  });

  it("debe responder 409 si hay stock insuficiente para incrementar recursos", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "editarEventoRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.StockInsuficienteError(
        'Stock insuficiente para "Frazadas Térmicas": se requieren 5 adicionales pero hay 2 disponibles.'
      )
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "PATCH",
        headers: { "x-user-id": usuarioEncargadoId },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("Stock insuficiente");
  });

  it("debe responder 409 si la nueva patrulla no se encuentra DISPONIBLE", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "editarEventoRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.PatrullaNoDisponibleError(
        'La patrulla "Patrulla Beta" no está disponible para asignación.'
      )
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "PATCH",
        headers: { "x-user-id": usuarioEncargadoId },
        body: JSON.stringify({
          patrullaId: "50000000-0000-4000-8000-000000000002",
        }),
      }
    );

    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(409);
  });

  it("debe responder 200 OK ante edición exitosa", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);

    const respuestaMock: EventoRecuperacionResponse = {
      id: recuperacionId,
      codigo: "REC-2026-0001",
      nombre: "Entrega de frazadas en Sector Collico",
      descripcion: payloadValido.descripcion,
      sector: "Collico",
      direccionTexto: "Calle Los Robles 123",
      prioridad: "ALTA",
      contactoNombre: null,
      contactoTelefono: null,
      latitud: -39.8142,
      longitud: -73.2459,
      estado: "PLANIFICADA",
      familiasAfectadas: 4,
      delegacion: null,
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0001",
        titulo: "Entrega de frazadas en Sector Collico",
        estado: "DESPACHADA",
        tipoMision: "RECUPERACION",
      },
      patrulla: {
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Verificadora Alfa",
        estado: "EN_RECUPERACION",
      },
      recursos: [
        {
          recursoId: "80000000-0000-4000-8000-000000000001",
          nombre: "Frazadas Térmicas",
          cantidadAsignada: 12,
        },
      ],
      creadoPorId: usuarioEncargadoId,
      fechaEstimadaFin: payloadValido.fechaEstimadaFin,
      actualizadoPorId: usuarioEncargadoId,
      creadoEn: "2026-10-04T12:00:00.000Z",
      actualizadoEn: "2026-10-04T12:30:00.000Z",
    };

    vi.spyOn(recuperacionService, "editarEventoRecuperacionService").mockResolvedValueOnce(respuestaMock);

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "PATCH",
        headers: { "x-user-id": usuarioEncargadoId },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("actualizada exitosamente");
    expect(body.data.recursos[0].cantidadAsignada).toBe(12);
  });
});
