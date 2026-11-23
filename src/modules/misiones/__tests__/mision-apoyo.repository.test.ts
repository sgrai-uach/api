import { describe, it, expect, vi, beforeEach } from "vitest";
import { registrarSolicitudApoyoMisionRepo } from "../mision.repository";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/modules/seguridad/errors";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

describe("Mision Repository - registrarSolicitudApoyoMisionRepo (HU-44)", () => {
  const misionId = "60000000-0000-4000-8000-000000000001";
  const usuarioId = "00000000-0000-4000-8000-000000000005";
  const cuadrillaId = "c1000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function crearMockTrx(config: {
    mision?: Record<string, unknown> | undefined;
    usuario?: { id: string; nombre: string } | undefined;
    reporteInsertado?: Record<string, unknown>;
    hitoInsertado?: Record<string, unknown>;
  }) {
    const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const updateCalls: string[] = [];

    const misionChain = {
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      forUpdate: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn(async () => config.mision),
    };

    const trx = {
      selectFrom: vi.fn((table: string) => {
        if (table === "mision") return misionChain;
        if (table === "usuario") {
          return {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn(async () => config.usuario),
          };
        }
        return {};
      }),
      insertInto: vi.fn((table: string) => ({
        values: vi.fn((payload: Record<string, unknown>) => {
          insertCalls.push({ table, payload });
          return {
            returning: vi.fn().mockReturnThis(),
            returningAll: vi.fn().mockReturnThis(),
            executeTakeFirstOrThrow: vi.fn(async () =>
              table === "reporte_terreno"
                ? config.reporteInsertado
                : config.hitoInsertado
            ),
          };
        }),
      })),
      updateTable: vi.fn((table: string) => {
        updateCalls.push(table);
        return {
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          execute: vi.fn(async () => []),
        };
      }),
    };

    vi.mocked(db.transaction).mockReturnValue({
      execute: async <T>(cb: (t: unknown) => Promise<T>) => cb(trx),
    } as never);

    return { insertCalls, updateCalls };
  }

  it("debe persistir en reporte_terreno con requiere_apoyo_adicional = true, detalle_apoyo_requerido y registrar hito APOYO_SOLICITADO", async () => {
    const now = new Date("2026-11-23T20:30:00.000Z");
    const { insertCalls, updateCalls } = crearMockTrx({
      mision: {
        id: misionId,
        codigo: "MIS-2026-0044",
        estado: "EN_CURSO",
        cuadrilla_id: cuadrillaId,
        patrulla_id: null,
        incidente_id: "50000000-0000-4000-8000-000000000001",
        cuadrilla_nombre: "Cuadrilla Aguas Lluvias Alfa",
        cuadrilla_delegado_id: usuarioId,
        patrulla_lider_id: null,
        incidente_codigo: "INC-2026-0010",
        incidente_estado: "EN_ATENCION",
        incidente_prioridad: "ALTA",
      },
      usuario: { id: usuarioId, nombre: "Carlos Delegado" },
      reporteInsertado: { id: "rep-1", creado_en: now },
      hitoInsertado: {
        id: "hito-1",
        mision_id: misionId,
        hito: "APOYO_SOLICITADO",
        descripcion: "Se solicita motoniveladora y cuadrilla adicional de despeje",
        registrado_por_id: usuarioId,
        latitud: null,
        longitud: null,
        creado_en: now,
      },
    });

    const resultado = await registrarSolicitudApoyoMisionRepo(misionId, usuarioId, false, {
      requiereApoyoAdicional: true,
      detalleApoyoRequerido: "Se solicita motoniveladora y cuadrilla adicional de despeje",
      observaciones: null,
    });

    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0].table).toBe("reporte_terreno");
    expect(insertCalls[0].payload).toMatchObject({
      mision_id: misionId,
      evaluador_id: usuarioId,
      tipo_reporte: "SOLICITUD_APOYO",
      requiere_apoyo_adicional: true,
      detalle_apoyo_requerido: "Se solicita motoniveladora y cuadrilla adicional de despeje",
    });
    expect(insertCalls[1].table).toBe("mision_hito");
    expect(insertCalls[1].payload.hito).toBe("APOYO_SOLICITADO");
    expect(updateCalls).toContain("incidente");
    expect(resultado.hito?.hito).toBe("APOYO_SOLICITADO");
  });

  it("debe lanzar NotFoundError si la misión no existe", async () => {
    crearMockTrx({ mision: undefined });
    await expect(
      registrarSolicitudApoyoMisionRepo(misionId, usuarioId, false, {
        requiereApoyoAdicional: true,
        detalleApoyoRequerido: "Se requiere refuerzo",
        observaciones: null,
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("debe lanzar ForbiddenError si el usuario no pertenece a la cuadrilla asignada", async () => {
    crearMockTrx({
      mision: {
        id: misionId,
        codigo: "MIS-2026-0044",
        estado: "EN_CURSO",
        cuadrilla_id: cuadrillaId,
        patrulla_id: null,
        incidente_id: null,
        cuadrilla_delegado_id: "otro-usuario",
        patrulla_lider_id: null,
      },
    });
    await expect(
      registrarSolicitudApoyoMisionRepo(misionId, usuarioId, false, {
        requiereApoyoAdicional: true,
        detalleApoyoRequerido: "Se requiere refuerzo",
        observaciones: null,
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("debe lanzar ConflictError si la misión no está en estado EN_CURSO", async () => {
    crearMockTrx({
      mision: {
        id: misionId,
        codigo: "MIS-2026-0044",
        estado: "DESPACHADA",
        cuadrilla_id: cuadrillaId,
        patrulla_id: null,
        incidente_id: null,
        cuadrilla_delegado_id: usuarioId,
        patrulla_lider_id: null,
      },
    });
    await expect(
      registrarSolicitudApoyoMisionRepo(misionId, usuarioId, false, {
        requiereApoyoAdicional: true,
        detalleApoyoRequerido: "Se requiere refuerzo",
        observaciones: null,
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
