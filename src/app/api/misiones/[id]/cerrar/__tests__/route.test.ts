import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import * as misionService from "@/modules/misiones/mision.service";
import { PERMISO_EJECUTAR_MISION_TERRENO } from "@/modules/seguridad/permisos.constants";
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
  cerrarMisionCuadrillaService: vi.fn(),
}));

describe("Route Handler POST /api/misiones/[id]/cerrar (HU-68)", () => {
  const misionId = "70000000-0000-4000-8000-000000000001";
  const delegadoUserId = "d0000000-0000-4000-8000-000000000001";
  const recursoId = "b0000000-0000-4000-8000-000000000010";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 si falta autenticación válida", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/cerrar`,
      {
        method: "POST",
        body: JSON.stringify({
          resumen_faenas: "Despeje integral de sumidero obstruido en avenida principal.",
          horas_hombre: 4,
          estado_terreno: "CONTROLADO",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el usuario carece del permiso RBAC misiones:terreno:ejecutar", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError(`No cuenta con el permiso requerido: ${PERMISO_EJECUTAR_MISION_TERRENO}`)
    );

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/cerrar`,
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          resumen_faenas: "Despeje integral de sumidero obstruido en avenida principal.",
          horas_hombre: 4,
          estado_terreno: "CONTROLADO",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("misiones:terreno:ejecutar");
    expect(authService.verificarPermiso).toHaveBeenCalledWith(
      delegadoUserId,
      PERMISO_EJECUTAR_MISION_TERRENO
    );
  });

  it("debe retornar 400 si el parámetro id no es UUID, el JSON es inválido o fallan las validaciones Zod", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: delegadoUserId,
      nombre: "Carlos Gómez",
      rol: "DELEGADO_CUADRILLA",
    });

    const reqIdInvalido = new NextRequest(
      "http://localhost:3000/api/misiones/no-es-uuid/cerrar",
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({}),
      }
    );
    const resId = await POST(reqIdInvalido, {
      params: Promise.resolve({ id: "no-es-uuid" }),
    });
    expect(resId.status).toBe(400);

    const reqJsonMal = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/cerrar`,
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: "{json-invalido",
      }
    );
    const resJson = await POST(reqJsonMal, {
      params: Promise.resolve({ id: misionId }),
    });
    expect(resJson.status).toBe(400);

    const reqZodMal = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/cerrar`,
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          resumen_faenas: "Corto",
          horas_hombre: -1,
          estado_terreno: "INVALIDO",
        }),
      }
    );
    const resZod = await POST(reqZodMal, {
      params: Promise.resolve({ id: misionId }),
    });
    expect(resZod.status).toBe(400);
    const jsonZod = await resZod.json();
    expect(jsonZod.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("debe mapear NotFoundError (404), ConflictError (409), BadRequestError (400) y errores inesperados (500)", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: delegadoUserId,
      nombre: "Carlos Gómez",
      rol: "DELEGADO_CUADRILLA",
    });

    const construirReq = () =>
      new NextRequest(`http://localhost:3000/api/misiones/${misionId}/cerrar`, {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          resumen_faenas: "Despeje integral de sumidero obstruido en avenida principal.",
          horas_hombre: 5,
          estado_terreno: "CONTROLADO",
        }),
      });

    vi.mocked(misionService.cerrarMisionCuadrillaService).mockRejectedValueOnce(
      new NotFoundError("Misión no encontrada.")
    );
    expect(
      (await POST(construirReq(), { params: Promise.resolve({ id: misionId }) })).status
    ).toBe(404);

    vi.mocked(misionService.cerrarMisionCuadrillaService).mockRejectedValueOnce(
      new ConflictError("La misión no está EN_CURSO.")
    );
    expect(
      (await POST(construirReq(), { params: Promise.resolve({ id: misionId }) })).status
    ).toBe(409);

    vi.mocked(misionService.cerrarMisionCuadrillaService).mockRejectedValueOnce(
      new BadRequestError("No es posible descontar un vehículo individual.")
    );
    expect(
      (await POST(construirReq(), { params: Promise.resolve({ id: misionId }) })).status
    ).toBe(400);

    vi.mocked(misionService.cerrarMisionCuadrillaService).mockRejectedValueOnce(
      new Error("Fallo de conexión PG")
    );
    expect(
      (await POST(construirReq(), { params: Promise.resolve({ id: misionId }) })).status
    ).toBe(500);
  });

  it("debe retornar 201 Created al cerrar misión sin insumos consumidos", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: delegadoUserId,
      nombre: "Carlos Gómez",
      rol: "DELEGADO_CUADRILLA",
    });

    vi.mocked(misionService.cerrarMisionCuadrillaService).mockResolvedValueOnce({
      message:
        "Informe técnico final registrado, misión cerrada y cuadrilla disponible exitosamente.",
      data: {
        reporteTerreno: {
          id: "rep-001",
          misionId,
          tipoReporte: "REPORTE_CUADRILLA",
          dictamen: null,
          motivoNoAbordable: null,
          requiereAsistenciaSocial: false,
          versionReporte: 1,
          esRectificacion: false,
          etiquetaReporte: "Informe Técnico Final de Cuadrilla (Cierre de Misión)",
          prioridadSugerida: "ALTA",
          prioridadAsignada: "ALTA",
          justificacionPrioridad: null,
          detallesEvaluacion: {},
          evaluador: {
            id: delegadoUserId,
            nombre: "Carlos Gómez",
            email: "carlos@valdivia.cl",
            rut: null,
          },
          resumenTecnico:
            "Despeje completo de ramas sobre calzada y limpieza de cunetas.",
          accionesRealizadas:
            "Despeje completo de ramas sobre calzada y limpieza de cunetas.",
          requiereApoyoAdicional: false,
          danosEstimados: null,
          observaciones: null,
          personasAfectadas: 0,
          estadoTerreno: "CONTROLADO",
          horasHombre: 4,
          materialesConsumidos: [],
          adjuntos: [],
          creadoEn: "2026-11-18T19:00:00.000Z",
          actualizadoEn: "2026-11-18T19:00:00.000Z",
        },
        mision: {
          id: misionId,
          codigo: "MIS-2026-0005",
          titulo: "Despeje Las Ánimas",
          tipoMision: "ATENCION_CUADRILLA",
          estado: "COMPLETADA",
          prioridad: "ALTA",
          incidenteId: "30000000-0000-4000-8000-000000000001",
          cuadrillaId: "50000000-0000-4000-8000-000000000001",
          fechaInicio: "2026-11-18T15:00:00.000Z",
          fechaCierre: "2026-11-18T19:00:00.000Z",
          actualizadoEn: "2026-11-18T19:00:00.000Z",
        },
        cuadrilla: {
          id: "50000000-0000-4000-8000-000000000001",
          nombre: "Cuadrilla Vías 1",
          estado: "DISPONIBLE",
          delegacionId: null,
        },
        incidente: {
          id: "30000000-0000-4000-8000-000000000001",
          codigo: "INC-2026-0042",
          estado: "EN_ATENCION",
          prioridad: "ALTA",
          requiereAsistenciaSocial: false,
        },
        recursosActualizados: [],
        hito: {
          id: "hito-001",
          misionId,
          hito: "MISION_COMPLETADA",
          descripcion: "Cierre de misión.",
          registradoPorId: delegadoUserId,
          latitud: null,
          longitud: null,
          creadoEn: "2026-11-18T19:00:00.000Z",
        },
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/cerrar`,
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          resumen_faenas:
            "Despeje completo de ramas sobre calzada y limpieza de cunetas.",
          horas_hombre: 4,
          estado_terreno: "CONTROLADO",
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.mision.estado).toBe("COMPLETADA");
    expect(json.data.cuadrilla.estado).toBe("DISPONIBLE");
    expect(json.data.recursosActualizados).toEqual([]);
  });

  it("debe retornar 201 Created al cerrar misión con materiales consumidos y horas hombre decimales", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue(delegadoUserId);
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: delegadoUserId,
      nombre: "Carlos Gómez",
      rol: "DELEGADO_CUADRILLA",
    });

    vi.mocked(misionService.cerrarMisionCuadrillaService).mockResolvedValueOnce({
      message:
        "Informe técnico final registrado, misión cerrada y cuadrilla disponible exitosamente.",
      data: {
        reporteTerreno: {
          id: "rep-002",
          misionId,
          tipoReporte: "REPORTE_CUADRILLA",
          dictamen: null,
          motivoNoAbordable: null,
          requiereAsistenciaSocial: false,
          versionReporte: 1,
          esRectificacion: false,
          etiquetaReporte: "Informe Técnico Final de Cuadrilla (Cierre de Misión)",
          prioridadSugerida: "ALTA",
          prioridadAsignada: "ALTA",
          justificacionPrioridad: null,
          detallesEvaluacion: {},
          evaluador: {
            id: delegadoUserId,
            nombre: "Carlos Gómez",
            email: "carlos@valdivia.cl",
            rut: null,
          },
          resumenTecnico:
            "Construcción de pretil con sacos de arena y bombeo completo de agua.",
          accionesRealizadas:
            "Construcción de pretil con sacos de arena y bombeo completo de agua.",
          requiereApoyoAdicional: false,
          danosEstimados: null,
          observaciones: null,
          personasAfectadas: 0,
          estadoTerreno: "FINALIZADO",
          horasHombre: 7.5,
          materialesConsumidos: [
            {
              recursoId,
              nombre: "Sacos de arena 25kg",
              cantidad: 15,
              unidad: "sacos",
              stockAnterior: 100,
              stockPosterior: 85,
            },
          ],
          adjuntos: [],
          creadoEn: "2026-11-18T19:30:00.000Z",
          actualizadoEn: "2026-11-18T19:30:00.000Z",
        },
        mision: {
          id: misionId,
          codigo: "MIS-2026-0005",
          titulo: "Contención sector Collico",
          tipoMision: "ATENCION_CUADRILLA",
          estado: "COMPLETADA",
          prioridad: "ALTA",
          incidenteId: "30000000-0000-4000-8000-000000000001",
          cuadrillaId: "50000000-0000-4000-8000-000000000001",
          fechaInicio: "2026-11-18T12:00:00.000Z",
          fechaCierre: "2026-11-18T19:30:00.000Z",
          actualizadoEn: "2026-11-18T19:30:00.000Z",
        },
        cuadrilla: {
          id: "50000000-0000-4000-8000-000000000001",
          nombre: "Cuadrilla Vías 1",
          estado: "DISPONIBLE",
          delegacionId: null,
        },
        incidente: {
          id: "30000000-0000-4000-8000-000000000001",
          codigo: "INC-2026-0042",
          estado: "EN_ATENCION",
          prioridad: "ALTA",
          requiereAsistenciaSocial: false,
        },
        recursosActualizados: [
          {
            id: recursoId,
            nombre: "Sacos de arena 25kg",
            cantidadConsumida: 15,
            cantidadInventarioAnterior: 100,
            cantidadInventarioActual: 85,
            cantidadEnUsoActual: 15,
            estado: "DISPONIBLE",
          },
        ],
        hito: {
          id: "hito-002",
          misionId,
          hito: "MISION_COMPLETADA",
          descripcion: "Cierre de misión con insumos.",
          registradoPorId: delegadoUserId,
          latitud: null,
          longitud: null,
          creadoEn: "2026-11-18T19:30:00.000Z",
        },
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/misiones/${misionId}/cerrar`,
      {
        method: "POST",
        headers: { authorization: "Bearer token" },
        body: JSON.stringify({
          resumen_faenas:
            "Construcción de pretil con sacos de arena y bombeo completo de agua.",
          horas_hombre: 7.5,
          estado_terreno: "FINALIZADO",
          materiales_consumidos: [
            { recurso_id: recursoId, cantidad: 15, unidad: "sacos" },
          ],
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: misionId }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.recursosActualizados).toHaveLength(1);
    expect(json.data.recursosActualizados[0].cantidadInventarioActual).toBe(85);
    expect(json.data.reporteTerreno.horasHombre).toBe(7.5);
  });
});
