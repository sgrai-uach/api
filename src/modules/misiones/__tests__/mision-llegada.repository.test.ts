import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportarLlegadaCuadrillaRepo } from "../mision.repository";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/modules/seguridad/errors";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

describe("Mision Repository - reportarLlegadaCuadrillaRepo (HU-42)", () => {
  const misionId = "60000000-0000-4000-8000-000000000001";
  const usuarioId = "00000000-0000-4000-8000-000000000010";
  const cuadrillaId = "c0000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function crearMockTrx(config: {
    mision?: Record<string, unknown> | undefined;
    hitoPrevio?: Record<string, unknown> | undefined;
    hitoInsertado?: Record<string, unknown>;
    integrantes?: Array<{ personal_id: string }>;
    numUpdatedRows?: bigint;
    usuario?: { id: string; nombre: string } | undefined;
  }) {
    const misionChain = {
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      forUpdate: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn(async () => config.mision),
    };

    const trx = {
      selectFrom: vi.fn((table: string) => {
        if (table === "mision") {
          return misionChain;
        }
        if (table === "mision_hito") {
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn(async () => config.hitoPrevio),
          };
        }
        if (table === "cuadrilla_personal") {
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn(async () => config.integrantes ?? []),
          };
        }
        if (table === "usuario") {
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn(async () => config.usuario),
          };
        }
        return {};
      }),
      insertInto: vi.fn(() => ({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        executeTakeFirstOrThrow: vi.fn(async () => config.hitoInsertado),
      })),
      updateTable: vi.fn((table: string) => ({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn(async () => []),
        executeTakeFirst: vi.fn(async () => ({
          numUpdatedRows: table === "personal" ? (config.numUpdatedRows ?? BigInt(1)) : BigInt(1),
        })),
      })),
    };

    vi.mocked(db.transaction).mockReturnValue({
      execute: async <T>(cb: (t: unknown) => Promise<T>) => cb(trx),
    } as never);

    return { trx, misionChain };
  }

  it("debe bloquear solo la tabla 'mision' en forUpdate('mision') al usar leftJoin con cuadrilla y registrar la llegada", async () => {
    const now = new Date("2026-11-22T23:00:00.000Z");
    const { misionChain } = crearMockTrx({
      mision: {
        id: misionId,
        codigo: "MIS-2026-0042",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        fecha_inicio: null,
        usuario_delegado_id: usuarioId,
        cuadrilla_nombre: "Cuadrilla Sur 1",
      },
      hitoPrevio: undefined,
      hitoInsertado: {
        id: "hito-1",
        mision_id: misionId,
        hito: "LLEGADA_TERRENO",
        descripcion: "Llegada a terreno reportada. En punto.",
        latitud: -39.8142,
        longitud: -73.2459,
        registrado_por_id: usuarioId,
        creado_en: now,
      },
      integrantes: [{ personal_id: "pers-1" }],
      numUpdatedRows: BigInt(2),
      usuario: { id: usuarioId, nombre: "Carlos Muñoz" },
    });

    const resultado = await reportarLlegadaCuadrillaRepo(misionId, usuarioId, false, {
      latitud: -39.8142,
      longitud: -73.2459,
      observaciones: "En punto.",
    });

    expect(misionChain.forUpdate).toHaveBeenCalledWith("mision");
    expect(resultado.hito.hito).toBe("LLEGADA_TERRENO");
    expect(resultado.hito.estadoMision).toBe("EN_CURSO");
    expect(resultado.hito.miembrosActualizados).toBe(2);
    expect(resultado.mision.estado).toBe("EN_CURSO");
  });

  it("debe lanzar NotFoundError si la misión no existe", async () => {
    crearMockTrx({ mision: undefined });

    await expect(
      reportarLlegadaCuadrillaRepo(misionId, usuarioId, false, {
        latitud: -39.8142,
        longitud: -73.2459,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar ForbiddenError si el usuario no es el delegado ni administrador", async () => {
    crearMockTrx({
      mision: {
        id: misionId,
        codigo: "MIS-2026-0042",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        fecha_inicio: null,
        usuario_delegado_id: "otro-usuario-id",
        cuadrilla_nombre: "Cuadrilla Sur 1",
      },
    });

    await expect(
      reportarLlegadaCuadrillaRepo(misionId, usuarioId, false, {
        latitud: -39.8142,
        longitud: -73.2459,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe lanzar ConflictError si la llegada a terreno ya fue reportada previamente", async () => {
    crearMockTrx({
      mision: {
        id: misionId,
        codigo: "MIS-2026-0042",
        estado: "EN_CURSO",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        fecha_inicio: new Date(),
        usuario_delegado_id: usuarioId,
        cuadrilla_nombre: "Cuadrilla Sur 1",
      },
      hitoPrevio: { id: "hito-existente" },
    });

    await expect(
      reportarLlegadaCuadrillaRepo(misionId, usuarioId, false, {
        latitud: -39.8142,
        longitud: -73.2459,
      })
    ).rejects.toThrow(ConflictError);
  });
});
