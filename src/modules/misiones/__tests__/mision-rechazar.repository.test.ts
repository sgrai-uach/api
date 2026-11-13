import { describe, it, expect, vi, beforeEach } from "vitest";
import { rechazarMisionPatrullaRepo } from "../mision.repository";
import { db } from "@/lib/db";
import { NotFoundError, ConflictError, ForbiddenError } from "@/modules/seguridad/errors";

const mockTrx = {
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

vi.mock("@/lib/db", () => {
  return {
    db: {
      transaction: vi.fn(),
      selectFrom: vi.fn(),
    },
  };
});

describe("HU-69: mision.repository - rechazarMisionPatrullaRepo", () => {
  const misionId = "60000000-0000-4000-8000-000000000050";
  const usuarioLiderId = "00000000-0000-4000-8000-000000000004";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";
  const incidenteId = "50000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrx.selectFrom.mockReturnValue(mockTrx);
    mockTrx.leftJoin.mockReturnValue(mockTrx);
    mockTrx.innerJoin.mockReturnValue(mockTrx);
    mockTrx.select.mockReturnValue(mockTrx);
    mockTrx.where.mockReturnValue(mockTrx);
    mockTrx.updateTable.mockReturnValue(mockTrx);
    mockTrx.set.mockReturnValue(mockTrx);
    mockTrx.returning.mockReturnValue(mockTrx);
    mockTrx.insertInto.mockReturnValue(mockTrx);
    mockTrx.values.mockReturnValue(mockTrx);
    mockTrx.returningAll.mockReturnValue(mockTrx);

    vi.mocked(db.transaction).mockReturnValue({
      execute: (cb: (trx: typeof mockTrx) => Promise<unknown>) => cb(mockTrx),
    } as any);
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
      .mockResolvedValueOnce(undefined); // integrante = undefined en patrulla_personal

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
      .mockResolvedValueOnce(misionMock) // 1. Misión existente
      .mockResolvedValueOnce(misionActualizadaMock) // 2. Update misión
      .mockResolvedValueOnce(patrullaActualizadaMock) // 3. Update patrulla
      .mockResolvedValueOnce(incidenteActualizadoMock); // 4. Update incidente

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce(hitoCreadoMock); // 5. Insert hito

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
      .mockResolvedValueOnce(misionMock) // 1. Misión existente
      .mockResolvedValueOnce(misionActualizadaMock) // 2. Update misión
      .mockResolvedValueOnce(incidenteActualizadoMock); // 3. Update incidente (la patrulla no se actualiza)

    mockTrx.executeTakeFirstOrThrow.mockResolvedValueOnce(hitoCreadoMock); // 4. Insert hito

    const resultado = await rechazarMisionPatrullaRepo(
      misionId,
      usuarioLiderId,
      "Patrulla dada de baja",
      false
    );

    // Mantiene el estado no disponible original de la patrulla eliminada
    expect(resultado.patrulla.estado).toBe("NO_DISPONIBLE");
    expect(resultado.mision.estado).toBe("RECHAZADA");
  });
});

