import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as recuperacionService from "@/modules/eventos-atp/recuperacion.service";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Route Handler POST /api/eventos-atp/recuperacion/[id]/asignar (HU-32)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";
  const recuperacionId = "70000000-0000-4000-8000-000000000001";
  const contextValido = { params: Promise.resolve({ id: recuperacionId }) };

  const payloadValido = {
    patrullaId: "50000000-0000-4000-8000-000000000001",
    recursos: [
      {
        recursoId: "80000000-0000-4000-8000-000000000001",
        cantidad: 10,
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe retornar 401 si no hay usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Token requerido")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}/asignar`, {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req, contextValido);
    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el usuario carece del permiso misiones:asignar", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
      new ForbiddenError("No posee el permiso misiones:asignar")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}/asignar`, {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req, contextValido);
    expect(res.status).toBe(403);
  });

  it("debe retornar 400 si el parámetro id de ruta es inválido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/id-invalido/asignar`, {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "id-invalido" }) });
    expect(res.status).toBe(400);
  });

  it("debe retornar 400 si el body no es un JSON válido o faltan campos obligatorios", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}/asignar`, {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify({ patrullaId: "invalido" }),
    });
    const res = await POST(req, contextValido);
    expect(res.status).toBe(400);
  });

  it("debe retornar 404 si el servicio lanza NotFoundError", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });
    vi.spyOn(recuperacionService, "asignarRecursosRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.NotFoundError("Recurso no encontrado")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}/asignar`, {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req, contextValido);
    expect(res.status).toBe(404);
  });

  it("debe retornar 409 si el servicio lanza PatrullaNoDisponibleError", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });
    vi.spyOn(recuperacionService, "asignarRecursosRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.PatrullaNoDisponibleError("Patrulla ocupada")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}/asignar`, {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req, contextValido);
    expect(res.status).toBe(409);
  });

  it("debe retornar 409 si el servicio lanza StockInsuficienteError", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });
    vi.spyOn(recuperacionService, "asignarRecursosRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.StockInsuficienteError("Stock insuficiente")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}/asignar`, {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req, contextValido);
    expect(res.status).toBe(409);
  });

  it("debe retornar 409 si el servicio lanza RecursoNoDisponibleError (en mantención)", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });
    vi.spyOn(recuperacionService, "asignarRecursosRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.RecursoNoDisponibleError("Recurso en mantención")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}/asignar`, {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req, contextValido);
    expect(res.status).toBe(409);
  });

  it("debe retornar 200 con la asignación exitosa si todos los datos y reglas son válidos", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });

    vi.spyOn(recuperacionService, "asignarRecursosRecuperacionService").mockResolvedValueOnce({
      evento: {
        id: recuperacionId,
        codigo: "REC-2026-0001",
        nombre: "Entrega de frazadas en Collico",
        estado: "PLANIFICADA",
      },
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0045",
        titulo: "Despacho Collico",
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
          esIndividual: false,
          cantidadAsignada: 10,
          cantidadEnUso: 15,
          estadoRecurso: "DISPONIBLE",
        },
      ],
      asignadoEn: "2026-10-04T12:00:00.000Z",
    });

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}/asignar`, {
      method: "POST",
      headers: { "x-user-id": usuarioEncargadoId },
      body: JSON.stringify(payloadValido),
    });
    const res = await POST(req, contextValido);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mision.tipoMision).toBe("RECUPERACION");
    expect(body.data.patrulla.estado).toBe("EN_RECUPERACION");
  });
});

