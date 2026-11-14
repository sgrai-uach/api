import { describe, it, expect, vi, beforeEach } from "vitest";
import { aceptarMisionPatrullaRepo } from "../mision.repository";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError } from "@/modules/seguridad/errors";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

describe("Mision Repository - aceptarMisionPatrullaRepo (HU-36)", () => {
  const misionId = "60000000-0000-4000-8000-000000000001";
  const liderId = "00000000-0000-4000-8000-000000000004";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";
  const incidenteId = "a0000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function crearMockTrx(config: {
    misionExistente?: Record<string, unknown> | undefined;
    integrante?: Record<string, unknown> | undefined;
    misionActualizada?: Record<string, unknown> | undefined;
    misionReciente?: Record<string, unknown> | undefined;
    hitoRegistrado?: Record<string, unknown>;
  }) {
    let selectMisionCount = 0;

    const trx = {
      selectFrom: vi.fn((table: string) => {
        if (table === "mision") {
          selectMisionCount++;
          const currentCall = selectMisionCount;
          const chain: Record<string, unknown> = {};
          chain.leftJoin = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          chain.where = vi.fn(() => chain);
          chain.forUpdate = vi.fn(() => chain);
          chain.executeTakeFirst = vi.fn(async () =>
            currentCall === 1 ? config.misionExistente : config.misionReciente
          );
          return chain;
        }
        if (table === "patrulla_personal") {
          const chain: Record<string, unknown> = {};
          chain.innerJoin = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          chain.where = vi.fn(() => chain);
          chain.executeTakeFirst = vi.fn(async () => config.integrante);
          return chain;
        }
        return {};
      }),
      updateTable: vi.fn(() => {
        const chain: Record<string, unknown> = {};
        chain.set = vi.fn(() => chain);
        chain.where = vi.fn(() => chain);
        chain.returningAll = vi.fn(() => chain);
        chain.executeTakeFirst = vi.fn(async () => config.misionActualizada);
        return chain;
      }),
      insertInto: vi.fn(() => {
        const chain: Record<string, unknown> = {};
        chain.values = vi.fn(() => chain);
        chain.returningAll = vi.fn(() => chain);
        chain.executeTakeFirstOrThrow = vi.fn(async () => config.hitoRegistrado);
        return chain;
      }),
    };

    vi.mocked(db.transaction).mockReturnValue({
      execute: async <T>(cb: (t: unknown) => Promise<T>) => cb(trx),
    } as never);

    return trx;
  }

  it("debe ejecutar la transición atómica DESPACHADA -> EN_CURSO e insertar el hito MISION_ACEPTADA", async () => {
    const now = new Date("2026-11-01T21:00:00.000Z");
    const trx = crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0001",
        estado: "DESPACHADA",
        patrulla_id: patrullaId,
        incidente_id: incidenteId,
        patrulla_nombre: "Patrulla Costa-1",
        patrulla_estado: "EN_VERIFICACION",
        patrulla_lider_id: liderId,
        lider_rol_codigo: "PATRULLA_VERIFICADORA",
        lider_rol_nombre: "Patrulla Verificadora",
        incidente_codigo: "INC-2026-0001",
        incidente_estado: "VERIFICANDO",
      },
      misionActualizada: {
        id: misionId,
        codigo: "MIS-2026-0001",
        titulo: "Verificación de Incidente",
        descripcion: "Ir al lugar",
        tipo_mision: "VERIFICACION",
        estado: "EN_CURSO",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        patrulla_id: patrullaId,
        fecha_inicio: now,
        actualizado_en: now,
      },
      hitoRegistrado: {
        id: "70000000-0000-4000-8000-000000000001",
        mision_id: misionId,
        hito: "MISION_ACEPTADA",
        descripcion: "Misión Aceptada por Patrulla",
        registrado_por_id: liderId,
        latitud: "-39.8195880",
        longitud: "-73.2452090",
        creado_en: now,
      },
    });

    const res = await aceptarMisionPatrullaRepo(misionId, liderId, false, {
      latitud: -39.819588,
      longitud: -73.245209,
    });

    expect(trx.updateTable).toHaveBeenCalledWith("mision");
    expect(trx.insertInto).toHaveBeenCalledWith("mision_hito");
    expect(res.mision.estado).toBe("EN_CURSO");
    expect(res.patrulla?.estado).toBe("EN_VERIFICACION");
    expect(res.incidente?.estado).toBe("VERIFICANDO");
    expect(res.hito.hito).toBe("MISION_ACEPTADA");
    expect(res.hito.descripcion).toBe("Misión Aceptada por Patrulla");
  });

  it("debe lanzar ConflictError si el update condicional no afecta filas (misión ya EN_CURSO)", async () => {
    crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0001",
        estado: "EN_CURSO",
        patrulla_id: patrullaId,
        incidente_id: incidenteId,
        patrulla_lider_id: liderId,
        lider_rol_codigo: "PATRULLA_VERIFICADORA",
      },
      misionActualizada: undefined,
      misionReciente: { estado: "EN_CURSO" },
    });

    await expect(aceptarMisionPatrullaRepo(misionId, liderId, false)).rejects.toThrow(
      ConflictError
    );
  });

  it("debe lanzar ForbiddenError si un usuario de otra patrulla intenta aceptar la misión", async () => {
    const otroPatrulleroId = "00000000-0000-4000-8000-000000000099";
    crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0001",
        estado: "DESPACHADA",
        patrulla_id: patrullaId,
        incidente_id: incidenteId,
        patrulla_lider_id: liderId,
        lider_rol_codigo: "PATRULLA_VERIFICADORA",
        lider_rol_nombre: "Patrulla Verificadora",
      },
      integrante: undefined,
    });

    await expect(aceptarMisionPatrullaRepo(misionId, otroPatrulleroId, false)).rejects.toThrow(
      ForbiddenError
    );
  });

  it("debe lanzar NotFoundError si la misión no existe", async () => {
    crearMockTrx({
      misionExistente: undefined,
    });

    await expect(aceptarMisionPatrullaRepo(misionId, liderId, false)).rejects.toThrow(
      NotFoundError
    );
  });

  it("debe lanzar ConflictError si la misión no tiene patrulla verificadora asignada (BUG-H36-API-01)", async () => {
    crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0001",
        estado: "DESPACHADA",
        patrulla_id: null,
        incidente_id: incidenteId,
      },
    });

    await expect(aceptarMisionPatrullaRepo(misionId, liderId, false)).rejects.toThrow(
      ConflictError
    );
  });

  it("debe lanzar ForbiddenError si un patrullero ajeno intenta aceptar misión cuyo líder tiene rol ENCARGADO (BUG-H36-API-01)", async () => {
    const otroPatrulleroId = "00000000-0000-4000-8000-000000000099";
    crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0007",
        estado: "DESPACHADA",
        patrulla_id: patrullaId,
        incidente_id: incidenteId,
        patrulla_lider_id: "00000000-0000-4000-8000-000000000003",
        lider_rol_codigo: "ENCARGADO",
        lider_rol_nombre: "Encargado",
      },
      integrante: undefined,
    });

    await expect(aceptarMisionPatrullaRepo(misionId, otroPatrulleroId, false)).rejects.toThrow(
      ForbiddenError
    );
  });

  it("debe lanzar ConflictError si la patrulla está dada de baja o el incidente está RESUELTO (BUG-H36-API-04)", async () => {
    crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0001",
        estado: "DESPACHADA",
        patrulla_id: patrullaId,
        incidente_id: incidenteId,
        patrulla_lider_id: liderId,
        patrulla_estado: "NO_DISPONIBLE",
        patrulla_eliminado_en: new Date(),
        incidente_estado: "VERIFICANDO",
      },
    });

    await expect(aceptarMisionPatrullaRepo(misionId, liderId, false)).rejects.toThrow(
      ConflictError
    );

    crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0001",
        estado: "DESPACHADA",
        patrulla_id: patrullaId,
        incidente_id: incidenteId,
        patrulla_lider_id: liderId,
        patrulla_estado: "EN_VERIFICACION",
        patrulla_eliminado_en: null,
        incidente_estado: "RESUELTO",
      },
    });

    await expect(aceptarMisionPatrullaRepo(misionId, liderId, false)).rejects.toThrow(
      ConflictError
    );
  });
});

