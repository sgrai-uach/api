import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as recuperacionService from "@/modules/eventos-atp/recuperacion.service";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Route Handler GET /api/eventos-atp/recuperacion/[id] (HU-32)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";
  const recuperacionId = "70000000-0000-4000-8000-000000000001";
  const contextValido = { params: Promise.resolve({ id: recuperacionId }) };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe retornar 401 si no hay usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Token requerido")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`);
    const res = await GET(req, contextValido);
    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el usuario carece de permisos de lectura", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockRejectedValue(
      new ForbiddenError("Acceso denegado")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, contextValido);
    expect(res.status).toBe(403);
  });

  it("debe retornar 400 si el parámetro id no es un UUID válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion/id-no-valido", {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "id-no-valido" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("inválido");
  });

  it("debe retornar 404 si el evento de recuperación no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });
    vi.spyOn(recuperacionService, "obtenerDetalleRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.NotFoundError("No existe")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, contextValido);
    expect(res.status).toBe(404);
  });

  it("debe retornar 200 con el detalle completo del evento si la solicitud es válida", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
      id: usuarioEncargadoId,
      nombre: "Encargado",
      rol: "ENCARGADO",
    });

    vi.spyOn(recuperacionService, "obtenerDetalleRecuperacionService").mockResolvedValueOnce({
      id: recuperacionId,
      codigo: "REC-2026-0001",
      nombre: "Entrega de frazadas en Collico",
      descripcion: "Afectados por temporal",
      sector: "Collico",
      direccionTexto: "Calle Los Robles 123",
      prioridad: "ALTA",
      contactoNombre: "Don Pedro",
      contactoTelefono: "+56912345678",
      latitud: -39.8142,
      longitud: -73.2459,
      estado: "PLANIFICADA",
      familiasAfectadas: 4,
      delegacion: null,
      misiones: [],
      recursosAsignados: [],
      creadoPorId: usuarioEncargadoId,
      creadoEn: "2026-10-04T12:00:00.000Z",
      actualizadoEn: "2026-10-04T12:00:00.000Z",
    });

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${recuperacionId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, contextValido);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.codigo).toBe("REC-2026-0001");
  });
});

