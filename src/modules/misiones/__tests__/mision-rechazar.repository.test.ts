/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Kysely,
  DummyDriver,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import {
  rechazarMisionCuadrillaRepo,
  rechazarMisionPatrullaRepo,
  rechazarMisionRepo,
  liberarDotacionCuadrillaDeMision,
} from "../mision.repository";
import type { Database } from "@/lib/db/types";
import { db } from "@/lib/db";
import { NotFoundError, ConflictError, ForbiddenError } from "@/modules/seguridad/errors";
import {
  PERMISO_EJECUTAR_MISION_TERRENO,
  PERMISO_VERIFICAR_MISION_TERRENO,
} from "@/modules/seguridad/permisos.constants";

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

function resetMockTrx() {
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
}

describe("HU-41: mision.repository - rechazarMisionCuadrillaRepo", () => {
  const misionId = "70000000-0000-4000-8000-000000000001";
  const delegadoId = "d0000000-0000-4000-8000-000000000001";
  const cuadrillaId = "50000000-0000-4000-8000-000000000001";
  const incidenteId = "30000000-0000-4000-8000-000000000001";
  const delegacionId = "30000000-0000-4000-8000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTrx();
  });

  it("debe lanzar NotFoundError si la misión no existe", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce(undefined);

    await expect(
      rechazarMisionCuadrillaRepo(misionId, delegadoId, "Falla mecánica grave", false)
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar ConflictError si la misión no tiene cuadrilla asignada", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      id: misionId,
      codigo: "MIS-2026-0005",
      estado: "DESPACHADA",
      tipo_mision: "VERIFICACION",
      cuadrilla_id: null,
      incidente_id: incidenteId,
    });

    await expect(
      rechazarMisionCuadrillaRepo(misionId, delegadoId, "Falla mecánica grave", false)
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ForbiddenError si el usuario no es el delegado ni integrante de la cuadrilla (salvo admin)", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        cuadrilla_delegado_id: "otro-delegado-id",
        incidente_id: incidenteId,
      })
      .mockResolvedValueOnce(undefined);

    await expect(
      rechazarMisionCuadrillaRepo(misionId, delegadoId, "Falla mecánica grave", false)
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe lanzar ConflictError si la misión ya fue rechazada previamente", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      id: misionId,
      codigo: "MIS-2026-0005",
      estado: "RECHAZADA",
      tipo_mision: "ATENCION_CUADRILLA",
      cuadrilla_id: cuadrillaId,
      cuadrilla_delegado_id: delegadoId,
      incidente_id: incidenteId,
    });

    await expect(
      rechazarMisionCuadrillaRepo(misionId, delegadoId, "Falla mecánica grave", false)
    ).rejects.toThrow("La misión ya ha sido rechazada previamente.");
  });

  it("debe lanzar ConflictError si la misión no está en estado DESPACHADA", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      id: misionId,
      codigo: "MIS-2026-0005",
      estado: "EN_CURSO",
      tipo_mision: "ATENCION_CUADRILLA",
      cuadrilla_id: cuadrillaId,
      cuadrilla_delegado_id: delegadoId,
      incidente_id: incidenteId,
    });

    await expect(
      rechazarMisionCuadrillaRepo(misionId, delegadoId, "Falla mecánica grave", false)
    ).rejects.toThrow(ConflictError);
  });

  it("debe ejecutar transacción atómica devolviendo cuadrilla a DISPONIBLE e incidente a VERIFICANDO si hubo verificación previa", async () => {
    const ahora = new Date("2026-11-16T23:15:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: incidenteId,
        cuadrilla_nombre: "Cuadrilla Vías y Canales 1",
        cuadrilla_estado: "EN_MISION",
        cuadrilla_activo: true,
        cuadrilla_eliminado_en: null,
        cuadrilla_delegacion_id: delegacionId,
        cuadrilla_delegado_id: delegadoId,
        incidente_codigo: "INC-2026-0001",
        incidente_estado: "EN_ATENCION",
        incidente_prioridad: "ALTA",
      })
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "RECHAZADA",
        justificacion_rechazo: "Falla hidráulica en camión tolva",
        fecha_cierre: ahora,
        actualizado_en: ahora,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: delegadoId,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: "verif-mision-id" })
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "VERIFICANDO",
        prioridad: "ALTA",
      });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "80000000-0000-4000-8000-000000000099",
      mision_id: misionId,
      hito: "RECHAZADA",
      descripcion: "Misión rechazada por cuadrilla: Falla hidráulica en camión tolva",
      registrado_por_id: delegadoId,
      latitud: "-39.8142200",
      longitud: "-73.2458900",
      creado_en: ahora,
    });

    const resultado = await rechazarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      "Falla hidráulica en camión tolva",
      false,
      { latitud: -39.81422, longitud: -73.24589 }
    );

    expect(resultado.mision.estado).toBe("RECHAZADA");
    expect(resultado.mision.justificacionRechazo).toBe("Falla hidráulica en camión tolva");
    expect(resultado.cuadrilla.estado).toBe("DISPONIBLE");
    expect(resultado.incidente?.estado).toBe("VERIFICANDO");
    expect(resultado.hito.hito).toBe("RECHAZADA");
    expect(resultado.hito.descripcion).toContain("Falla hidráulica en camión tolva");
  });

  it("debe retornar el incidente a REPORTADO cuando no existía verificación previa completada", async () => {
    const ahora = new Date("2026-11-16T23:15:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: incidenteId,
        cuadrilla_nombre: "Cuadrilla Vías y Canales 1",
        cuadrilla_estado: "EN_MISION",
        cuadrilla_activo: true,
        cuadrilla_eliminado_en: null,
        cuadrilla_delegacion_id: delegacionId,
        cuadrilla_delegado_id: delegadoId,
        incidente_codigo: "INC-2026-0001",
        incidente_estado: "EN_ATENCION",
        incidente_prioridad: "MEDIA",
      })
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "RECHAZADA",
        justificacion_rechazo: "Corte de ruta por emergencia mayor",
        fecha_cierre: ahora,
        actualizado_en: ahora,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: delegadoId,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "REPORTADO",
        prioridad: "MEDIA",
      });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "80000000-0000-4000-8000-000000000099",
      mision_id: misionId,
      hito: "RECHAZADA",
      descripcion: "Misión rechazada por cuadrilla: Corte de ruta por emergencia mayor",
      registrado_por_id: delegadoId,
      latitud: null,
      longitud: null,
      creado_en: ahora,
    });

    const resultado = await rechazarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      "Corte de ruta por emergencia mayor",
      false
    );

    expect(resultado.incidente?.estado).toBe("REPORTADO");
    expect(resultado.cuadrilla.estado).toBe("DISPONIBLE");
  });

  it("debe permitir rechazo por ADMIN aunque no sea delegado ni integrante de la cuadrilla (BUG-H41-API-05)", async () => {
    const ahora = new Date("2026-11-16T23:15:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: null,
        cuadrilla_nombre: "Cuadrilla Norte",
        cuadrilla_estado: "EN_MISION",
        cuadrilla_activo: true,
        cuadrilla_eliminado_en: null,
        cuadrilla_delegacion_id: delegacionId,
        cuadrilla_delegado_id: "otro-delegado",
      })
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "RECHAZADA",
        justificacion_rechazo: "Rechazo administrativo por reasignación",
        fecha_cierre: ahora,
        actualizado_en: ahora,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Norte",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: "otro-delegado",
      });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "80000000-0000-4000-8000-000000000099",
      mision_id: misionId,
      hito: "RECHAZADA",
      descripcion: "Misión rechazada por cuadrilla: Rechazo administrativo por reasignación",
      registrado_por_id: "admin-user-id",
      latitud: null,
      longitud: null,
      creado_en: ahora,
    });

    const resultado = await rechazarMisionCuadrillaRepo(
      misionId,
      "admin-user-id",
      "Rechazo administrativo por reasignación",
      true
    );

    expect(resultado.mision.estado).toBe("RECHAZADA");
    expect(resultado.cuadrilla.estado).toBe("DISPONIBLE");
    expect(resultado.incidente).toBeNull();
  });

  it("debe autorizar a un integrante activo registrado en cuadrilla_personal aunque no sea el delegado directo (BUG-H41-API-05)", async () => {
    const ahora = new Date("2026-11-16T23:15:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: null,
        cuadrilla_nombre: "Cuadrilla Sur",
        cuadrilla_estado: "EN_MISION",
        cuadrilla_activo: true,
        cuadrilla_eliminado_en: null,
        cuadrilla_delegacion_id: delegacionId,
        cuadrilla_delegado_id: "otro-delegado",
      })
      .mockResolvedValueOnce({ id: "cp-1" })
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "RECHAZADA",
        justificacion_rechazo: "Falla mecánica reportada por integrante",
        fecha_cierre: ahora,
        actualizado_en: ahora,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Sur",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: "otro-delegado",
      });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "80000000-0000-4000-8000-000000000099",
      mision_id: misionId,
      hito: "RECHAZADA",
      descripcion: "Misión rechazada por cuadrilla: Falla mecánica reportada por integrante",
      registrado_por_id: delegadoId,
      latitud: null,
      longitud: null,
      creado_en: ahora,
    });

    const resultado = await rechazarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      "Falla mecánica reportada por integrante",
      false
    );

    expect(resultado.mision.estado).toBe("RECHAZADA");
    expect(resultado.cuadrilla.estado).toBe("DISPONIBLE");
  });

  it("debe mantener la cuadrilla en EN_MISION y no liberar dotación cuando tiene otraMisionActiva (BUG-H41-API-05)", async () => {
    const ahora = new Date("2026-11-16T23:15:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: null,
        cuadrilla_nombre: "Cuadrilla Norte",
        cuadrilla_estado: "EN_MISION",
        cuadrilla_activo: true,
        cuadrilla_eliminado_en: null,
        cuadrilla_delegacion_id: delegacionId,
        cuadrilla_delegado_id: delegadoId,
      })
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "RECHAZADA",
        justificacion_rechazo: "No podemos atender dos frentes",
        fecha_cierre: ahora,
        actualizado_en: ahora,
      })
      .mockResolvedValueOnce({ id: "otra-mision-activa-cuadrilla" });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "80000000-0000-4000-8000-000000000099",
      mision_id: misionId,
      hito: "RECHAZADA",
      descripcion: "Misión rechazada por cuadrilla: No podemos atender dos frentes",
      registrado_por_id: delegadoId,
      latitud: null,
      longitud: null,
      creado_en: ahora,
    });

    const resultado = await rechazarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      "No podemos atender dos frentes",
      false
    );

    expect(resultado.cuadrilla.estado).toBe("EN_MISION");
    expect(mockTrx.updateTable).not.toHaveBeenCalledWith("cuadrilla");
    expect(mockTrx.updateTable).not.toHaveBeenCalledWith("usuario");
  });

  it("no debe reactivar a DISPONIBLE una cuadrilla inactiva o eliminada lógicamente (BUG-H41-API-05)", async () => {
    const ahora = new Date("2026-11-16T23:15:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: null,
        cuadrilla_nombre: "Cuadrilla Baja",
        cuadrilla_estado: "NO_DISPONIBLE",
        cuadrilla_activo: false,
        cuadrilla_eliminado_en: ahora,
        cuadrilla_delegacion_id: delegacionId,
        cuadrilla_delegado_id: delegadoId,
      })
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "RECHAZADA",
        justificacion_rechazo: "Cuadrilla desactivada en sistema",
        fecha_cierre: ahora,
        actualizado_en: ahora,
      });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "80000000-0000-4000-8000-000000000099",
      mision_id: misionId,
      hito: "RECHAZADA",
      descripcion: "Misión rechazada por cuadrilla: Cuadrilla desactivada en sistema",
      registrado_por_id: delegadoId,
      latitud: null,
      longitud: null,
      creado_en: ahora,
    });

    const resultado = await rechazarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      "Cuadrilla desactivada en sistema",
      false
    );

    expect(resultado.cuadrilla.estado).toBe("NO_DISPONIBLE");
    expect(mockTrx.updateTable).not.toHaveBeenCalledWith("cuadrilla");
  });

  it("debe lanzar ConflictError ante actualización concurrente si UPDATE mision no retorna filas (BUG-H41-API-05)", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        cuadrilla_delegado_id: delegadoId,
        incidente_id: incidenteId,
        incidente_estado: "EN_ATENCION",
      })
      .mockResolvedValueOnce(undefined);

    await expect(
      rechazarMisionCuadrillaRepo(misionId, delegadoId, "Falla mecánica concurrente", false)
    ).rejects.toThrow("actualización concurrente");
  });

  it("debe lanzar ConflictError si el incidente asociado ya está en estado terminal RESUELTO o NO_ABORDABLE (BUG-H41-API-03)", async () => {
    for (const estadoTerminal of ["RESUELTO", "NO_ABORDABLE"] as const) {
      mockTrx.executeTakeFirst.mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        cuadrilla_delegado_id: delegadoId,
        incidente_id: incidenteId,
        incidente_estado: estadoTerminal,
      });

      await expect(
        rechazarMisionCuadrillaRepo(misionId, delegadoId, "Falla mecánica tardía", false)
      ).rejects.toThrow(`estado terminal '${estadoTerminal}'`);
    }
  });

  it("no debe revertir el incidente si existe otra misión activa (DESPACHADA/EN_CURSO) asociada al mismo incidente (BUG-H41-API-03)", async () => {
    const ahora = new Date("2026-11-16T23:15:00.000Z");

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: incidenteId,
        cuadrilla_nombre: "Cuadrilla 1",
        cuadrilla_estado: "EN_MISION",
        cuadrilla_activo: true,
        cuadrilla_eliminado_en: null,
        cuadrilla_delegacion_id: delegacionId,
        cuadrilla_delegado_id: delegadoId,
        incidente_codigo: "INC-2026-0001",
        incidente_estado: "EN_ATENCION",
        incidente_prioridad: "ALTA",
      })
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "RECHAZADA",
        justificacion_rechazo: "Falla en motobomba",
        fecha_cierre: ahora,
        actualizado_en: ahora,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla 1",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: delegadoId,
      })
      .mockResolvedValueOnce({ id: "otra-mision-activa-incidente" });

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce({
      id: "80000000-0000-4000-8000-000000000099",
      mision_id: misionId,
      hito: "RECHAZADA",
      descripcion: "Misión rechazada por cuadrilla: Falla en motobomba",
      registrado_por_id: delegadoId,
      latitud: null,
      longitud: null,
      creado_en: ahora,
    });

    const resultado = await rechazarMisionCuadrillaRepo(
      misionId,
      delegadoId,
      "Falla en motobomba",
      false
    );

    expect(resultado.incidente?.estado).toBe("EN_ATENCION");
    expect(resultado.incidenteActualizado).toBe(false);
    expect(mockTrx.updateTable).not.toHaveBeenCalledWith("incidente");
  });

  it("liberarDotacionCuadrillaDeMision debe excluir usuarios que pertenezcan a otra cuadrilla o patrulla activa (BUG-H41-API-02)", async () => {
    const sqlQueries: string[] = [];
    const baseDriver = new DummyDriver();
    const kyselyDummy = new Kysely<Database>({
      dialect: {
        createAdapter: () => new PostgresAdapter(),
        createDriver: () => ({
          init: () => baseDriver.init(),
          acquireConnection: async () => {
            const conn = await baseDriver.acquireConnection();
            return {
              ...conn,
              executeQuery: async (compiledQuery) => {
                if (compiledQuery.sql.startsWith("update")) {
                  sqlQueries.push(compiledQuery.sql);
                }
                return conn.executeQuery(compiledQuery);
              },
              streamQuery: (compiledQuery, chunkSize) =>
                conn.streamQuery(compiledQuery, chunkSize),
            };
          },
          beginTransaction: () => baseDriver.beginTransaction(),
          commitTransaction: () => baseDriver.commitTransaction(),
          rollbackTransaction: () => baseDriver.rollbackTransaction(),
          releaseConnection: () => baseDriver.releaseConnection(),
          destroy: () => baseDriver.destroy(),
        }),
        createIntrospector: (dbInstance) => new PostgresIntrospector(dbInstance),
        createQueryCompiler: () => new PostgresQueryCompiler(),
      },
    });

    await kyselyDummy.transaction().execute(async (trx) => {
      await liberarDotacionCuadrillaDeMision(trx as any, cuadrillaId, delegadoId);
    });

    expect(sqlQueries).toHaveLength(2);
    for (const sqlText of sqlQueries) {
      expect(sqlText).toContain("not exists");
      expect(sqlText).toContain('"cuadrilla" as "c_otra"');
      expect(sqlText).toContain('"cuadrilla_personal" as "cp_otra"');
      expect(sqlText).toContain('"patrulla_verificadora" as "pv_l"');
      expect(sqlText).toContain('"patrulla_personal" as "pp_o"');
      expect(sqlText).toContain('"mision"');
    }
  });
});

describe("HU-69: mision.repository - rechazarMisionPatrullaRepo", () => {
  const misionId = "60000000-0000-4000-8000-000000000050";
  const usuarioLiderId = "00000000-0000-4000-8000-000000000004";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";
  const incidenteId = "50000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTrx();
  });

  it("debe lanzar NotFoundError si la misión no existe", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce(undefined);

    await expect(
      rechazarMisionPatrullaRepo(misionId, usuarioLiderId, "Falla mecánica grave", false)
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar ConflictError si la misión no es de tipo VERIFICACION (BUG-H69-API-01)", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      id: misionId,
      codigo: "MIS-2026-0001",
      estado: "DESPACHADA",
      tipo_mision: "ATENCION_CUADRILLA",
      patrulla_id: null,
      cuadrilla_id: "c1000000-0000-4000-8000-000000000001",
      incidente_id: incidenteId,
    });

    await expect(
      rechazarMisionPatrullaRepo(misionId, usuarioLiderId, "Falla mecánica grave", false)
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ConflictError si la misión es de verificación pero no tiene patrulla asignada (BUG-H69-API-01)", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      id: misionId,
      codigo: "MIS-2026-0001",
      estado: "DESPACHADA",
      tipo_mision: "VERIFICACION",
      patrulla_id: null,
      incidente_id: incidenteId,
    });

    await expect(
      rechazarMisionPatrullaRepo(misionId, usuarioLiderId, "Falla mecánica grave", false)
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ForbiddenError si el usuario no es líder ni integrante de la patrulla asignada (salvo admin)", async () => {
    mockTrx.executeTakeFirst
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0001",
        estado: "DESPACHADA",
        tipo_mision: "VERIFICACION",
        patrulla_id: patrullaId,
        patrulla_lider_id: "otro-lider-id",
        incidente_id: incidenteId,
      })
      .mockResolvedValueOnce(undefined);

    await expect(
      rechazarMisionPatrullaRepo(misionId, usuarioLiderId, "Falla mecánica grave", false)
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe lanzar ConflictError si la misión ya ha sido rechazada previamente", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      id: misionId,
      codigo: "MIS-2026-0001",
      estado: "RECHAZADA",
      tipo_mision: "VERIFICACION",
      patrulla_id: patrullaId,
      patrulla_lider_id: usuarioLiderId,
      incidente_id: incidenteId,
    });

    await expect(
      rechazarMisionPatrullaRepo(misionId, usuarioLiderId, "Falla mecánica grave", false)
    ).rejects.toThrow("La misión ya ha sido rechazada previamente.");
  });

  it("debe lanzar ConflictError si la misión no se encuentra en estado DESPACHADA", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      id: misionId,
      codigo: "MIS-2026-0001",
      estado: "EN_CURSO",
      tipo_mision: "VERIFICACION",
      patrulla_id: patrullaId,
      patrulla_lider_id: usuarioLiderId,
      incidente_id: incidenteId,
    });

    await expect(
      rechazarMisionPatrullaRepo(misionId, usuarioLiderId, "Falla mecánica grave", false)
    ).rejects.toThrow("no se encuentra en estado 'DESPACHADA'");
  });

  it("debe rechazar exitosamente liberando patrulla activa y revirtiendo incidente en VERIFICANDO a REPORTADO", async () => {
    const misionMock = {
      id: misionId,
      codigo: "MIS-2026-0001",
      estado: "DESPACHADA",
      tipo_mision: "VERIFICACION",
      patrulla_id: patrullaId,
      patrulla_nombre: "Patrulla Norte 1",
      patrulla_estado: "EN_VERIFICACION",
      patrulla_activo: true,
      patrulla_eliminado_en: null,
      patrulla_delegacion_id: "30000000-0000-4000-8000-000000000001",
      patrulla_lider_id: usuarioLiderId,
      incidente_id: incidenteId,
      incidente_codigo: "INC-2026-0001",
      incidente_estado: "VERIFICANDO",
      incidente_prioridad: "ALTA",
    };

    const misionActualizadaMock = {
      id: misionId,
      codigo: "MIS-2026-0001",
      estado: "RECHAZADA",
      justificacion_rechazo: "Falla mecánica grave en móvil",
      patrulla_id: patrullaId,
      incidente_id: incidenteId,
      actualizado_en: new Date("2026-11-03T18:45:00.000Z"),
    };

    const patrullaActualizadaMock = {
      id: patrullaId,
      nombre: "Patrulla Norte 1",
      estado: "DISPONIBLE",
      delegacion_id: "30000000-0000-4000-8000-000000000001",
      usuario_lider_id: usuarioLiderId,
    };

    const incidenteActualizadoMock = {
      id: incidenteId,
      codigo: "INC-2026-0001",
      estado: "REPORTADO",
      prioridad: "ALTA",
    };

    const hitoCreadoMock = {
      id: "70000000-0000-4000-8000-000000000002",
      hito: "RECHAZADA",
      descripcion: "Misión rechazada por patrulla: Falla mecánica grave en móvil",
      creado_en: new Date("2026-11-03T18:45:00.000Z"),
    };

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionMock)
      .mockResolvedValueOnce(misionActualizadaMock)
      .mockResolvedValueOnce(patrullaActualizadaMock)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(incidenteActualizadoMock);

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce(hitoCreadoMock);

    const resultado = await rechazarMisionPatrullaRepo(
      misionId,
      usuarioLiderId,
      "Falla mecánica grave en móvil",
      false,
      { latitud: -39.814, longitud: -73.245 }
    );

    expect(resultado.mision.estado).toBe("RECHAZADA");
    expect(resultado.patrulla.estado).toBe("DISPONIBLE");
    expect(resultado.patrulla.delegacionId).toBe("30000000-0000-4000-8000-000000000001");
    expect(resultado.patrulla.usuarioLiderId).toBe(usuarioLiderId);
    expect(resultado.incidente.estado).toBe("REPORTADO");
    expect(resultado.incidente.id).toBe(incidenteId);
    expect(resultado.patrulla.id).toBe(patrullaId);
    expect(resultado.hito.hito).toBe("RECHAZADA");
  });

  it("no debe reactivar a DISPONIBLE una patrulla que está eliminada lógicamente (BUG-H69-API-03)", async () => {
    const misionMock = {
      id: misionId,
      codigo: "MIS-2026-0001",
      estado: "DESPACHADA",
      tipo_mision: "VERIFICACION",
      patrulla_id: patrullaId,
      patrulla_nombre: "Patrulla Norte 1",
      patrulla_estado: "NO_DISPONIBLE",
      patrulla_activo: false,
      patrulla_eliminado_en: new Date(),
      patrulla_delegacion_id: "30000000-0000-4000-8000-000000000001",
      patrulla_lider_id: usuarioLiderId,
      incidente_id: incidenteId,
      incidente_codigo: "INC-2026-0001",
      incidente_estado: "VERIFICANDO",
      incidente_prioridad: "ALTA",
    };

    const misionActualizadaMock = {
      id: misionId,
      codigo: "MIS-2026-0001",
      estado: "RECHAZADA",
      justificacion_rechazo: "Patrulla dada de baja",
      patrulla_id: patrullaId,
      incidente_id: incidenteId,
      actualizado_en: new Date("2026-11-03T18:45:00.000Z"),
    };

    const incidenteActualizadoMock = {
      id: incidenteId,
      codigo: "INC-2026-0001",
      estado: "REPORTADO",
      prioridad: "ALTA",
    };

    const hitoCreadoMock = {
      id: "70000000-0000-4000-8000-000000000002",
      hito: "RECHAZADA",
      descripcion: "Misión rechazada por patrulla: Patrulla dada de baja",
      creado_en: new Date("2026-11-03T18:45:00.000Z"),
    };

    mockTrx.executeTakeFirst
      .mockResolvedValueOnce(misionMock)
      .mockResolvedValueOnce(misionActualizadaMock)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(incidenteActualizadoMock);

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce(hitoCreadoMock);

    const resultado = await rechazarMisionPatrullaRepo(
      misionId,
      usuarioLiderId,
      "Patrulla dada de baja",
      false
    );

    expect(resultado.patrulla.estado).toBe("NO_DISPONIBLE");
    expect(resultado.mision.estado).toBe("RECHAZADA");
  });
});

describe("rechazarMisionRepo unificado - Validación cruzada de permisos (HU-41 / HU-69)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockTrx();
  });

  it("debe rechazar con ForbiddenError si un usuario con permiso de patrulla intenta rechazar una misión de cuadrilla", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      id: "70000000-0000-4000-8000-000000000001",
      codigo: "MIS-2026-0005",
      estado: "DESPACHADA",
      tipo_mision: "ATENCION_CUADRILLA",
      cuadrilla_id: "50000000-0000-4000-8000-000000000001",
      patrulla_id: null,
      incidente_id: "30000000-0000-4000-8000-000000000001",
    });

    await expect(
      rechazarMisionRepo(
        "70000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000004",
        "Intento cruzado no autorizado",
        false,
        undefined,
        [PERMISO_VERIFICAR_MISION_TERRENO]
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe rechazar con ForbiddenError si un usuario con permiso de cuadrilla intenta rechazar una misión de patrulla", async () => {
    mockTrx.executeTakeFirst.mockResolvedValueOnce({
      id: "60000000-0000-4000-8000-000000000050",
      codigo: "MIS-2026-8341",
      estado: "DESPACHADA",
      tipo_mision: "VERIFICACION",
      cuadrilla_id: null,
      patrulla_id: "f1000000-0000-4000-8000-000000000001",
      incidente_id: "50000000-0000-4000-8000-000000000001",
    });

    await expect(
      rechazarMisionRepo(
        "60000000-0000-4000-8000-000000000050",
        "d0000000-0000-4000-8000-000000000001",
        "Intento cruzado no autorizado",
        false,
        undefined,
        [PERMISO_EJECUTAR_MISION_TERRENO]
      )
    ).rejects.toThrow(ForbiddenError);
  });
});
