/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { asignarCuadrillaIncidenteRepo } from "../mision.repository";
import { db } from "@/lib/db";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/modules/seguridad/errors";

const mockTrx: any = {
  selectFrom: vi.fn(),
  leftJoin: vi.fn(),
  innerJoin: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  forUpdate: vi.fn(),
  updateTable: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
  insertInto: vi.fn(),
  values: vi.fn(),
  returningAll: vi.fn(),
  executeTakeFirst: vi.fn(),
  executeTakeFirstOrThrow: vi.fn(),
  execute: vi.fn(),
  executeQuery: vi.fn(),
  getExecutor: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
    selectFrom: vi.fn(),
  },
}));

describe("HU-44: mision.repository - asignarCuadrillaIncidenteRepo", () => {
  const usuarioId = "10000000-0000-4000-8000-000000000002";
  const incidenteId = "30000000-0000-4000-8000-000000000001";
  const cuadrillaId = "50000000-0000-4000-8000-000000000002";
  const delegacionId = "30000000-0000-4000-8000-000000000010";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";
  const recursoCamionetaId = "b0000000-0000-4000-8000-000000000001";
  const recursoSacosId = "b0000000-0000-4000-8000-000000000002";

  let lastTable = "";
  let insertPayloads: Array<{ table: string; payload: any }> = [];
  let updatePayloads: Array<{ table: string; payload: any }> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    lastTable = "";
    insertPayloads = [];
    updatePayloads = [];

    mockTrx.selectFrom.mockImplementation((table: string) => {
      lastTable = table;
      return mockTrx;
    });
    mockTrx.leftJoin.mockReturnValue(mockTrx);
    mockTrx.innerJoin.mockReturnValue(mockTrx);
    mockTrx.select.mockReturnValue(mockTrx);
    mockTrx.where.mockReturnValue(mockTrx);
    mockTrx.orderBy.mockReturnValue(mockTrx);
    mockTrx.limit.mockReturnValue(mockTrx);
    mockTrx.forUpdate.mockReturnValue(mockTrx);
    mockTrx.updateTable.mockImplementation((table: string) => {
      lastTable = table;
      return mockTrx;
    });
    mockTrx.set.mockImplementation((payload: any) => {
      updatePayloads.push({ table: lastTable, payload });
      return mockTrx;
    });
    mockTrx.returning.mockReturnValue(mockTrx);
    mockTrx.insertInto.mockImplementation((table: string) => {
      lastTable = table;
      return mockTrx;
    });
    mockTrx.values.mockImplementation((payload: any) => {
      insertPayloads.push({ table: lastTable, payload });
      return mockTrx;
    });
    mockTrx.returningAll.mockReturnValue(mockTrx);
    mockTrx.executeTakeFirst.mockReset();
    mockTrx.executeTakeFirstOrThrow.mockReset();
    mockTrx.execute.mockReset();
    mockTrx.execute.mockResolvedValue([]);
    mockTrx.executeQuery.mockResolvedValue({ rows: [] });
    mockTrx.getExecutor.mockReturnValue({
      transformQuery: (q: any) => q,
      compileQuery: (q: any) => q,
      executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
    });

    vi.mocked(db.transaction).mockReturnValue({
      execute: (cb: (trx: typeof mockTrx) => Promise<unknown>) => cb(mockTrx),
    } as any);
  });

  it("acepta incidente en EN_ATENCION, usa título fallback de apoyo, omite re-liberar patrulla COMPLETADA/DISPONIBLE y asigna recursosAdicionales", async () => {
    const ahora = new Date("2026-11-24T12:00:00.000Z");

    mockTrx.executeTakeFirst
      // 1. incidente
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        delegacion_id: delegacionId,
        tipo_afectacion: "Anegamiento",
      })
      // 2. cuadrilla
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Refuerzo Sur",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: "d0000000-0000-4000-8000-000000000002",
      })
      // 3. misionVerificacionActiva (ya COMPLETADA y patrulla DISPONIBLE)
      .mockResolvedValueOnce({
        mision_id: "60000000-0000-4000-8000-000000000001",
        mision_codigo: "MIS-2026-0001",
        mision_estado: "COMPLETADA",
        mision_prioridad: "ALTA",
        patrulla_id: patrullaId,
        patrulla_nombre: "Patrulla Costa 1",
        patrulla_estado: "DISPONIBLE",
      })
      // 5. ultimaMision
      .mockResolvedValueOnce({ codigo: "MIS-2026-0010" })
      // 7. cuadrillaActualizada
      .mockResolvedValueOnce({ id: cuadrillaId })
      // 7.2 recurso 1 (b000...0001 individual nuevo)
      .mockResolvedValueOnce({
        id: recursoCamionetaId,
        nombre: "Camioneta 4x4 Apoyo",
        es_individual: true,
        estado: "DISPONIBLE",
        cantidad_inventario: 1,
        cantidad_en_uso: 0,
        cantidad_minima: 0,
      })
      // 7.2 asignacionIndividualExistente
      .mockResolvedValueOnce(undefined)
      // 7.2 asignacionActual (no existente)
      .mockResolvedValueOnce(undefined)
      // 7.2 recurso 2 (b000...0002 grupal acumulable)
      .mockResolvedValueOnce({
        id: recursoSacosId,
        nombre: "Sacos de arena",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 100,
        cantidad_en_uso: 20,
        cantidad_minima: 10,
      })
      // 7.2 asignacionActual (existente en cuadrilla: 10 + 5 = 15)
      .mockResolvedValueOnce({
        id: "cr-existing",
        cantidad_asignada: 10,
      })
      // 8. incidenteActualizado
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
      });

    mockTrx.executeTakeFirstOrThrow
      // 6. nuevaMision
      .mockResolvedValueOnce({
        id: "70000000-0000-4000-8000-000000000011",
        codigo: "MIS-2026-0011",
        titulo: "Apoyo táctico - Incidente INC-2026-0001",
        descripcion: null,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "DESPACHADA",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        cuadrilla_id: cuadrillaId,
        encargado_id: usuarioId,
        creado_por_id: usuarioId,
        fecha_inicio: null,
        creado_en: ahora,
      })
      // 9. hitoCuadrillaRow
      .mockResolvedValueOnce({
        id: "80000000-0000-4000-8000-000000000011",
        mision_id: "70000000-0000-4000-8000-000000000011",
        hito: "CUADRILLA_DESPACHADA",
        descripcion: "Cuadrilla adicional despachada a terreno para apoyo táctico del incidente",
        creado_en: ahora,
      });

    mockTrx.execute.mockImplementation(async () => {
      if (lastTable === "mision") {
        return [
          {
            id: "70000000-0000-4000-8000-000000000005",
            tipo_mision: "ATENCION_CUADRILLA",
            estado: "EN_CURSO",
            cuadrilla_id: "50000000-0000-4000-8000-000000000001",
            creado_en: new Date("2026-11-24T10:00:00.000Z"),
          },
          {
            id: "70000000-0000-4000-8000-000000000011",
            tipo_mision: "ATENCION_CUADRILLA",
            estado: "DESPACHADA",
            cuadrilla_id: cuadrillaId,
            creado_en: ahora,
          },
        ];
      }
      if (lastTable === "reporte_terreno") {
        return [
          {
            id: "rep-apoyo",
            requiere_apoyo_adicional: true,
            requiere_cuadrilla_adicional: true,
            detalle_apoyo_requerido: "Falta segunda cuadrilla",
            creado_en: new Date("2026-11-24T11:00:00.000Z"),
          },
        ];
      }
      return [];
    });

    const resultado = await asignarCuadrillaIncidenteRepo(
      {
        tipoMision: "ATENCION_CUADRILLA",
        incidenteId,
        cuadrillaId,
        recursosAdicionales: [
          { recursoId: recursoCamionetaId, cantidad: 1 },
          { recursoId: recursoSacosId, cantidad: 5 },
        ],
      },
      usuarioId
    );

    expect(resultado.mision.titulo).toBe("Apoyo táctico - Incidente INC-2026-0001");
    expect(resultado.patrullaLiberada).toBeNull();
    expect(resultado.hitoPatrulla).toBeNull();
    expect(resultado.recursosAdicionalesAsignados).toEqual([
      {
        id: recursoCamionetaId,
        nombre: "Camioneta 4x4 Apoyo",
        cantidadAsignada: 1,
        cantidadEnUsoActual: 1,
        estado: "ASIGNADO",
      },
      {
        id: recursoSacosId,
        nombre: "Sacos de arena",
        cantidadAsignada: 15,
        cantidadEnUsoActual: 25,
        estado: "DISPONIBLE",
      },
    ]);
    expect(
      insertPayloads.some(
        (p) =>
          p.table === "cuadrilla_recurso" &&
          p.payload.recurso_id === recursoCamionetaId &&
          p.payload.activo === true &&
          p.payload.desvinculado_en === null
      )
    ).toBe(true);
    expect(
      updatePayloads.some(
        (p) => p.table === "cuadrilla_recurso" && p.payload.cantidad_asignada === 15
      )
    ).toBe(true);
    expect(resultado.estadoOperativoIncidente).toEqual({
      cuadrillaAceptada: true,
      tieneMisionEnCurso: true,
      faenasCuadrillaCompletadas: false,
      apoyoSolicitado: false,
      requiereCuadrillaAdicional: false,
      detalleApoyoRequerido: null,
    });
  });

  it("rechaza recursos adicionales duplicados con BadRequestError", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        delegacion_id: delegacionId,
        tipo_afectacion: "Anegamiento",
      })
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Refuerzo Sur",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: null,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: cuadrillaId });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "70000000-0000-4000-8000-000000000011",
      codigo: "MIS-2026-0001",
      titulo: "Apoyo",
      descripcion: null,
      tipo_mision: "ATENCION_CUADRILLA",
      estado: "DESPACHADA",
      prioridad: "ALTA",
      incidente_id: incidenteId,
      cuadrilla_id: cuadrillaId,
      encargado_id: usuarioId,
      creado_por_id: usuarioId,
      fecha_inicio: null,
      creado_en: new Date(),
    });

    await expect(
      asignarCuadrillaIncidenteRepo(
        {
          tipoMision: "ATENCION_CUADRILLA",
          incidenteId,
          cuadrillaId,
          recursosAdicionales: [
            { recursoId: recursoSacosId, cantidad: 2 },
            { recursoId: recursoSacosId, cantidad: 3 },
          ],
        },
        usuarioId
      )
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("rechaza recurso en EN_MANTENCION o con stock insuficiente con ConflictError", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        delegacion_id: delegacionId,
        tipo_afectacion: "Anegamiento",
      })
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Refuerzo Sur",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: null,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: cuadrillaId })
      .mockResolvedValueOnce({
        id: recursoCamionetaId,
        nombre: "Camioneta",
        es_individual: true,
        estado: "EN_MANTENCION",
        cantidad_inventario: 1,
        cantidad_en_uso: 0,
        cantidad_minima: 0,
      });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "70000000-0000-4000-8000-000000000011",
      codigo: "MIS-2026-0001",
      titulo: "Apoyo",
      descripcion: null,
      tipo_mision: "ATENCION_CUADRILLA",
      estado: "DESPACHADA",
      prioridad: "ALTA",
      incidente_id: incidenteId,
      cuadrilla_id: cuadrillaId,
      encargado_id: usuarioId,
      creado_por_id: usuarioId,
      fecha_inicio: null,
      creado_en: new Date(),
    });

    await expect(
      asignarCuadrillaIncidenteRepo(
        {
          tipoMision: "ATENCION_CUADRILLA",
          incidenteId,
          cuadrillaId,
          recursosAdicionales: [{ recursoId: recursoCamionetaId, cantidad: 1 }],
        },
        usuarioId
      )
    ).rejects.toBeInstanceOf(ConflictError);

    // Ahora stock insuficiente
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        delegacion_id: delegacionId,
        tipo_afectacion: "Anegamiento",
      })
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Refuerzo Sur",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: null,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: cuadrillaId })
      .mockResolvedValueOnce({
        id: recursoSacosId,
        nombre: "Sacos",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 10,
        cantidad_en_uso: 8,
        cantidad_minima: 0,
      });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "70000000-0000-4000-8000-000000000012",
      codigo: "MIS-2026-0002",
      titulo: "Apoyo",
      descripcion: null,
      tipo_mision: "ATENCION_CUADRILLA",
      estado: "DESPACHADA",
      prioridad: "ALTA",
      incidente_id: incidenteId,
      cuadrilla_id: cuadrillaId,
      encargado_id: usuarioId,
      creado_por_id: usuarioId,
      fecha_inicio: null,
      creado_en: new Date(),
    });

    await expect(
      asignarCuadrillaIncidenteRepo(
        {
          tipoMision: "ATENCION_CUADRILLA",
          incidenteId,
          cuadrillaId,
          recursosAdicionales: [{ recursoId: recursoSacosId, cantidad: 5 }],
        },
        usuarioId
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rechaza recurso individual ya asignado a otra cuadrilla y recurso inexistente", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        delegacion_id: delegacionId,
        tipo_afectacion: "Anegamiento",
      })
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Refuerzo Sur",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: null,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: cuadrillaId })
      .mockResolvedValueOnce({
        id: recursoCamionetaId,
        nombre: "Camioneta 4x4",
        es_individual: true,
        estado: "DISPONIBLE",
        cantidad_inventario: 1,
        cantidad_en_uso: 0,
        cantidad_minima: 0,
      })
      .mockResolvedValueOnce({
        cuadrilla_id: "50000000-0000-4000-8000-000000000099",
        cuadrilla_nombre: "Cuadrilla Norte",
      });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "70000000-0000-4000-8000-000000000013",
      codigo: "MIS-2026-0003",
      titulo: "Apoyo",
      descripcion: null,
      tipo_mision: "ATENCION_CUADRILLA",
      estado: "DESPACHADA",
      prioridad: "ALTA",
      incidente_id: incidenteId,
      cuadrilla_id: cuadrillaId,
      encargado_id: usuarioId,
      creado_por_id: usuarioId,
      fecha_inicio: null,
      creado_en: new Date(),
    });

    await expect(
      asignarCuadrillaIncidenteRepo(
        {
          tipoMision: "ATENCION_CUADRILLA",
          incidenteId,
          cuadrillaId,
          recursosAdicionales: [{ recursoId: recursoCamionetaId, cantidad: 1 }],
        },
        usuarioId
      )
    ).rejects.toBeInstanceOf(ConflictError);

    // Recurso inexistente -> NotFoundError
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        delegacion_id: delegacionId,
        tipo_afectacion: "Anegamiento",
      })
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Refuerzo Sur",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: null,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: cuadrillaId })
      .mockResolvedValueOnce(undefined);

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "70000000-0000-4000-8000-000000000014",
      codigo: "MIS-2026-0004",
      titulo: "Apoyo",
      descripcion: null,
      tipo_mision: "ATENCION_CUADRILLA",
      estado: "DESPACHADA",
      prioridad: "ALTA",
      incidente_id: incidenteId,
      cuadrilla_id: cuadrillaId,
      encargado_id: usuarioId,
      creado_por_id: usuarioId,
      fecha_inicio: null,
      creado_en: new Date(),
    });

    await expect(
      asignarCuadrillaIncidenteRepo(
        {
          tipoMision: "ATENCION_CUADRILLA",
          incidenteId,
          cuadrillaId,
          recursosAdicionales: [{ recursoId: recursoCamionetaId, cantidad: 1 }],
        },
        usuarioId
      )
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
