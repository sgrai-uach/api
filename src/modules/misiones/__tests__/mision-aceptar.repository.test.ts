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
        chain.execute = vi.fn(async () => []);
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

describe("Mision Repository - aceptarMisionCuadrilla (HU-40)", () => {
  const misionId = "70000000-0000-4000-8000-000000000001";
  const delegadoId = "d0000000-0000-4000-8000-000000000001";
  const integranteId = "d0000000-0000-4000-8000-000000000002";
  const cuadrillaId = "50000000-0000-4000-8000-000000000001";
  const incidenteId = "30000000-0000-4000-8000-000000000001";
  const delegacionId = "30000000-0000-4000-8000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function crearMockTrxCuadrilla(config: {
    misionExistente?: Record<string, unknown> | undefined;
    integrante?: Record<string, unknown> | undefined;
    misionActualizada?: Record<string, unknown> | undefined;
    misionReciente?: Record<string, unknown> | undefined;
    cuadrillaActualizada?: Record<string, unknown> | undefined;
    incidenteActualizado?: Record<string, unknown> | undefined;
    hitoRegistrado?: Record<string, unknown>;
  }) {
    let selectMisionCount = 0;
    const updatesPorTabla: Array<{ tabla: string; data: Record<string, unknown> }> = [];
    const insertsPorTabla: Array<{ tabla: string; data: Record<string, unknown> }> = [];

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
        if (table === "cuadrilla_personal") {
          const chain: Record<string, unknown> = {};
          chain.innerJoin = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          chain.where = vi.fn(() => chain);
          chain.executeTakeFirst = vi.fn(async () => config.integrante);
          return chain;
        }
        return {};
      }),
      updateTable: vi.fn((table: string) => {
        const chain: Record<string, unknown> = {};
        chain.set = vi.fn((data: Record<string, unknown>) => {
          updatesPorTabla.push({ tabla: table, data });
          return chain;
        });
        chain.where = vi.fn(() => chain);
        chain.returning = vi.fn(() => chain);
        chain.returningAll = vi.fn(() => chain);
        chain.execute = vi.fn(async () => []);
        chain.executeTakeFirst = vi.fn(async () => {
          if (table === "mision") return config.misionActualizada;
          if (table === "cuadrilla") return config.cuadrillaActualizada;
          if (table === "incidente") return config.incidenteActualizado;
          return undefined;
        });
        return chain;
      }),
      insertInto: vi.fn((table: string) => {
        const chain: Record<string, unknown> = {};
        chain.values = vi.fn((data: Record<string, unknown>) => {
          insertsPorTabla.push({ tabla: table, data });
          return chain;
        });
        chain.returningAll = vi.fn(() => chain);
        chain.executeTakeFirstOrThrow = vi.fn(async () => config.hitoRegistrado);
        return chain;
      }),
    };

    vi.mocked(db.transaction).mockReturnValue({
      execute: async <T>(cb: (t: unknown) => Promise<T>) => cb(trx),
    } as never);

    return { trx, updatesPorTabla, insertsPorTabla };
  }

  it("debe ejecutar la transacción atómica para cuadrilla: mision EN_CURSO, cuadrilla EN_MISION, incidente EN_ATENCION e hito 'Asignación Aceptada por Cuadrilla'", async () => {
    const now = new Date("2026-11-22T14:00:00.000Z");
    const { trx, updatesPorTabla, insertsPorTabla } = crearMockTrxCuadrilla({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        prioridad: "ALTA",
        cuadrilla_id: cuadrillaId,
        patrulla_id: null,
        incidente_id: incidenteId,
        cuadrilla_nombre: "Cuadrilla Vías y Canales 1",
        cuadrilla_estado: "DISPONIBLE",
        cuadrilla_activo: true,
        cuadrilla_eliminado_en: null,
        cuadrilla_delegacion_id: delegacionId,
        cuadrilla_delegado_id: delegadoId,
        incidente_codigo: "INC-2026-0001",
        incidente_estado: "VERIFICANDO",
        incidente_prioridad: "ALTA",
      },
      misionActualizada: {
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: "Atención táctica - Incidente INC-2026-0001",
        descripcion: "Despeje de árbol caído",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "EN_CURSO",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        patrulla_id: null,
        cuadrilla_id: cuadrillaId,
        fecha_inicio: now,
        actualizado_en: now,
      },
      cuadrillaActualizada: {
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "EN_MISION",
        delegacion_id: delegacionId,
        usuario_delegado_id: delegadoId,
      },
      incidenteActualizado: {
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "ALTA",
      },
      hitoRegistrado: {
        id: "80000000-0000-4000-8000-000000000010",
        mision_id: misionId,
        hito: "MISION_ACEPTADA",
        descripcion: "Asignación Aceptada por Cuadrilla",
        registrado_por_id: delegadoId,
        latitud: "-39.8195880",
        longitud: "-73.2452090",
        creado_en: now,
      },
    });

    const res = await aceptarMisionPatrullaRepo(misionId, delegadoId, false, {
      latitud: -39.819588,
      longitud: -73.245209,
    });

    expect(trx.updateTable).toHaveBeenCalledWith("mision");
    expect(trx.updateTable).toHaveBeenCalledWith("cuadrilla");
    expect(trx.updateTable).toHaveBeenCalledWith("usuario");
    expect(trx.updateTable).toHaveBeenCalledWith("incidente");
    expect(trx.insertInto).toHaveBeenCalledWith("mision_hito");

    expect(updatesPorTabla.find((u) => u.tabla === "mision")?.data.estado).toBe("EN_CURSO");
    expect(updatesPorTabla.find((u) => u.tabla === "cuadrilla")?.data.estado).toBe("EN_MISION");
    expect(updatesPorTabla.find((u) => u.tabla === "usuario")?.data.estado_operativo).toBe(
      "en_mision"
    );
    expect(updatesPorTabla.find((u) => u.tabla === "incidente")?.data.estado).toBe("EN_ATENCION");
    expect(insertsPorTabla[0]?.data).toMatchObject({
      mision_id: misionId,
      hito: "MISION_ACEPTADA",
      descripcion: "Asignación Aceptada por Cuadrilla",
      registrado_por_id: delegadoId,
      latitud: -39.819588,
      longitud: -73.245209,
    });

    expect(res.mision.estado).toBe("EN_CURSO");
    expect(res.mision.cuadrillaId).toBe(cuadrillaId);
    expect(res.cuadrilla?.estado).toBe("EN_MISION");
    expect(res.patrulla).toBeNull();
    expect(res.incidente?.estado).toBe("EN_ATENCION");
    expect(res.hito.hito).toBe("MISION_ACEPTADA");
    expect(res.hito.descripcion).toBe("Asignación Aceptada por Cuadrilla");
  });

  it("debe autorizar la aceptación cuando el usuario es integrante activo en cuadrilla_personal", async () => {
    const now = new Date("2026-11-22T14:00:00.000Z");
    crearMockTrxCuadrilla({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        prioridad: "MEDIA",
        cuadrilla_id: cuadrillaId,
        patrulla_id: null,
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
      },
      integrante: { id: "cp-1" },
      misionActualizada: {
        id: misionId,
        codigo: "MIS-2026-0005",
        titulo: "Atención táctica",
        descripcion: null,
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "EN_CURSO",
        prioridad: "MEDIA",
        incidente_id: incidenteId,
        patrulla_id: null,
        cuadrilla_id: cuadrillaId,
        fecha_inicio: now,
        actualizado_en: now,
      },
      cuadrillaActualizada: {
        id: cuadrillaId,
        nombre: "Cuadrilla Vías y Canales 1",
        estado: "EN_MISION",
        delegacion_id: delegacionId,
        usuario_delegado_id: delegadoId,
      },
      incidenteActualizado: {
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "EN_ATENCION",
        prioridad: "MEDIA",
      },
      hitoRegistrado: {
        id: "80000000-0000-4000-8000-000000000011",
        mision_id: misionId,
        hito: "MISION_ACEPTADA",
        descripcion: "Asignación Aceptada por Cuadrilla",
        registrado_por_id: integranteId,
        latitud: null,
        longitud: null,
        creado_en: now,
      },
    });

    const res = await aceptarMisionPatrullaRepo(misionId, integranteId, false);
    expect(res.mision.estado).toBe("EN_CURSO");
    expect(res.hito.registradoPorId).toBe(integranteId);
  });

  it("debe lanzar ForbiddenError si un usuario ajeno a la cuadrilla intenta aceptar la misión", async () => {
    crearMockTrxCuadrilla({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: incidenteId,
        cuadrilla_delegado_id: delegadoId,
      },
      integrante: undefined,
    });

    await expect(
      aceptarMisionPatrullaRepo(misionId, "00000000-0000-4000-8000-000000000099", false)
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe lanzar ForbiddenError si se invoca solo con permiso de verificación de patrulla sobre misión de cuadrilla", async () => {
    crearMockTrxCuadrilla({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: incidenteId,
        cuadrilla_delegado_id: delegadoId,
      },
    });

    await expect(
      aceptarMisionPatrullaRepo(misionId, delegadoId, false, undefined, {
        puedeEjecutarCuadrilla: false,
        puedeVerificarPatrulla: true,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe lanzar ConflictError si la cuadrilla fue dada de baja o el incidente está RESUELTO", async () => {
    crearMockTrxCuadrilla({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: incidenteId,
        cuadrilla_delegado_id: delegadoId,
        cuadrilla_activo: false,
        cuadrilla_eliminado_en: new Date(),
        incidente_estado: "VERIFICANDO",
      },
    });

    await expect(aceptarMisionPatrullaRepo(misionId, delegadoId, false)).rejects.toThrow(
      ConflictError
    );

    crearMockTrxCuadrilla({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "DESPACHADA",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: incidenteId,
        cuadrilla_delegado_id: delegadoId,
        cuadrilla_activo: true,
        cuadrilla_eliminado_en: null,
        cuadrilla_estado: "EN_MISION",
        incidente_estado: "RESUELTO",
      },
    });

    await expect(aceptarMisionPatrullaRepo(misionId, delegadoId, false)).rejects.toThrow(
      ConflictError
    );
  });

  it("debe lanzar ConflictError si la misión de cuadrilla ya se encuentra EN_CURSO", async () => {
    crearMockTrxCuadrilla({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0005",
        estado: "EN_CURSO",
        tipo_mision: "ATENCION_CUADRILLA",
        cuadrilla_id: cuadrillaId,
        incidente_id: incidenteId,
        cuadrilla_delegado_id: delegadoId,
        cuadrilla_activo: true,
        cuadrilla_eliminado_en: null,
        cuadrilla_estado: "EN_MISION",
        incidente_estado: "EN_ATENCION",
      },
      misionActualizada: undefined,
      misionReciente: { estado: "EN_CURSO" },
    });

    await expect(aceptarMisionPatrullaRepo(misionId, delegadoId, false)).rejects.toThrow(
      ConflictError
    );
  });
});

