import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as recuperacionService from "@/modules/eventos-atp/recuperacion.service";
import type { CerrarRecuperacionResponseData } from "@/modules/eventos-atp/recuperacion.schema";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import type { UsuarioAutenticado } from "@/modules/seguridad/auth.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";
import { PERMISO_CERRAR_RECUPERACION } from "@/modules/seguridad/permisos.constants";

describe("Route Handler POST /api/eventos-atp/recuperacion/[id]/cerrar (HU-75)", () => {
  const usuarioId = "00000000-0000-4000-8000-000000000003";
  const operativoId = "70000000-0000-4000-8000-000000000001";
  const recursoId = "00000000-0000-4000-8000-000000000001";

  const usuarioMock: UsuarioAutenticado = {
    id: usuarioId,
    nombre: "Encargado Operaciones",
    rol: "ENCARGADO",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe responder 401 si no hay usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("No autenticado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoId}/cerrar`, {
      method: "POST",
      body: JSON.stringify({ resumenCierre: "Operativo finalizado." }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: operativoId }) });

    expect(res.status).toBe(401);
  });

  it("debe responder 403 si carece del permiso recuperacion:cerrar", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioId);
    const spyPermiso = vi
      .spyOn(authService, "verificarPermiso")
      .mockRejectedValueOnce(new ForbiddenError("Permiso insuficiente"));

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoId}/cerrar`, {
      method: "POST",
      body: JSON.stringify({ resumenCierre: "Operativo finalizado." }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: operativoId }) });

    expect(res.status).toBe(403);
    expect(spyPermiso).toHaveBeenCalledWith(usuarioId, PERMISO_CERRAR_RECUPERACION);
  });

  it("debe responder 400 si el UUID de ruta es inválido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioMock);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion/no-es-uuid/cerrar", {
      method: "POST",
      body: JSON.stringify({ resumenCierre: "Operativo finalizado." }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "no-es-uuid" }) });

    expect(res.status).toBe(400);
  });

  it("debe responder 400 si el body es inválido (resumen muy corto)", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioMock);

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoId}/cerrar`, {
      method: "POST",
      body: JSON.stringify({ resumenCierre: "Corto" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: operativoId }) });

    expect(res.status).toBe(400);
  });

  it("debe responder 400 si el servicio lanza ConsumoInvalidoError", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioMock);
    vi.spyOn(recuperacionService, "cerrarRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.ConsumoInvalidoError("Cantidad consumida supera lo asignado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoId}/cerrar`, {
      method: "POST",
      body: JSON.stringify({
        resumenCierre: "Resumen válido de cierre de operativo.",
        consumos: [{ recursoId, cantidadConsumida: 99 }],
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: operativoId }) });

    expect(res.status).toBe(400);
  });

  it("debe responder 404 si el operativo no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioMock);
    vi.spyOn(recuperacionService, "cerrarRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.NotFoundError("No encontrado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoId}/cerrar`, {
      method: "POST",
      body: JSON.stringify({ resumenCierre: "Resumen válido de cierre de operativo." }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: operativoId }) });

    expect(res.status).toBe(404);
  });

  it("debe responder 409 si el operativo no está en estado EN_EJECUCION", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioMock);
    vi.spyOn(recuperacionService, "cerrarRecuperacionService").mockRejectedValueOnce(
      new recuperacionService.RecuperacionNoCerrableError("Estado actual: PLANIFICADA.")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoId}/cerrar`, {
      method: "POST",
      body: JSON.stringify({ resumenCierre: "Resumen válido de cierre de operativo." }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: operativoId }) });

    expect(res.status).toBe(409);
  });

  it("debe responder 200 con el detalle del cierre exitoso", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioMock);

    const dataMock = {
      evento: {
        id: operativoId,
        codigo: "REC-2026-0001",
        estado: "COMPLETADA",
      },
      recursosReintegrados: [],
      mision: null,
      patrullaLiberada: null,
    } as unknown as CerrarRecuperacionResponseData;

    vi.spyOn(recuperacionService, "cerrarRecuperacionService").mockResolvedValueOnce(dataMock);

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoId}/cerrar`, {
      method: "POST",
      body: JSON.stringify({
        resumenCierre: "Se entregaron todas las ayudas en el sector.",
        consumos: [{ recursoId, cantidadConsumida: 7 }],
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: operativoId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.evento.estado).toBe("COMPLETADA");
  });

  it("debe responder 500 ante un error inesperado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioId);
    vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(usuarioMock);
    vi.spyOn(recuperacionService, "cerrarRecuperacionService").mockRejectedValueOnce(
      new Error("Fallo inesperado")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoId}/cerrar`, {
      method: "POST",
      body: JSON.stringify({ resumenCierre: "Resumen válido de cierre de operativo." }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: operativoId }) });

    expect(res.status).toBe(500);
  });
});
