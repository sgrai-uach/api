import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import * as misionService from "@/modules/misiones/mision.service";
import { PERMISO_CREAR_REPORTE } from "@/modules/seguridad/permisos.constants";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  solicitarApoyoMisionService: vi.fn(),
}));

describe("Route Handler POST /api/misiones/[id]/apoyo (HU-44)", () => {
  const misionId = "60000000-0000-4000-8000-000000000001";
  const delegadoUserId = "00000000-0000-4000-8000-000000000005";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 si falta autenticación válida", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/apoyo`,
      {
        method: "POST",
        body: JSON.stringify({
          requiereApoyoAdicional: true,
          detalleApoyoRequerido: "Se solicita motoniveladora adicional",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el usuario no posee el permiso RBAC reportes:crear", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError(`No cuenta con el permiso requerido: ${PERMISO_CREAR_REPORTE}`)
    );

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/apoyo`,
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          requiereApoyoAdicional: true,
          detalleApoyoRequerido: "Se solicita motoniveladora adicional",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(403);
    expect(authService.verificarPermiso).toHaveBeenCalledWith(
      delegadoUserId,
      PERMISO_CREAR_REPORTE
    );
  });

  it("debe retornar 400 Bad Request si se marca apoyo adicional sin ingresar el detalle o con < 5 caracteres", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: delegadoUserId,
      nombre: "Delegado Cuadrilla",
      rol: "Delegado de Cuadrilla",
    });

    const reqSinDetalle = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/apoyo`,
      {
        method: "POST",
        body: JSON.stringify({
          requiereApoyoAdicional: true,
        }),
      }
    );
    const res1 = await POST(reqSinDetalle, {
      params: Promise.resolve({ id: misionId }),
    });
    expect(res1.status).toBe(400);
    const body1 = await res1.json();
    expect(body1.errors[0].campo).toBe("detalleApoyoRequerido");

    const reqDetalleCorto = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/apoyo`,
      {
        method: "POST",
        body: JSON.stringify({
          requiere_apoyo_adicional: true,
          detalle_apoyo_requerido: "abc",
        }),
      }
    );
    const res2 = await POST(reqDetalleCorto, {
      params: Promise.resolve({ id: misionId }),
    });
    expect(res2.status).toBe(400);
    expect(misionService.solicitarApoyoMisionService).not.toHaveBeenCalled();
  });

  it("debe retornar 400 si el UUID de misión es inválido o el JSON está mal formado", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: delegadoUserId,
      nombre: "Delegado Cuadrilla",
      rol: "Delegado de Cuadrilla",
    });

    const reqBadId = new NextRequest(
      "http://localhost:3000/api/misiones/uuid-invalido/apoyo",
      {
        method: "POST",
        body: JSON.stringify({ requiereApoyoAdicional: false }),
      }
    );
    const resBadId = await POST(reqBadId, {
      params: Promise.resolve({ id: "uuid-invalido" }),
    });
    expect(resBadId.status).toBe(400);

    const reqBadJson = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/apoyo`,
      {
        method: "POST",
        body: "{bad-json",
      }
    );
    const resBadJson = await POST(reqBadJson, {
      params: Promise.resolve({ id: misionId }),
    });
    expect(resBadJson.status).toBe(400);
  });

  it("debe propagar 404 y 409 desde el servicio", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: delegadoUserId,
      nombre: "Delegado Cuadrilla",
      rol: "Delegado de Cuadrilla",
    });

    vi.mocked(misionService.solicitarApoyoMisionService).mockRejectedValueOnce(
      new NotFoundError("Misión no encontrada")
    );
    const req404 = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/apoyo`,
      {
        method: "POST",
        body: JSON.stringify({
          requiereApoyoAdicional: true,
          detalleApoyoRequerido: "Se requiere camión aljibe",
        }),
      }
    );
    const res404 = await POST(req404, { params: Promise.resolve({ id: misionId }) });
    expect(res404.status).toBe(404);

    vi.mocked(misionService.solicitarApoyoMisionService).mockRejectedValueOnce(
      new ConflictError("La misión debe estar EN_CURSO")
    );
    const req409 = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/apoyo`,
      {
        method: "POST",
        body: JSON.stringify({
          requiereApoyoAdicional: true,
          detalleApoyoRequerido: "Se requiere camión aljibe",
        }),
      }
    );
    const res409 = await POST(req409, { params: Promise.resolve({ id: misionId }) });
    expect(res409.status).toBe(409);
  });

  it("debe retornar 201 Created cuando se solicita apoyo adicional correctamente", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoUserId,
      nombre: "Delegado Cuadrilla",
      rol: "Delegado de Cuadrilla",
    });

    const mockResponse = {
      message:
        "Solicitud de apoyo adicional registrada y alertada al Centro de Mando exitosamente.",
      data: {
        reporteId: "70000000-0000-4000-8000-000000000001",
        misionId,
        misionCodigo: "MIS-2026-0044",
        incidenteId: "50000000-0000-4000-8000-000000000001",
        requiereApoyoAdicional: true,
        detalleApoyoRequerido: "Se solicita motoniveladora y cuadrilla adicional de despeje",
        hito: {
          id: "80000000-0000-4000-8000-000000000001",
          misionId,
          hito: "APOYO_SOLICITADO",
          descripcion: "Se solicita motoniveladora y cuadrilla adicional de despeje",
          registradoPorId: delegadoUserId,
          latitud: null,
          longitud: null,
          creadoEn: "2026-11-23T20:30:00.000Z",
        },
        alertaEmitida: true,
        creadoEn: "2026-11-23T20:30:00.000Z",
      },
    };
    vi.mocked(misionService.solicitarApoyoMisionService).mockResolvedValueOnce(
      mockResponse
    );

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/apoyo`,
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          requiereApoyoAdicional: true,
          detalleApoyoRequerido: "Se solicita motoniveladora y cuadrilla adicional de despeje",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.requiereApoyoAdicional).toBe(true);
    expect(json.data.alertaEmitida).toBe(true);
    expect(misionService.solicitarApoyoMisionService).toHaveBeenCalledWith(
      misionId,
      delegadoUserId,
      false,
      {
        requiereApoyoAdicional: true,
        detalleApoyoRequerido: "Se solicita motoniveladora y cuadrilla adicional de despeje",
        observaciones: null,
      }
    );
  });
});
