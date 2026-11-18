import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";
import * as recuperacionService from "@/modules/eventos-atp/recuperacion.service";
import type { EventoRecuperacionResponse } from "@/modules/eventos-atp/recuperacion.schema";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import type { UsuarioAutenticado } from "@/modules/seguridad/auth.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

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
  });

  it("debe responder 400 si el cuerpo de la solicitud está vacío o sin campos editables", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "PATCH",
        headers: { "x-user-id": usuarioEncargadoId },
        body: JSON.stringify({}),
      }
    );

    const res = await PATCH(req, makeContext());
    expect(res.status).toBe(400);
  });

  it("debe responder 404 si el operativo de recuperación no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "editarEventoRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.NotFoundError("El operativo de recuperación indicado no fue encontrado.")
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
    expect(res.status).toBe(404);
  });

  it("debe responder 409 Conflict si el operativo está en estado COMPLETADA o CANCELADA", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "editarEventoRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.RecuperacionNoEditableError(
        "No es posible editar un operativo de recuperación en estado COMPLETADA."
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
  });

  it("debe responder 200 OK cuando la edición es exitosa", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);

    const mockResponse: EventoRecuperacionResponse = {
      id: recuperacionId,
      codigo: "REC-2026-0001",
      nombre: "Operativo Collico",
      descripcion: payloadValido.descripcion,
      sector: "Collico",
      direccionTexto: "Balmaceda 1245",
      prioridad: "ALTA",
      contactoNombre: null,
      contactoTelefono: null,
      latitud: -39.8142,
      longitud: -73.2459,
      estado: "EN_EJECUCION",
      familiasAfectadas: 4,
      delegacion: null,
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0042",
        titulo: "Operativo Collico",
        estado: "DESPACHADA",
        tipoMision: "RECUPERACION",
      },
      patrulla: {
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Alfa",
        estado: "EN_RECUPERACION",
      },
      recursos: [
        {
          recursoId: "80000000-0000-4000-8000-000000000001",
          nombre: "Frazadas",
          cantidadAsignada: 12,
        },
      ],
      creadoPorId: usuarioEncargadoId,
      fechaEstimadaFin: payloadValido.fechaEstimadaFin,
      actualizadoPorId: usuarioEncargadoId,
      creadoEn: "2026-11-10T10:00:00.000Z",
      actualizadoEn: "2026-11-18T12:00:00.000Z",
    };

    vi.spyOn(recuperacionService, "editarEventoRecuperacionService").mockResolvedValueOnce(
      mockResponse
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
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.descripcion).toBe(payloadValido.descripcion);
    expect(body.data.actualizadoPorId).toBe(usuarioEncargadoId);
  });

  it("debe responder 409 Conflict si la nueva patrulla indicada no está disponible", async () => {
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

  it("GET debe responder 200 OK con el detalle completo del operativo para precarga", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "obtenerEventoRecuperacionPorIdService").mockResolvedValueOnce({
      id: recuperacionId,
      codigo: "REC-2026-0001",
      nombre: "Operativo Collico",
      descripcion: "Descripción",
      sector: "Collico",
      direccionTexto: null,
      prioridad: "ALTA",
      contactoNombre: null,
      contactoTelefono: null,
      latitud: -39.8142,
      longitud: -73.2459,
      estado: "EN_EJECUCION",
      familiasAfectadas: 4,
      delegacion: null,
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0042",
        titulo: "Operativo Collico",
        estado: "DESPACHADA",
        tipoMision: "RECUPERACION",
      },
      patrulla: {
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Alfa",
        estado: "EN_RECUPERACION",
      },
      recursos: [],
      creadoPorId: usuarioEncargadoId,
      fechaEstimadaFin: "2026-11-20T18:00:00.000Z",
      actualizadoPorId: null,
      creadoEn: "2026-11-10T10:00:00.000Z",
      actualizadoEn: "2026-11-10T10:00:00.000Z",
    });

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "GET",
        headers: { "x-user-id": usuarioEncargadoId },
      }
    );

    const res = await GET(req, makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.patrulla.nombre).toBe("Patrulla Alfa");
    expect(body.data.fechaEstimadaFin).toBe("2026-11-20T18:00:00.000Z");
  });

  it("GET debe responder 404 si el operativo no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockUsuarioAutenticado);
    vi.spyOn(recuperacionService, "obtenerEventoRecuperacionPorIdService").mockRejectedValueOnce(
      new recuperacionService.NotFoundError("El operativo de recuperación indicado no fue encontrado.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`,
      {
        method: "GET",
        headers: { "x-user-id": usuarioEncargadoId },
      }
    );

    const res = await GET(req, makeContext());
    expect(res.status).toBe(404);
  });
});
