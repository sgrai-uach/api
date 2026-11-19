/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { rechazarMisionCuadrillaRepo } from "../mision.repository";
import { db } from "@/lib/db";
import { NotFoundError, ConflictError, ForbiddenError } from "@/modules/seguridad/errors";

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

describe("HU-41: mision.repository - rechazarMisionCuadrillaRepo", () => {
  const misionId = "70000000-0000-4000-8000-000000000001";
  const delegadoId = "d0000000-0000-4000-8000-000000000001";
  const cuadrillaId = "50000000-0000-4000-8000-000000000001";
  const incidenteId = "30000000-0000-4000-8000-000000000001";
  const delegacionId = "30000000-0000-4000-8000-000000000002";

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
      // 1. Consulta inicial con FOR UPDATE
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
      // 5. Update mision
      .mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0005",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "RECHAZADA",
        justificacion_rechazo: "Falla hidráulica en camión tolva",
        fecha_cierre: ahora,
        actualizado_en: ahora,
      })
      // 6a. Otra misión activa de cuadrilla -> ninguna
      .mockResolvedValueOnce(undefined)
      // 6b. Update cuadrilla -> DISPONIBLE
      .mockResolvedValueOnce({
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "DISPONIBLE",
        delegacion_id: delegacionId,
        usuario_delegado_id: delegadoId,
      })
      // 7a. Consulta de verificación previa completada -> existe
      .mockResolvedValueOnce({ id: "verif-mision-id" })
      // 7b. Update incidente -> VERIFICANDO
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
      // Sin verificación previa completada
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
});
