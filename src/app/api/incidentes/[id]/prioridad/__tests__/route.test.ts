import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";
import { POST as POST_CALCULAR } from "../calcular/route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import * as prioridadServiceModule from "@/modules/incidentes/prioridad.service";
import { PERMISO_VERIFICAR_MISION_TERRENO } from "@/modules/seguridad/permisos.constants";
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

vi.mock("@/modules/incidentes/prioridad.service", () => ({
  prioridadService: {
    actualizarPrioridadIncidente: vi.fn(),
    calcularPrioridadSugerida: vi.fn(),
  },
}));

describe("Route Handlers de Prioridad de Incidente en Terreno (HU-38)", () => {
  const incidenteId = "50000000-0000-4000-8000-000000000001";
  const patrullaUserId = "00000000-0000-4000-8000-000000000004";
  const misionId = "60000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH /api/incidentes/[id]/prioridad", () => {
    it("debe retornar 401 si no se provee autenticación válida", async () => {
      vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
      vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
        new UnauthorizedError("Se requiere cabecera de autenticación.")
      );

      const req = new NextRequest(
        `http://localhost:3000/api/incidentes/${incidenteId}/prioridad`,
        {
          method: "PATCH",
          body: JSON.stringify({ prioridad: "ALTA" }),
        }
      );

      const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
      expect(res.status).toBe(401);
    });

    it("debe retornar 403 si el usuario no posee el permiso RBAC misiones:terreno:verificar", async () => {
      vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
      vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
        new ForbiddenError(
          `No cuenta con el permiso requerido: ${PERMISO_VERIFICAR_MISION_TERRENO}`
        )
      );

      const req = new NextRequest(
        `http://localhost:3000/api/incidentes/${incidenteId}/prioridad`,
        {
          method: "PATCH",
          headers: { authorization: "Bearer token" },
          body: JSON.stringify({ prioridad: "ALTA" }),
        }
      );

      const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.message).toContain("misiones:terreno:verificar");
    });

    it("debe rechazar con 400 Bad Request si se cambia la prioridad sugerida sin justificación (CA-3 / QA)", async () => {
      vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
      vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
        id: patrullaUserId,
        nombre: "Patrullero",
        rol: "Patrulla Verificadora",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/incidentes/${incidenteId}/prioridad`,
        {
          method: "PATCH",
          headers: {
            authorization: "Bearer token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            prioridad: "CRITICA",
            prioridad_sugerida: "MEDIA",
            // Sin justificacion_prioridad al discrepar de prioridad_sugerida
          }),
        }
      );

      const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("Datos de entrada inválidos");
      expect(
        json.errors.some((e: { campo: string; mensaje: string }) =>
          e.mensaje.includes("al menos 5 caracteres")
        )
      ).toBe(true);
      expect(
        prioridadServiceModule.prioridadService.actualizarPrioridadIncidente
      ).not.toHaveBeenCalled();
    });

    it("debe rechazar con 400 Bad Request si la prioridad difiere de la calculada por el formulario de terreno y la justificación tiene menos de 5 caracteres", async () => {
      vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
      vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
        id: patrullaUserId,
        nombre: "Patrullero",
        rol: "Patrulla Verificadora",
      });

      const req = new NextRequest(
        `http://localhost:3000/api/incidentes/${incidenteId}/prioridad`,
        {
          method: "PATCH",
          headers: {
            authorization: "Bearer token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            prioridad: "CRITICA", // El formulario abajo sugiere BAJA (1 persona sin daños)
            justificacion_prioridad: "abc", // Menos de 5 caracteres
            evaluacion: {
              nucleoFamiliarTotal: 1,
              cantidadNinos: 0,
              personasDiscapacitadas: 0,
              mascotasAfectadas: 0,
              nivelCompromisoVivienda: "SIN_DANO",
            },
          }),
        }
      );

      const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(
        json.errors.some((e: { campo: string; mensaje: string }) =>
          e.campo.includes("justificacion_prioridad")
        )
      ).toBe(true);
    });

    it("debe retornar 200 OK al confirmar la prioridad sugerida o modificarla con justificación válida y emitir el reporte de evaluación al Centro de Mando", async () => {
      vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
      vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
        id: patrullaUserId,
        nombre: "Patrullero",
        rol: "Patrulla Verificadora",
      });

      vi.mocked(
        prioridadServiceModule.prioridadService.actualizarPrioridadIncidente
      ).mockResolvedValueOnce({
        message:
          "Evaluación en terreno y prioridad del incidente registradas exitosamente (Reporte #1).",
        data: {
          incidente: {
            id: incidenteId,
            codigo: "INC-2026-001",
            estado: "VERIFICANDO",
            prioridad: "CRITICA",
            prioridadSugerida: "ALTA",
            modificoPrioridadSugerida: true,
            justificacionPrioridad:
              "Se eleva a CRITICA por riesgo de desborde inmediato sobre vivienda de adulto mayor postrado.",
            requiereAsistenciaSocial: true,
            actualizadoEn: "2026-11-11T22:20:00.000Z",
          },
          reporteTerreno: {
            id: "e0000000-0000-4000-8000-000000000001",
            misionId,
            versionReporte: 1,
            esRectificacion: false,
            etiquetaReporte: "Reporte de Evaluación #1 (Inicial)",
            prioridadSugerida: "ALTA",
            prioridadAsignada: "CRITICA",
            justificacionPrioridad:
              "Se eleva a CRITICA por riesgo de desborde inmediato sobre vivienda de adulto mayor postrado.",
            resumenTecnico: "Evaluación en Terreno #1 (Inicial)...",
            personasAfectadas: 4,
            requiereApoyoAdicional: true,
            detallesAdicionales: "Se solicita motobomba y cuadrilla.",
            accionesRealizadas: "Contención preliminar.",
            danosEstimados: "Anegamiento de primer piso.",
            evaluacion: {
              nucleoFamiliarTotal: 4,
              cantidadNinos: 1,
              cantidadAdultosMayores: 1,
              personasDiscapacitadas: 1,
              mascotasAfectadas: 2,
            },
            evaluador: { id: patrullaUserId, nombre: "Patrullero" },
            creadoEn: "2026-11-11T22:20:00.000Z",
          },
          hito: {
            id: "70000000-0000-4000-8000-000000000001",
            misionId,
            hito: "PRIORIDAD_ASIGNADA",
            descripcion: "Reporte de evaluación #1: Prioridad asignada en terreno a CRITICA...",
            registradoPorId: patrullaUserId,
            creadoEn: "2026-11-11T22:20:00.000Z",
          },
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/incidentes/${incidenteId}/prioridad`,
        {
          method: "PATCH",
          headers: {
            authorization: "Bearer token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            prioridad: "CRITICA",
            prioridadSugerida: "ALTA",
            justificacionPrioridad:
              "Se eleva a CRITICA por riesgo de desborde inmediato sobre vivienda de adulto mayor postrado.",
            evaluacion: {
              nucleoFamiliarTotal: 4,
              cantidadNinos: 1,
              cantidadAdultosMayores: 1,
              personasDiscapacitadas: 1,
              mascotasAfectadas: 2,
              nivelCompromisoVivienda: "MODERADO",
              detallesAdicionales: "Se solicita motobomba y cuadrilla.",
            },
          }),
        }
      );

      const res = await PATCH(req, { params: Promise.resolve({ id: incidenteId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.incidente.prioridad).toBe("CRITICA");
      expect(json.data.incidente.prioridadSugerida).toBe("ALTA");
      expect(json.data.reporteTerreno.versionReporte).toBe(1);
      expect(json.data.hito.hito).toBe("PRIORIDAD_ASIGNADA");
    });

    it("debe propagar 404 NotFoundError y 409 ConflictError desde el servicio", async () => {
      vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(patrullaUserId);
      vi.mocked(authService.verificarPermiso).mockResolvedValue({
        id: patrullaUserId,
        nombre: "Patrullero",
        rol: "Patrulla Verificadora",
      });

      vi.mocked(
        prioridadServiceModule.prioridadService.actualizarPrioridadIncidente
      ).mockRejectedValueOnce(new NotFoundError("Incidente no encontrado."));

      const req404 = new NextRequest(
        `http://localhost:3000/api/incidentes/${incidenteId}/prioridad`,
        {
          method: "PATCH",
          body: JSON.stringify({ prioridad: "MEDIA" }),
        }
      );
      const res404 = await PATCH(req404, {
        params: Promise.resolve({ id: incidenteId }),
      });
      expect(res404.status).toBe(404);

      vi.mocked(
        prioridadServiceModule.prioridadService.actualizarPrioridadIncidente
      ).mockRejectedValueOnce(
        new ConflictError("La patrulla debe aceptar la misión asignada.")
      );

      const req409 = new NextRequest(
        `http://localhost:3000/api/incidentes/${incidenteId}/prioridad`,
        {
          method: "PATCH",
          body: JSON.stringify({ prioridad: "MEDIA" }),
        }
      );
      const res409 = await PATCH(req409, {
        params: Promise.resolve({ id: incidenteId }),
      });
      expect(res409.status).toBe(409);

      vi.mocked(
        prioridadServiceModule.prioridadService.actualizarPrioridadIncidente
      ).mockRejectedValueOnce(
        new BadRequestError(
          "Debe ingresar una justificación técnica de al menos 5 caracteres."
        )
      );

      const req400 = new NextRequest(
        `http://localhost:3000/api/incidentes/${incidenteId}/prioridad`,
        {
          method: "PATCH",
          body: JSON.stringify({ prioridad: "CRITICA" }),
        }
      );
      const res400 = await PATCH(req400, {
        params: Promise.resolve({ id: incidenteId }),
      });
      expect(res400.status).toBe(400);
    });
  });

  describe("POST /api/incidentes/[id]/prioridad/calcular", () => {
    it("debe retornar 200 OK con la prioridad sugerida calculada por el sistema", async () => {
      vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(patrullaUserId);
      vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
        id: patrullaUserId,
        nombre: "Patrullero",
        rol: "Patrulla Verificadora",
      });

      vi.mocked(
        prioridadServiceModule.prioridadService.calcularPrioridadSugerida
      ).mockResolvedValueOnce({
        message:
          "Prioridad sugerida calculada exitosamente según evaluación de terreno.",
        data: {
          incidenteId,
          prioridadActual: "MEDIA",
          prioridadSugerida: "ALTA",
          puntajeTotal: 45,
          factoresGatillantes: ["Núcleo familiar afectado: 4 personas (+12 pts)"],
          requiereAsistenciaSocialSugerido: true,
          evaluacionNormalizada: {
            nucleoFamiliarTotal: 4,
            familiasAfectadas: 1,
            cantidadNinos: 2,
            cantidadAdultosMayores: 0,
            personasDiscapacitadas: 1,
            personasElectrodependientes: 0,
            mascotasAfectadas: 1,
            viviendasAfectadas: 1,
            nivelCompromisoVivienda: "MODERADO",
            requiereEvacuacion: false,
            requiereAsistenciaSocial: true,
            requiereApoyoAdicional: true,
            riesgosActivos: {
              riesgoElectrico: false,
              riesgoEstructural: false,
              riesgoQuimicoSanitario: false,
              aislamientoVial: false,
            },
            detallesAdicionales: null,
            accionesRealizadas: null,
            danosEstimados: null,
          },
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/incidentes/${incidenteId}/prioridad/calcular`,
        {
          method: "POST",
          body: JSON.stringify({
            nucleoFamiliarTotal: 4,
            cantidadNinos: 2,
            personasDiscapacitadas: 1,
            mascotasAfectadas: 1,
            nivelCompromisoVivienda: "MODERADO",
          }),
        }
      );

      const res = await POST_CALCULAR(req, {
        params: Promise.resolve({ id: incidenteId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.prioridadSugerida).toBe("ALTA");
      expect(json.data.puntajeTotal).toBe(45);
    });
  });
});

