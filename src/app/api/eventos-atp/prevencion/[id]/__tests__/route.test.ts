/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";
import * as eventoPrevencionService from "@/modules/eventos-atp/evento-prevencion.service";
import * as repo from "@/modules/eventos-atp/evento-prevencion.repository";
import * as authGuard from "@/modules/seguridad/auth.guard";
import { seguridadService } from "@/modules/seguridad/service";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/modules/seguridad/errors";
import {
  editarEventoPrevencionService,
  EventoPrevencionNoEditableError,
  NotFoundError,
  StockInsuficienteError,
} from "@/modules/eventos-atp/evento-prevencion.service";
import {
  PERMISO_ASIGNAR_MISION,
  PERMISO_CREAR_EVENTO_PREVENCION,
  PERMISO_LEER_EVENTOS_PREVENCION,
  PERMISO_LEER_MISION,
} from "@/modules/seguridad/permisos.constants";
import { db } from "@/lib/db";
import * as socketModule from "@/lib/socket";

const EVENTO_ID = "80000000-0000-4000-8000-000000000001";
const USUARIO_ID = "00000000-0000-4000-8000-000000000002";
const RECURSO_A_ID = "00000000-0000-4000-8000-000000000011";
const RECURSO_B_ID = "00000000-0000-4000-8000-000000000012";

describe("Route Handler PATCH /api/eventos-atp/prevencion/[id] (H77)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const payloadValido = {
    nombre: "Limpieza prioritaria de colectores en Angachilla",
    descripcion: "Despeje urgente de rejillas y refuerzo con sacos de arena.",
    prioridad: "CRITICA",
    fechaEstimadaFin: "2026-11-26T20:00:00.000Z",
    recursos: [
      {
        recursoId: RECURSO_A_ID,
        cantidad: 10,
      },
    ],
  };

  it("debe retornar 401 si el usuario no está autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Token de sesión inválido o expirado.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      {
        method: "PATCH",
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el usuario no tiene el permiso prevencion:eventos:crear", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(USUARIO_ID);
    const validarSpy = vi
      .spyOn(seguridadService, "validarAccesoRoles")
      .mockRejectedValueOnce(new ForbiddenError("Acceso denegado."));

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res.status).toBe(403);
    expect(validarSpy).toHaveBeenCalledWith(USUARIO_ID, [
      PERMISO_CREAR_EVENTO_PREVENCION,
    ]);
  });

  it("debe retornar 400 si el parámetro id no es un UUID válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(USUARIO_ID);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);

    const req = new NextRequest(
      "http://localhost:3000/api/eventos-atp/prevencion/id-invalido",
      {
        method: "PATCH",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "id-invalido" }),
    });
    expect(res.status).toBe(400);
  });

  it("debe retornar 400 si el body no es JSON válido o está vacío", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(USUARIO_ID);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValue({} as any);

    const reqJsonInvalido = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer valid-token" },
        body: "{invalido",
      }
    );
    const res1 = await PATCH(reqJsonInvalido, {
      params: Promise.resolve({ id: EVENTO_ID }),
    });
    expect(res1.status).toBe(400);

    const reqVacio = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify({}),
      }
    );
    const res2 = await PATCH(reqVacio, {
      params: Promise.resolve({ id: EVENTO_ID }),
    });
    expect(res2.status).toBe(400);
  });

  it("debe retornar 404 si el evento de prevención no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(USUARIO_ID);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);
    vi.spyOn(
      eventoPrevencionService,
      "editarEventoPrevencionService"
    ).mockRejectedValueOnce(
      new NotFoundError("El evento de prevención indicado no fue encontrado.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res.status).toBe(404);
  });

  it("debe retornar 409 si el evento está en estado COMPLETADA, CANCELADA o sin stock", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(USUARIO_ID);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValue({} as any);

    vi.spyOn(
      eventoPrevencionService,
      "editarEventoPrevencionService"
    ).mockRejectedValueOnce(
      new EventoPrevencionNoEditableError(
        "No es posible editar el evento de prevención en estado COMPLETADA."
      )
    );

    const req1 = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );
    const res1 = await PATCH(req1, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res1.status).toBe(409);

    vi.spyOn(
      eventoPrevencionService,
      "editarEventoPrevencionService"
    ).mockRejectedValueOnce(new StockInsuficienteError("Stock insuficiente."));

    const req2 = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );
    const res2 = await PATCH(req2, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res2.status).toBe(409);
  });

  it("debe retornar 200 al actualizar correctamente un evento de prevención activo", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(USUARIO_ID);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);

    const mockRespuesta = {
      id: EVENTO_ID,
      codigo: "PREV-2026-0001",
      nombre: payloadValido.nombre,
      descripcion: payloadValido.descripcion,
      sector: "Humedal Angachilla",
      direccionTexto: "Pasaje Los Robles s/n",
      prioridad: "CRITICA" as const,
      estado: "EN_CURSO" as const,
      latitud: -39.8456,
      longitud: -73.2389,
      puntoCritico: null,
      delegacion: {
        id: "30000000-0000-4000-8000-000000000001",
        codigo: "DEL_SUR",
        nombre: "Delegación Sur",
      },
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0045",
        titulo: payloadValido.nombre,
        estado: "DESPACHADA",
        tipoMision: "PREVENCION",
      },
      patrulla: {
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Alfa",
        estado: "EN_PREVENCION",
      },
      recursos: [
        {
          recursoId: RECURSO_A_ID,
          nombre: "Sacos de Arena 25kg",
          cantidadAsignada: 10,
        },
      ],
      fechaEstimadaFin: payloadValido.fechaEstimadaFin,
      creadoPorId: USUARIO_ID,
      actualizadoPorId: USUARIO_ID,
      creadoEn: "2026-11-19T12:00:00.000Z",
      actualizadoEn: "2026-11-19T17:00:00.000Z",
    };

    const serviceSpy = vi
      .spyOn(eventoPrevencionService, "editarEventoPrevencionService")
      .mockResolvedValueOnce(mockRespuesta);

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      {
        method: "PATCH",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await PATCH(req, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.actualizadoPorId).toBe(USUARIO_ID);
    expect(body.data.fechaEstimadaFin).toBe(payloadValido.fechaEstimadaFin);
    expect(serviceSpy).toHaveBeenCalledWith(EVENTO_ID, payloadValido, USUARIO_ID);
  });
});

describe("Servicio editarEventoPrevencionService — Restricciones de estado y auditoría (H77)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db, "transaction").mockImplementation(
      () =>
        ({
          execute: async (cb: (trx: any) => Promise<any>) => cb({}),
        }) as any
    );
  });

  const eventoBase = {
    id: EVENTO_ID,
    codigo: "PREV-2026-0001",
    nombre: "Limpieza de colectores",
    descripcion: "Tareas iniciales",
    prioridad: "MEDIA" as const,
    estado: "PLANIFICADA",
    sector: "Angachilla",
    direccion_texto: "Los Robles s/n",
    punto_critico_id: null,
    delegacion_id: "30000000-0000-4000-8000-000000000001",
    latitud: -39.84,
    longitud: -73.23,
    fecha_estimada_fin: null,
    activo: true,
    eliminado_en: null,
    creado_por_id: USUARIO_ID,
    actualizado_por_id: null,
    creado_en: new Date("2026-11-19T10:00:00.000Z"),
    actualizado_en: new Date("2026-11-19T10:00:00.000Z"),
  };

  it("debe bloquear con EventoPrevencionNoEditableError si el estado es COMPLETADA", async () => {
    vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce({
      ...eventoBase,
      estado: "COMPLETADA",
    } as any);

    await expect(
      editarEventoPrevencionService(
        EVENTO_ID,
        { descripcion: "Nueva descripción válida" },
        USUARIO_ID
      )
    ).rejects.toThrow(EventoPrevencionNoEditableError);
  });

  it("debe bloquear con EventoPrevencionNoEditableError si el estado es CANCELADA", async () => {
    vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce({
      ...eventoBase,
      estado: "CANCELADA",
    } as any);

    await expect(
      editarEventoPrevencionService(
        EVENTO_ID,
        { descripcion: "Nueva descripción válida" },
        USUARIO_ID
      )
    ).rejects.toThrow(EventoPrevencionNoEditableError);
  });

  it("debe bloquear con EventoPrevencionNoEditableError si el evento está inactivo (activo = false)", async () => {
    vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce({
      ...eventoBase,
      activo: false,
    } as any);

    await expect(
      editarEventoPrevencionService(
        EVENTO_ID,
        { descripcion: "Nueva descripción válida" },
        USUARIO_ID
      )
    ).rejects.toThrow(EventoPrevencionNoEditableError);
  });

  it("debe permitir editar en EN_CURSO, registrar auditoría, ajustar stock por delta y emitir Socket.io", async () => {
    vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce({
      ...eventoBase,
      estado: "EN_CURSO",
    } as any);

    vi.spyOn(repo, "listarRecursosAsignadosPrevencion").mockResolvedValueOnce([
      { recursoId: RECURSO_A_ID, nombre: "Sacos de Arena", cantidadAsignada: 5 },
      { recursoId: RECURSO_B_ID, nombre: "Motobomba", cantidadAsignada: 2 },
    ]);

    vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
      {
        id: RECURSO_A_ID,
        nombre: "Sacos de Arena",
        cantidad_inventario: 20,
        cantidad_en_uso: 0,
        cantidad_minima: 0,
        estado: "DISPONIBLE",
        es_individual: false,
        eliminado_en: null,
      },
      {
        id: RECURSO_B_ID,
        nombre: "Motobomba",
        cantidad_inventario: 5,
        cantidad_en_uso: 0,
        cantidad_minima: 0,
        estado: "DISPONIBLE",
        es_individual: false,
        eliminado_en: null,
      },
    ]);

    const devolverSpy = vi.spyOn(repo, "devolverStockRecurso").mockResolvedValue([] as any);
    const descontarSpy = vi.spyOn(repo, "descontarStockRecurso").mockResolvedValue([] as any);
    vi.spyOn(repo, "eliminarRecursosPrevencion").mockResolvedValue([] as any);
    vi.spyOn(repo, "insertarRecursosPrevencion").mockResolvedValue([] as any);

    const actualizarSpy = vi.spyOn(repo, "actualizarEventoPrevencion").mockResolvedValueOnce({
      ...eventoBase,
      estado: "EN_CURSO",
      descripcion: "Descripción actualizada por alerta",
      prioridad: "CRITICA",
      fecha_estimada_fin: new Date("2026-11-26T20:00:00.000Z"),
      actualizado_por_id: USUARIO_ID,
      actualizado_en: new Date("2026-11-19T17:00:00.000Z"),
    } as any);

    const syncMisionSpy = vi.spyOn(repo, "sincronizarMisionPrevencion").mockResolvedValueOnce();
    vi.spyOn(repo, "buscarDelegacionPorId").mockResolvedValueOnce({
      id: eventoBase.delegacion_id,
      codigo: "DEL_SUR",
      nombre: "Delegación Sur",
    } as any);
    vi.spyOn(repo, "obtenerMisionYPatrullaDeEventoPrevencion").mockResolvedValueOnce({
      m_id: "60000000-0000-4000-8000-000000000001",
      m_codigo: "MIS-2026-0045",
      m_titulo: "Limpieza de colectores",
      m_estado: "DESPACHADA",
      m_tipo_mision: "PREVENCION",
      pv_id: "50000000-0000-4000-8000-000000000001",
      pv_nombre: "Patrulla Alfa",
      pv_estado: "EN_PREVENCION",
    });

    const socketSpy = vi
      .spyOn(socketModule, "emitirEventoPrevencionActualizado")
      .mockImplementation(() => {});

    // RECURSO_A pasa de 5 -> 8 (delta +3, descuenta 3); RECURSO_B se quita (devuelve 2)
    const resultado = await editarEventoPrevencionService(
      EVENTO_ID,
      {
        descripcion: "Descripción actualizada por alerta",
        prioridad: "CRITICA",
        fechaEstimadaFin: "2026-11-26T20:00:00.000Z",
        recursos: [{ recursoId: RECURSO_A_ID, cantidad: 8 }],
      },
      USUARIO_ID
    );

    expect(devolverSpy).toHaveBeenCalledWith(expect.anything(), RECURSO_B_ID, 2);
    expect(descontarSpy).toHaveBeenCalledWith(expect.anything(), RECURSO_A_ID, 3);
    expect(actualizarSpy).toHaveBeenCalledWith(
      expect.anything(),
      EVENTO_ID,
      expect.objectContaining({
        actualizadoPorId: USUARIO_ID,
        prioridad: "CRITICA",
      })
    );
    expect(syncMisionSpy).toHaveBeenCalledWith(
      expect.anything(),
      EVENTO_ID,
      expect.objectContaining({
        descripcion: "Descripción actualizada por alerta",
        prioridad: "CRITICA",
      })
    );
    expect(socketSpy).toHaveBeenCalledTimes(1);
    expect(resultado.actualizadoPorId).toBe(USUARIO_ID);
    expect(resultado.recursos).toHaveLength(1);
    expect(resultado.recursos[0].cantidadAsignada).toBe(8);
  });
});

describe("Route Handler GET /api/eventos-atp/prevencion/[id] (HU-33)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe retornar 401 si el usuario no está autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Token de sesión inválido o expirado.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`
    );

    const res = await GET(req, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el usuario carece de permisos de lectura o asignación", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(USUARIO_ID);
    const validarSpy = vi
      .spyOn(seguridadService, "validarAccesoRoles")
      .mockRejectedValueOnce(new ForbiddenError("Acceso denegado."));

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      { headers: { authorization: "Bearer valid-token" } }
    );

    const res = await GET(req, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res.status).toBe(403);
    expect(validarSpy).toHaveBeenCalledWith(
      USUARIO_ID,
      [
        PERMISO_LEER_EVENTOS_PREVENCION,
        PERMISO_CREAR_EVENTO_PREVENCION,
        PERMISO_LEER_MISION,
        PERMISO_ASIGNAR_MISION,
      ],
      expect.any(String)
    );
  });

  it("debe retornar 400 si el parámetro id no es UUID válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(USUARIO_ID);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);

    const req = new NextRequest(
      "http://localhost:3000/api/eventos-atp/prevencion/id-invalido",
      { headers: { authorization: "Bearer valid-token" } }
    );

    const res = await GET(req, { params: Promise.resolve({ id: "id-invalido" }) });
    expect(res.status).toBe(400);
  });

  it("debe retornar 404 si el evento de prevención no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(USUARIO_ID);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);
    vi.spyOn(
      eventoPrevencionService,
      "obtenerDetalleEventoPrevencionService"
    ).mockRejectedValueOnce(new NotFoundError("El evento de prevención indicado no fue encontrado."));

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      { headers: { authorization: "Bearer valid-token" } }
    );

    const res = await GET(req, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res.status).toBe(404);
  });

  it("debe retornar 200 OK con el detalle integral del evento, misiones y recursos asignados", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(USUARIO_ID);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);

    const detalleMock = {
      id: EVENTO_ID,
      codigo: "PREV-2026-0001",
      nombre: "Limpieza preventiva de colectores",
      descripcion: "Despeje de rejillas",
      sector: "Angachilla",
      direccionTexto: "Pasaje Los Robles s/n",
      prioridad: "ALTA" as const,
      estado: "PLANIFICADA" as const,
      latitud: -39.8456,
      longitud: -73.2389,
      ubicacionGeoJson: { type: "Point", coordinates: [-73.2389, -39.8456] },
      puntoCritico: null,
      delegacion: {
        id: "30000000-0000-4000-8000-000000000001",
        codigo: "DEL_SUR",
        nombre: "Delegación Sur",
      },
      misiones: [
        {
          id: "60000000-0000-4000-8000-000000000099",
          codigo: "MIS-2026-0099",
          titulo: "Despacho preventivo",
          estado: "DESPACHADA",
          tipoMision: "PREVENCION",
          patrulla: {
            id: "50000000-0000-4000-8000-000000000001",
            nombre: "Patrulla Sur 1",
            estado: "EN_PREVENCION",
          },
          cuadrilla: null,
          fechaInicio: "2026-11-19T12:00:00.000Z",
          fechaCierre: null,
          creadoEn: "2026-11-19T12:00:00.000Z",
        },
      ],
      recursosAsignados: [
        {
          id: "90000000-0000-4000-8000-000000000001",
          recursoId: RECURSO_A_ID,
          nombre: "Sacos de Arena 25kg",
          esIndividual: false,
          cantidadAsignada: 10,
          misionId: "60000000-0000-4000-8000-000000000099",
          creadoEn: "2026-11-19T12:00:00.000Z",
        },
      ],
      fechaEstimadaFin: null,
      creadoPorId: USUARIO_ID,
      actualizadoPorId: null,
      creadoEn: "2026-11-19T10:00:00.000Z",
      actualizadoEn: "2026-11-19T12:00:00.000Z",
    };

    vi.spyOn(
      eventoPrevencionService,
      "obtenerDetalleEventoPrevencionService"
    ).mockResolvedValueOnce(detalleMock);

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      { headers: { authorization: "Bearer valid-token" } }
    );

    const res = await GET(req, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.codigo).toBe("PREV-2026-0001");
    expect(body.data.misiones).toHaveLength(1);
    expect(body.data.recursosAsignados).toHaveLength(1);
  });

  it("debe retornar 500 ante un error interno inesperado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(USUARIO_ID);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);
    vi.spyOn(
      eventoPrevencionService,
      "obtenerDetalleEventoPrevencionService"
    ).mockRejectedValueOnce(new Error("Fallo de base de datos"));

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${EVENTO_ID}`,
      { headers: { authorization: "Bearer valid-token" } }
    );

    const res = await GET(req, { params: Promise.resolve({ id: EVENTO_ID }) });
    expect(res.status).toBe(500);
  });
});
