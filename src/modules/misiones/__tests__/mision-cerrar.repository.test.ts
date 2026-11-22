/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { cerrarMisionCuadrillaRepo } from "../mision.repository";
import { db } from "@/lib/db";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";

const mockTrx: any = {
  selectFrom: vi.fn(),
  leftJoin: vi.fn(),
  innerJoin: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
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
};

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
    selectFrom: vi.fn(),
  },
}));

describe("HU-68: mision.repository - cerrarMisionCuadrillaRepo", () => {
  const misionId = "70000000-0000-4000-8000-000000000001";
  const delegadoId = "d0000000-0000-4000-8000-000000000001";
  const otroUsuarioId = "d0000000-0000-4000-8000-000000000099";
  const cuadrillaId = "50000000-0000-4000-8000-000000000001";
  const incidenteId = "30000000-0000-4000-8000-000000000001";
  const delegacionId = "30000000-0000-4000-8000-000000000002";
  const recursoId1 = "b0000000-0000-4000-8000-000000000010";
  const adjuntoId1 = "f0000000-0000-4000-8000-000000000001";

  const baseInput = {
    resumenFaenas:
      "Despeje integral de alcantarilla y construcción de barrera de contención.",
    materialesConsumidos: [],
    horasHombre: 6.5,
    estadoTerreno: "CONTROLADO" as const,
    observaciones: "Sector estabilizado.",
    danosEstimados: "Sin daños estructurales.",
    requiereApoyoAdicional: false,
    requiereAsistenciaSocial: false,
    adjuntoIds: [],
    adjuntos: [],
  };

  const misionBaseEnCurso = {
    id: misionId,
    codigo: "MIS-2026-0005",
    titulo: "Atención táctica en sector Las Ánimas",
    tipo_mision: "ATENCION_CUADRILLA",
    estado: "EN_CURSO",
    prioridad: "ALTA",
    incidente_id: incidenteId,
    cuadrilla_id: cuadrillaId,
    fecha_inicio: new Date("2026-11-18T14:00:00.000Z"),
    cuadrilla_nombre: "Cuadrilla Vías y Canales 1",
    cuadrilla_estado: "EN_MISION",
    cuadrilla_activo: true,
    cuadrilla_eliminado_en: null,
    cuadrilla_delegacion_id: delegacionId,
    cuadrilla_delegado_id: delegadoId,
    incidente_codigo: "INC-2026-0042",
    incidente_estado: "EN_ATENCION",
    incidente_prioridad: "ALTA",
    incidente_prioridad_sugerida: "ALTA",
    incidente_justificacion_prioridad: null,
    incidente_requiere_asistencia_social: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrx.selectFrom.mockReturnValue(mockTrx);
    mockTrx.leftJoin.mockReturnValue(mockTrx);
    mockTrx.innerJoin.mockReturnValue(mockTrx);
    mockTrx.select.mockReturnValue(mockTrx);
    mockTrx.where.mockReturnValue(mockTrx);
    mockTrx.forUpdate.mockReturnValue(mockTrx);
    mockTrx.updateTable.mockReturnValue(mockTrx);
    mockTrx.set.mockReturnValue(mockTrx);
    mockTrx.returning.mockReturnValue(mockTrx);
    mockTrx.insertInto.mockReturnValue(mockTrx);
    mockTrx.values.mockReturnValue(mockTrx);
    mockTrx.returningAll.mockReturnValue(mockTrx);
    mockTrx.execute.mockResolvedValue([]);

    vi.mocked(db.transaction).mockReturnValue({
      execute: (cb: (trx: typeof mockTrx) => Promise<unknown>) => cb(mockTrx),
    } as any);
  });

  it("debe lanzar NotFoundError si la misión no existe", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce(undefined);

    await expect(
      cerrarMisionCuadrillaRepo(misionId, delegadoId, false, baseInput)
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar ConflictError si la misión no tiene cuadrilla asignada", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      ...misionBaseEnCurso,
      cuadrilla_id: null,
    });

    await expect(
      cerrarMisionCuadrillaRepo(misionId, delegadoId, false, baseInput)
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ForbiddenError si el usuario no pertenece a la cuadrilla (salvo admin)", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionBaseEnCurso)
      .mockResolvedValueOnce(undefined); // cuadrilla_personal sin coincidencia

    await expect(
      cerrarMisionCuadrillaRepo(misionId, otroUsuarioId, false, baseInput)
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe lanzar ConflictError si la misión está DESPACHADA o ya fue COMPLETADA", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      ...misionBaseEnCurso,
      estado: "DESPACHADA",
    });

    await expect(
      cerrarMisionCuadrillaRepo(misionId, delegadoId, false, baseInput)
    ).rejects.toThrow(ConflictError);

    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      ...misionBaseEnCurso,
      estado: "COMPLETADA",
    });

    await expect(
      cerrarMisionCuadrillaRepo(misionId, delegadoId, false, baseInput)
    ).rejects.toThrow(ConflictError);
  });

  it("debe cerrar exitosamente la misión sin materiales consumidos, liberar cuadrilla/dotación y mantener incidente abierto", async () => {
    const fechaCierre = new Date("2026-11-18T18:30:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionBaseEnCurso) // SELECT mision FOR UPDATE
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: misionBaseEnCurso.titulo,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        cuadrilla_id: cuadrillaId,
        fecha_inicio: misionBaseEnCurso.fecha_inicio,
        fecha_cierre: fechaCierre,
        actualizado_en: fechaCierre,
      }) // UPDATE mision returningAll
      .mockResolvedValueOnce(undefined) // SELECT otra mision activa
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
      }) // UPDATE cuadrilla returning
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0042",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiere_asistencia_social: false,
      }) // UPDATE incidente returning
      .mockResolvedValueOnce({
        nombre: "Carlos Gómez",
        email: "carlos.gomez@valdivia.cl",
        rut: "12345678-9",
      }); // SELECT usuario evaluador

    mockTrx.executeTakeFirstOrThrow
      .mockResolvedValueOnce({
        id: "rep-001",
        mision_id: misionId,
        resumen_tecnico: baseInput.resumenFaenas,
        acciones_realizadas: baseInput.resumenFaenas,
        requiere_apoyo_adicional: false,
        danos_estimados: baseInput.danosEstimados,
        observaciones: baseInput.observaciones,
        personas_afectadas: 0,
        estado_terreno: "CONTROLADO",
        horas_hombre: 6.5,
        creado_en: fechaCierre,
        actualizado_en: fechaCierre,
      }) // INSERT reporte_terreno
      .mockResolvedValueOnce({
        id: "hito-001",
        mision_id: misionId,
        hito: "MISION_COMPLETADA",
        descripcion: "Informe técnico final enviado por cuadrilla y misión cerrada.",
        registrado_por_id: delegadoId,
        latitud: null,
        longitud: null,
        creado_en: fechaCierre,
      }); // INSERT mision_hito

    const resultado = await cerrarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      false,
      baseInput
    );

    expect(resultado.mision.estado).toBe("COMPLETADA");
    expect(resultado.cuadrilla.estado).toBe("DISPONIBLE");
    expect(resultado.incidente?.estado).toBe("EN_ATENCION");
    expect(resultado.reporteTerreno.tipoReporte).toBe("REPORTE_CUADRILLA");
    expect(resultado.reporteTerreno.horasHombre).toBe(6.5);
    expect(resultado.reporteTerreno.materialesConsumidos).toEqual([]);
    expect(resultado.recursosActualizados).toEqual([]);
    expect(resultado.hito.hito).toBe("MISION_COMPLETADA");

    // Verificar liberación de dotación humana (usuario.estado_operativo = disponible)
    expect(mockTrx.updateTable).toHaveBeenCalledWith("usuario");
    expect(mockTrx.set).toHaveBeenCalledWith(
      expect.objectContaining({ estado_operativo: "disponible" })
    );
  });

  it("debe descontar parcialmente un insumo asignado a la cuadrilla, actualizar cuadrilla_recurso y vincular adjuntos HU-43", async () => {
    const fechaCierre = new Date("2026-11-18T19:00:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionBaseEnCurso) // SELECT mision FOR UPDATE
      .mockResolvedValueOnce({
        id: recursoId1,
        nombre: "Sacos de arena 25kg",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 100,
        cantidad_en_uso: 30,
        cantidad_minima: 20,
        detalles: { unidad: "sacos" },
      }) // SELECT recurso FOR UPDATE
      .mockResolvedValueOnce({
        id: "cr-001",
        cantidad_asignada: 30,
      }) // SELECT cuadrilla_recurso FOR UPDATE
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: misionBaseEnCurso.titulo,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        cuadrilla_id: cuadrillaId,
        fecha_inicio: misionBaseEnCurso.fecha_inicio,
        fecha_cierre: fechaCierre,
        actualizado_en: fechaCierre,
      }) // UPDATE mision
      .mockResolvedValueOnce(undefined) // otra mision activa
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
      }) // UPDATE cuadrilla
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0042",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiere_asistencia_social: true,
      }) // UPDATE incidente
      .mockResolvedValueOnce({
        nombre: "Carlos Gómez",
        email: "carlos.gomez@valdivia.cl",
        rut: "12345678-9",
      });

    // execute calls: update recurso, update cuadrilla_recurso, select reportesPrevios, update adjunto, liberarDotacion (2x), etc.
    mockTrx.execute
      .mockResolvedValueOnce([]) // UPDATE recurso
      .mockResolvedValueOnce([]) // UPDATE cuadrilla_recurso
      .mockResolvedValueOnce([]) // SELECT reportesPrevios
      .mockResolvedValueOnce([
        {
          id: adjuntoId1,
          nombre_archivo: "evidencia.webp",
          url: "/uploads/evidencia/evidencia.webp",
          tipo_mime: "image/webp",
          tamano_bytes: 51200,
          creado_en: fechaCierre,
        },
      ]); // UPDATE adjunto returningAll

    mockTrx.executeTakeFirstOrThrow
      .mockResolvedValueOnce({
        id: "rep-002",
        mision_id: misionId,
        resumen_tecnico: baseInput.resumenFaenas,
        acciones_realizadas: baseInput.resumenFaenas,
        requiere_apoyo_adicional: false,
        danos_estimados: null,
        observaciones: null,
        personas_afectadas: 0,
        estado_terreno: "CONTROLADO",
        horas_hombre: 8,
        creado_en: fechaCierre,
        actualizado_en: fechaCierre,
      })
      .mockResolvedValueOnce({
        id: "hito-002",
        mision_id: misionId,
        hito: "MISION_COMPLETADA",
        descripcion: "Informe técnico final enviado.",
        registrado_por_id: delegadoId,
        latitud: -39.819,
        longitud: -73.245,
        creado_en: fechaCierre,
      });

    const resultado = await cerrarMisionCuadrillaRepo(misionId, delegadoId, false, {
      ...baseInput,
      horasHombre: 8,
      requiereAsistenciaSocial: true,
      adjuntoIds: [adjuntoId1],
      materialesConsumidos: [{ recursoId: recursoId1, cantidad: 12 }],
    });

    expect(resultado.recursosActualizados).toEqual([
      {
        id: recursoId1,
        nombre: "Sacos de arena 25kg",
        cantidadConsumida: 12,
        cantidadInventarioAnterior: 100,
        cantidadInventarioActual: 88,
        cantidadEnUsoActual: 18,
        estado: "DISPONIBLE",
      },
    ]);
    expect(resultado.reporteTerreno.materialesConsumidos[0]).toMatchObject({
      recursoId: recursoId1,
      nombre: "Sacos de arena 25kg",
      cantidad: 12,
      unidad: "sacos",
      stockAnterior: 100,
      stockPosterior: 88,
    });
    expect(resultado.reporteTerreno.adjuntos).toHaveLength(1);
    expect(resultado.incidente?.requiereAsistenciaSocial).toBe(true);
    expect(mockTrx.set).toHaveBeenCalledWith({ cantidad_asignada: 18 });
  });

  it("debe desvincular cuadrilla_recurso (sin asignar cantidad_asignada=0) y calcular BAJO_STOCK al consumir el total asignado", async () => {
    const fechaCierre = new Date("2026-11-18T19:10:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        ...misionBaseEnCurso,
        incidente_id: null,
      })
      .mockResolvedValueOnce({
        id: recursoId1,
        nombre: "Sacos de arena 25kg",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 35,
        cantidad_en_uso: 20,
        cantidad_minima: 15,
        detalles: {},
      })
      .mockResolvedValueOnce({
        id: "cr-002",
        cantidad_asignada: 20,
      })
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: misionBaseEnCurso.titulo,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        incidente_id: null,
        cuadrilla_id: cuadrillaId,
        fecha_inicio: misionBaseEnCurso.fecha_inicio,
        fecha_cierre: fechaCierre,
        actualizado_en: fechaCierre,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
      })
      .mockResolvedValueOnce({
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rut: null,
      });

    mockTrx.executeTakeFirstOrThrow
      .mockResolvedValueOnce({
        id: "rep-003",
        mision_id: misionId,
        resumen_tecnico: baseInput.resumenFaenas,
        acciones_realizadas: baseInput.resumenFaenas,
        requiere_apoyo_adicional: false,
        danos_estimados: null,
        observaciones: null,
        personas_afectadas: 0,
        estado_terreno: "FINALIZADO",
        horas_hombre: 5,
        creado_en: fechaCierre,
        actualizado_en: fechaCierre,
      })
      .mockResolvedValueOnce({
        id: "hito-003",
        mision_id: misionId,
        hito: "MISION_COMPLETADA",
        descripcion: "Informe técnico final enviado.",
        registrado_por_id: delegadoId,
        latitud: null,
        longitud: null,
        creado_en: fechaCierre,
      });

    const resultado = await cerrarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      true,
      {
        ...baseInput,
        estadoTerreno: "FINALIZADO",
        materialesConsumidos: [{ recursoId: recursoId1, cantidad: 20 }],
      }
    );

    expect(resultado.incidente).toBeNull();
    expect(resultado.recursosActualizados[0]).toMatchObject({
      cantidadInventarioActual: 15,
      cantidadEnUsoActual: 0,
      estado: "BAJO_STOCK",
    });
    expect(mockTrx.set).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false })
    );
    expect(mockTrx.set).not.toHaveBeenCalledWith({ cantidad_asignada: 0 });
  });

  it("debe permitir consumo de insumo de bodega no preasignado protegiendo stock en uso por otras cuadrillas", async () => {
    const fechaCierre = new Date("2026-11-18T19:20:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionBaseEnCurso)
      .mockResolvedValueOnce({
        id: recursoId1,
        nombre: "Cal hidratada 25kg",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 30,
        cantidad_en_uso: 10, // reservado en otra cuadrilla
        cantidad_minima: 5,
        detalles: { unidad: "bolsas" },
      })
      .mockResolvedValueOnce(undefined) // sin fila en cuadrilla_recurso
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: misionBaseEnCurso.titulo,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        cuadrilla_id: cuadrillaId,
        fecha_inicio: misionBaseEnCurso.fecha_inicio,
        fecha_cierre: fechaCierre,
        actualizado_en: fechaCierre,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
      })
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0042",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiere_asistencia_social: false,
      })
      .mockResolvedValueOnce({
        nombre: "Carlos Gómez",
        email: "carlos@valdivia.cl",
        rut: null,
      });

    mockTrx.executeTakeFirstOrThrow
      .mockResolvedValueOnce({
        id: "rep-004",
        mision_id: misionId,
        resumen_tecnico: baseInput.resumenFaenas,
        acciones_realizadas: baseInput.resumenFaenas,
        requiere_apoyo_adicional: false,
        danos_estimados: null,
        observaciones: null,
        personas_afectadas: 0,
        estado_terreno: "CONTROLADO",
        horas_hombre: 4,
        creado_en: fechaCierre,
        actualizado_en: fechaCierre,
      })
      .mockResolvedValueOnce({
        id: "hito-004",
        mision_id: misionId,
        hito: "MISION_COMPLETADA",
        descripcion: "Cierre completo.",
        registrado_por_id: delegadoId,
        latitud: null,
        longitud: null,
        creado_en: fechaCierre,
      });

    const resultado = await cerrarMisionCuadrillaRepo(misionId, delegadoId, false, {
      ...baseInput,
      materialesConsumidos: [{ recursoId: recursoId1, cantidad: 15 }],
    });

    expect(resultado.recursosActualizados[0]).toMatchObject({
      cantidadInventarioActual: 15,
      cantidadEnUsoActual: 10,
      estado: "BAJO_STOCK",
    });
  });

  it("debe rechazar con BadRequestError si se intenta consumir un recurso individual y con ConflictError si el stock es insuficiente", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionBaseEnCurso)
      .mockResolvedValueOnce({
        id: recursoId1,
        nombre: "Camión Tolva Municipal",
        es_individual: true,
        estado: "ASIGNADO",
        cantidad_inventario: 1,
        cantidad_en_uso: 1,
        cantidad_minima: 0,
        detalles: {},
      });

    await expect(
      cerrarMisionCuadrillaRepo(misionId, delegadoId, false, {
        ...baseInput,
        materialesConsumidos: [{ recursoId: recursoId1, cantidad: 1 }],
      })
    ).rejects.toThrow(BadRequestError);

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionBaseEnCurso)
      .mockResolvedValueOnce({
        id: recursoId1,
        nombre: "Sacos de arena 25kg",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 15,
        cantidad_en_uso: 10,
        cantidad_minima: 5,
        detalles: {},
      })
      .mockResolvedValueOnce({ id: "cr-003", cantidad_asignada: 5 }); // disponible total = 5 + 5 = 10

    await expect(
      cerrarMisionCuadrillaRepo(misionId, delegadoId, false, {
        ...baseInput,
        materialesConsumidos: [{ recursoId: recursoId1, cantidad: 12 }],
      })
    ).rejects.toThrow(ConflictError);
  });

  it("debe mantener la cuadrilla EN_MISION si aún tiene otra misión activa concurrente", async () => {
    const fechaCierre = new Date("2026-11-18T19:30:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionBaseEnCurso)
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: misionBaseEnCurso.titulo,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        cuadrilla_id: cuadrillaId,
        fecha_inicio: misionBaseEnCurso.fecha_inicio,
        fecha_cierre: fechaCierre,
        actualizado_en: fechaCierre,
      })
      .mockResolvedValueOnce({ id: "otra-mision-id" }) // existe otra mision activa
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0042",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiere_asistencia_social: false,
      })
      .mockResolvedValueOnce({
        nombre: "Carlos Gómez",
        email: "carlos@valdivia.cl",
        rut: null,
      });

    mockTrx.executeTakeFirstOrThrow
      .mockResolvedValueOnce({
        id: "rep-005",
        mision_id: misionId,
        resumen_tecnico: baseInput.resumenFaenas,
        acciones_realizadas: baseInput.resumenFaenas,
        requiere_apoyo_adicional: false,
        danos_estimados: null,
        observaciones: null,
        personas_afectadas: 0,
        estado_terreno: "CONTROLADO",
        horas_hombre: 6.5,
        creado_en: fechaCierre,
        actualizado_en: fechaCierre,
      })
      .mockResolvedValueOnce({
        id: "hito-005",
        mision_id: misionId,
        hito: "MISION_COMPLETADA",
        descripcion: "Cierre completo.",
        registrado_por_id: delegadoId,
        latitud: null,
        longitud: null,
        creado_en: fechaCierre,
      });

    const resultado = await cerrarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      false,
      baseInput
    );

    expect(resultado.cuadrilla.estado).toBe("EN_MISION");
    expect(mockTrx.updateTable).not.toHaveBeenCalledWith("cuadrilla");
  });

  it("debe aceptar personasAfectadas o heredar personas_afectadas de reportes previos del incidente (HU-25 / H68)", async () => {
    const fechaCierre = new Date("2026-11-21T20:00:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionBaseEnCurso)
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: misionBaseEnCurso.titulo,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        cuadrilla_id: cuadrillaId,
        fecha_inicio: misionBaseEnCurso.fecha_inicio,
        fecha_cierre: fechaCierre,
        actualizado_en: fechaCierre,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
      })
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0042",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiere_asistencia_social: false,
      })
      .mockResolvedValueOnce({
        nombre: "Carlos Gómez",
        email: "carlos@valdivia.cl",
        rut: null,
      });

    // Reporte previo en el mismo incidente constató 5 personas afectadas
    mockTrx.execute.mockResolvedValueOnce([
      {
        id: "rep-previo-patrulla",
        mision_id: "mision-verif-previa",
        personas_afectadas: 5,
        detalles_evaluacion: null,
        creado_en: new Date("2026-11-21T16:00:00.000Z"),
      },
    ]);

    mockTrx.executeTakeFirstOrThrow
      .mockResolvedValueOnce({
        id: "rep-006",
        mision_id: misionId,
        resumen_tecnico: baseInput.resumenFaenas,
        acciones_realizadas: baseInput.resumenFaenas,
        requiere_apoyo_adicional: false,
        danos_estimados: null,
        observaciones: null,
        personas_afectadas: 5,
        estado_terreno: "FINALIZADO",
        horas_hombre: 6.5,
        creado_en: fechaCierre,
        actualizado_en: fechaCierre,
      })
      .mockResolvedValueOnce({
        id: "hito-006",
        mision_id: misionId,
        hito: "MISION_COMPLETADA",
        descripcion: "Cierre completo.",
        registrado_por_id: delegadoId,
        latitud: null,
        longitud: null,
        creado_en: fechaCierre,
      });

    const resultado = await cerrarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      false,
      baseInput
    );

    expect(resultado.reporteTerreno.personasAfectadas).toBe(5);
    expect(mockTrx.values).toHaveBeenCalledWith(
      expect.objectContaining({
        personas_afectadas: 5,
      })
    );
  });
});
