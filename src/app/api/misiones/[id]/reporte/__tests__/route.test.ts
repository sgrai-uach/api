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
  BadRequestError,
} from "@/modules/seguridad/errors";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  enviarReporteVerificacionService: vi.fn(),
}));

describe("Route Handler POST /api/misiones/[id]/reporte (HU-39 / HU-86)", () => {
  const misionId = "60000000-0000-4000-8000-000000000001";
  const patrullaUserId = "00000000-0000-4000-8000-000000000004";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 si falta autenticación válida", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/reporte`,
      {
        method: "POST",
        body: JSON.stringify({
          dictamen: "REQUIERE_CUADRILLA",
          resumenTecnico: "Se requiere asistencia de cuadrilla municipal.",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el usuario no posee el permiso RBAC reportes:crear", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError(`No cuenta con el permiso requerido: ${PERMISO_CREAR_REPORTE}`)
    );

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/reporte`,
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          dictamen: "REQUIERE_CUADRILLA",
          resumenTecnico: "Se requiere asistencia de cuadrilla municipal.",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("reportes:crear");
    expect(authService.verificarPermiso).toHaveBeenCalledWith(
      patrullaUserId,
      PERMISO_CREAR_REPORTE
    );
  });

  it("debe retornar 400 si el parámetro id no es UUID válido o el JSON es inválido", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: patrullaUserId,
      nombre: "Patrullero",
      rol: "Patrulla Verificadora",
    });

    const reqId = new NextRequest(
      "http://localhost:3000/api/misiones/no-uuid/reporte",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
    const resId = await POST(reqId, { params: Promise.resolve({ id: "no-uuid" }) });
    expect(resId.status).toBe(400);

    const reqBadJson = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/reporte`,
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

  it("debe rechazar con 400 Bad Request si dictamen es NO_ABORDABLE sin motivo_no_abordable >= 15 caracteres o resumen_tecnico < 10 caracteres", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Patrullero",
      rol: "Patrulla Verificadora",
    });

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/reporte`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dictamen: "NO_ABORDABLE",
          motivo_no_abordable: "Corto",
          resumen_tecnico: "Corto",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errors.length).toBeGreaterThanOrEqual(2);
    expect(misionService.enviarReporteVerificacionService).not.toHaveBeenCalled();
  });

  it("debe retornar 201 Created al enviar informe técnico y cerrar misión exitosamente", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: patrullaUserId,
      nombre: "Patrullero",
      rol: "Patrulla Verificadora",
    });

    vi.mocked(
      misionService.enviarReporteVerificacionService
    ).mockResolvedValueOnce({
      message:
        "Informe técnico de verificación registrado y misión cerrada exitosamente.",
      data: {
        reporteTerreno: {
          id: "e0000000-0000-4000-8000-000000000010",
          misionId,
          tipoReporte: "VERIFICACION_CIERRE",
          dictamen: "REQUIERE_CUADRILLA",
          motivoNoAbordable: null,
          requiereAsistenciaSocial: true,
          versionReporte: 2,
          esRectificacion: false,
          etiquetaReporte:
            "Informe Técnico de Verificación (Cierre — Requiere Cuadrilla)",
          evaluador: {
            id: patrullaUserId,
            nombre: "Patrullero",
            email: "patrulla@valdivia.cl",
            rut: null,
          },
          resumenTecnico:
            "Se constata colapso de colector de aguas lluvias en pasaje interior.",
          accionesRealizadas: null,
          requiereApoyoAdicional: true,
          danosEstimados: "Anegamiento de patio y primer piso.",
          observaciones: null,
          personasAfectadas: 4,
          estadoTerreno: "CRITICO",
          adjuntos: [],
          creadoEn: "2026-11-16T00:30:00.000Z",
          actualizadoEn: "2026-11-16T00:30:00.000Z",
        },
        mision: {
          id: misionId,
          codigo: "MIS-2026-0001",
          titulo: "Verificación de Incidente",
          tipoMision: "VERIFICACION",
          estado: "COMPLETADA",
          prioridad: "ALTA",
          incidenteId: "a0000000-0000-4000-8000-000000000001",
          patrullaId: "f1000000-0000-4000-8000-000000000001",
          fechaInicio: "2026-11-15T23:50:00.000Z",
          fechaCierre: "2026-11-16T00:30:00.000Z",
          actualizadoEn: "2026-11-16T00:30:00.000Z",
        },
        patrulla: {
          id: "f1000000-0000-4000-8000-000000000001",
          nombre: "Patrulla Costa-1",
          estado: "DISPONIBLE",
        },
        incidente: {
          id: "a0000000-0000-4000-8000-000000000001",
          codigo: "INC-2026-0001",
          estado: "VERIFICANDO",
          prioridad: "ALTA",
          requiereAsistenciaSocial: true,
          fechaCierre: null,
          motivoNoAbordable: null,
        },
        hito: {
          id: "70000000-0000-4000-8000-000000000010",
          misionId,
          hito: "VERIFICACION_COMPLETADA",
          descripcion: "Informe técnico enviado y misión cerrada.",
          registradoPorId: patrullaUserId,
          latitud: null,
          longitud: null,
          metadatos: { dictamen: "REQUIERE_CUADRILLA" },
          creadoEn: "2026-11-16T00:30:00.000Z",
        },
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/reporte`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dictamen: "REQUIERE_CUADRILLA",
          resumen_tecnico:
            "Se constata colapso de colector de aguas lluvias en pasaje interior.",
          estado_terreno: "CRITICO",
          personas_afectadas: 4,
          danos_estimados: "Anegamiento de patio y primer piso.",
          requiere_asistencia_social: true,
          familias: [
            {
              referencia: "Casa 1",
              nucleoFamiliarTotal: 4,
              cantidadNinos: 1,
              contactoNombre: "María González",
              contactoTelefono: "+56912345678",
            },
          ],
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.mision.estado).toBe("COMPLETADA");
    expect(json.data.patrulla.estado).toBe("DISPONIBLE");
    expect(json.data.incidente.requiereAsistenciaSocial).toBe(true);
    expect(json.data.hito.hito).toBe("VERIFICACION_COMPLETADA");
  });

  it("debe propagar errores 404, 409 y 400 desde el servicio", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(patrullaUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: patrullaUserId,
      nombre: "Patrullero",
      rol: "Patrulla Verificadora",
    });

    const bodyValido = JSON.stringify({
      dictamen: "REQUIERE_CUADRILLA",
      resumenTecnico: "Resumen técnico válido para pruebas de errores.",
    });

    vi.mocked(
      misionService.enviarReporteVerificacionService
    ).mockRejectedValueOnce(new NotFoundError("Misión no encontrada."));
    const res404 = await POST(
      new NextRequest(`http://localhost:3000/api/misiones/${misionId}/reporte`, {
        method: "POST",
        body: bodyValido,
      }),
      { params: Promise.resolve({ id: misionId }) }
    );
    expect(res404.status).toBe(404);

    vi.mocked(
      misionService.enviarReporteVerificacionService
    ).mockRejectedValueOnce(new ConflictError("La misión ya fue completada."));
    const res409 = await POST(
      new NextRequest(`http://localhost:3000/api/misiones/${misionId}/reporte`, {
        method: "POST",
        body: bodyValido,
      }),
      { params: Promise.resolve({ id: misionId }) }
    );
    expect(res409.status).toBe(409);

    vi.mocked(
      misionService.enviarReporteVerificacionService
    ).mockRejectedValueOnce(new BadRequestError("Motivo inválido."));
    const res400 = await POST(
      new NextRequest(`http://localhost:3000/api/misiones/${misionId}/reporte`, {
        method: "POST",
        body: bodyValido,
      }),
      { params: Promise.resolve({ id: misionId }) }
    );
    expect(res400.status).toBe(400);
  });
});
