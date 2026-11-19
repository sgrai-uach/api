import { describe, it, expect, vi, beforeEach } from "vitest";
import { crearReporteVerificacionYCerrarMisionRepo } from "../mision.repository";
import { db } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

describe("Mision Repository - crearReporteVerificacionYCerrarMisionRepo (HU-39 / HU-86)", () => {
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
    reportesPrevios?: Array<Record<string, unknown>>;
    otraMisionActiva?: Record<string, unknown> | undefined;
    misionActualizada?: Record<string, unknown> | undefined;
    incidenteActualizado?: Record<string, unknown> | undefined;
    usuario?: Record<string, unknown> | undefined;
    adjuntosVinculados?: Array<Record<string, unknown>>;
  }) {
    let selectMisionCount = 0;
    const insertedReportes: Array<Record<string, unknown>> = [];
    const updatedTables: Array<{ table: string; values: Record<string, unknown> }> = [];
    const insertedHitos: Array<Record<string, unknown>> = [];

    const trx = {
      selectFrom: vi.fn((table: string) => {
        if (table === "mision") {
          selectMisionCount++;
          const currentCall = selectMisionCount;
          const chain: Record<string, unknown> = {};
          chain.leftJoin = vi.fn(() => chain);
          chain.select = vi.fn(() => chain);
          chain.where = vi.fn(() => chain);
          chain.executeTakeFirst = vi.fn(async () =>
            currentCall === 1 ? config.misionExistente : config.otraMisionActiva
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
        if (table === "reporte_terreno") {
          const chain: Record<string, unknown> = {};
          chain.select = vi.fn(() => chain);
          chain.where = vi.fn(() => chain);
          chain.orderBy = vi.fn(() => chain);
          chain.execute = vi.fn(async () => config.reportesPrevios ?? []);
          return chain;
        }
        if (table === "usuario") {
          const chain: Record<string, unknown> = {};
          chain.select = vi.fn(() => chain);
          chain.where = vi.fn(() => chain);
          chain.executeTakeFirst = vi.fn(
            async () =>
              config.usuario ?? {
                nombre: "Líder Patrulla",
                email: "patrulla@valdivia.cl",
                rut: "15.111.222-3",
              }
          );
          return chain;
        }
        return {};
      }),
      insertInto: vi.fn((table: string) => {
        const now = new Date("2026-11-16T00:15:00.000Z");
        return {
          values: vi.fn((vals: Record<string, unknown>) => {
            if (table === "reporte_terreno") {
              insertedReportes.push(vals);
            } else if (table === "mision_hito") {
              insertedHitos.push(vals);
            }
            const returningObj = {
              returningAll: vi.fn(() => ({
                executeTakeFirstOrThrow: vi.fn(async () => ({
                  id:
                    table === "reporte_terreno"
                      ? "e0000000-0000-4000-8000-000000000010"
                      : "70000000-0000-4000-8000-000000000010",
                  ...vals,
                  creado_en: now,
                  actualizado_en: now,
                })),
                executeTakeFirst: vi.fn(async () => ({
                  id: "f0000000-0000-4000-8000-000000000099",
                  ...vals,
                  creado_en: now,
                })),
              })),
            };
            return returningObj;
          }),
        };
      }),
      updateTable: vi.fn((table: string) => ({
        set: vi.fn((vals: Record<string, unknown>) => {
          updatedTables.push({ table, values: vals });
          const chain: Record<string, unknown> = {};
          chain.where = vi.fn(() => chain);
          chain.returningAll = vi.fn(() => chain);
          chain.execute = vi.fn(async () =>
            table === "adjunto" ? config.adjuntosVinculados ?? [] : []
          );
          chain.executeTakeFirst = vi.fn(async () => {
            if (table === "mision") return config.misionActualizada;
            if (table === "adjunto") return config.adjuntosVinculados?.[0];
            return undefined;
          });
          chain.executeTakeFirstOrThrow = vi.fn(async () => {
            if (table === "incidente") return config.incidenteActualizado;
            return {};
          });
          return chain;
        }),
      })),
    };

    vi.mocked(db.transaction).mockReturnValue({
      execute: async <T>(cb: (t: unknown) => Promise<T>) => cb(trx),
    } as never);

    return { trx, insertedReportes, updatedTables, insertedHitos };
  }

  it("debe lanzar NotFoundError si la misión no existe", async () => {
    crearMockTrx({ misionExistente: undefined });

    await expect(
      crearReporteVerificacionYCerrarMisionRepo(misionId, liderId, false, {
        dictamen: "REQUIERE_CUADRILLA",
        resumenTecnico: "Resumen técnico válido con más de diez caracteres.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar ConflictError si la misión aún está en estado DESPACHADA", async () => {
    crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0001",
        estado: "DESPACHADA",
        patrulla_id: patrullaId,
        patrulla_lider_id: liderId,
      },
    });

    await expect(
      crearReporteVerificacionYCerrarMisionRepo(misionId, liderId, false, {
        dictamen: "REQUIERE_CUADRILLA",
        resumenTecnico: "Resumen técnico válido con más de diez caracteres.",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ForbiddenError si el usuario pertenece a otra patrulla verificadora", async () => {
    crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0001",
        estado: "EN_CURSO",
        patrulla_id: patrullaId,
        patrulla_lider_id: "00000000-0000-4000-8000-000000000099",
      },
      integrante: undefined,
    });

    await expect(
      crearReporteVerificacionYCerrarMisionRepo(misionId, liderId, false, {
        dictamen: "REQUIERE_CUADRILLA",
        resumenTecnico: "Resumen técnico válido con más de diez caracteres.",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe rescatar personas_afectadas desde el reporte previo de prioridad (HU-38), persistir reporte FIBE, cerrar misión y liberar patrulla (REQUIERE_CUADRILLA)", async () => {
    const now = new Date("2026-11-16T00:15:00.000Z");
    const { insertedReportes, updatedTables, insertedHitos } = crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0001",
        titulo: "Verificación: Inundación - INC-2026-0001",
        tipo_mision: "VERIFICACION",
        estado: "EN_CURSO",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        patrulla_id: patrullaId,
        fecha_inicio: new Date("2026-11-15T23:30:00.000Z"),
        patrulla_nombre: "Patrulla Costa-1",
        patrulla_estado: "EN_VERIFICACION",
        patrulla_activo: true,
        patrulla_delegacion_id: "30000000-0000-4000-8000-000000000003",
        patrulla_lider_id: liderId,
        incidente_codigo: "INC-2026-0001",
        incidente_estado: "VERIFICANDO",
        incidente_prioridad: "ALTA",
        incidente_prioridad_sugerida: "ALTA",
        incidente_justificacion_prioridad: null,
        incidente_requiere_asistencia_social: false,
      },
      reportesPrevios: [
        {
          id: "e0000000-0000-4000-8000-000000000001",
          tipo_reporte: "EVALUACION_PRIORIDAD",
          personas_afectadas: 5,
          version_reporte: 1,
          detalles_evaluacion: { nucleoFamiliarTotal: 5, cantidadNinos: 2 },
          creado_en: new Date("2026-11-15T23:50:00.000Z"),
        },
      ],
      misionActualizada: {
        id: misionId,
        codigo: "MIS-2026-0001",
        titulo: "Verificación: Inundación - INC-2026-0001",
        tipo_mision: "VERIFICACION",
        estado: "COMPLETADA",
        prioridad: "ALTA",
        incidente_id: incidenteId,
        patrulla_id: patrullaId,
        fecha_inicio: new Date("2026-11-15T23:30:00.000Z"),
        fecha_cierre: now,
        actualizado_en: now,
      },
      incidenteActualizado: {
        id: incidenteId,
        codigo: "INC-2026-0001",
        estado: "VERIFICANDO",
        prioridad: "ALTA",
        requiere_asistencia_social: true,
        fecha_cierre: null,
        motivo_no_abordable: null,
      },
      adjuntosVinculados: [
        {
          id: "f0000000-0000-4000-8000-000000000001",
          nombre_archivo: "foto_terreno.jpg",
          url: "/uploads/evidencia/foto_terreno.jpg",
          tipo_mime: "image/jpeg",
          tamano_bytes: 250000,
          creado_en: now,
        },
      ],
    });

    // Omitimos personasAfectadas para comprobar el rescate automático desde HU-38 (5 personas)
    const res = await crearReporteVerificacionYCerrarMisionRepo(
      misionId,
      liderId,
      false,
      {
        dictamen: "REQUIERE_CUADRILLA",
        resumenTecnico:
          "Ingreso de agua a vivienda de dos pisos; se requiere motobomba de cuadrilla.",
        estadoTerreno: "CRITICO",
        danosEstimados: "Afectación en piso flotante y muebles.",
        observaciones: "Familia permanece en segundo nivel.",
        requiereAsistenciaSocial: true,
        adjuntoIds: ["f0000000-0000-4000-8000-000000000001"],
      }
    );

    expect(insertedReportes[0]).toMatchObject({
      mision_id: misionId,
      evaluador_id: liderId,
      tipo_reporte: "VERIFICACION_CIERRE",
      dictamen: "REQUIERE_CUADRILLA",
      personas_afectadas: 5,
      requiere_asistencia_social: true,
      requiere_apoyo_adicional: true,
      version_reporte: 2,
    });
    expect(res.reporteTerreno.personasAfectadas).toBe(5);
    expect(res.reporteTerreno.detallesEvaluacion.personasAfectadasPrevias).toBe(5);
    expect(res.reporteTerreno.detallesEvaluacion.personasAfectadasModificadas).toBe(false);
    expect(res.reporteTerreno.adjuntos).toHaveLength(1);
    expect(res.mision.estado).toBe("COMPLETADA");
    expect(res.patrulla?.estado).toBe("DISPONIBLE");
    expect(res.incidente?.estado).toBe("VERIFICANDO");
    expect(res.incidente?.requiereAsistenciaSocial).toBe(true);
    expect(updatedTables.some((u) => u.table === "patrulla_verificadora" && u.values.estado === "DISPONIBLE")).toBe(true);
    expect(insertedHitos[0].hito).toBe("VERIFICACION_COMPLETADA");
  });

  it("debe permitir modificar personas_afectadas respecto a HU-38 y ejecutar cierre NO_ABORDABLE con fecha_cierre", async () => {
    const now = new Date("2026-11-16T00:20:00.000Z");
    const { insertedReportes, updatedTables } = crearMockTrx({
      misionExistente: {
        id: misionId,
        codigo: "MIS-2026-0002",
        titulo: "Verificación: Deslizamiento - INC-2026-0002",
        tipo_mision: "VERIFICACION",
        estado: "EN_CURSO",
        prioridad: "MEDIA",
        incidente_id: incidenteId,
        patrulla_id: patrullaId,
        fecha_inicio: new Date("2026-11-15T23:30:00.000Z"),
        patrulla_nombre: "Patrulla Costa-1",
        patrulla_estado: "EN_VERIFICACION",
        patrulla_activo: true,
        patrulla_lider_id: liderId,
        incidente_codigo: "INC-2026-0002",
        incidente_estado: "VERIFICANDO",
        incidente_prioridad: "MEDIA",
        incidente_requiere_asistencia_social: false,
      },
      reportesPrevios: [
        {
          id: "e0000000-0000-4000-8000-000000000001",
          tipo_reporte: "EVALUACION_PRIORIDAD",
          personas_afectadas: 3,
          version_reporte: 1,
          detalles_evaluacion: { nucleoFamiliarTotal: 3 },
          creado_en: new Date("2026-11-15T23:50:00.000Z"),
        },
      ],
      misionActualizada: {
        id: misionId,
        codigo: "MIS-2026-0002",
        titulo: "Verificación: Deslizamiento - INC-2026-0002",
        tipo_mision: "VERIFICACION",
        estado: "COMPLETADA",
        prioridad: "MEDIA",
        incidente_id: incidenteId,
        patrulla_id: patrullaId,
        fecha_inicio: new Date("2026-11-15T23:30:00.000Z"),
        fecha_cierre: now,
        actualizado_en: now,
      },
      incidenteActualizado: {
        id: incidenteId,
        codigo: "INC-2026-0002",
        estado: "NO_ABORDABLE",
        prioridad: "MEDIA",
        requiere_asistencia_social: false,
        fecha_cierre: now,
        motivo_no_abordable:
          "Emergencia ocurre al interior de faja fiscal concesionada de MOP sin competencia municipal.",
      },
    });

    const res = await crearReporteVerificacionYCerrarMisionRepo(
      misionId,
      liderId,
      false,
      {
        dictamen: "NO_ABORDABLE",
        motivoNoAbordable:
          "Emergencia ocurre al interior de faja fiscal concesionada de MOP sin competencia municipal.",
        resumenTecnico:
          "Inspección visual confirma afectación exclusiva dentro de faja concesionada externa.",
        estadoTerreno: "INACCESIBLE",
        personasAfectadas: 0,
        requiereAsistenciaSocial: false,
      }
    );

    expect(insertedReportes[0].personas_afectadas).toBe(0);
    expect(res.reporteTerreno.detallesEvaluacion.personasAfectadasPrevias).toBe(3);
    expect(res.reporteTerreno.detallesEvaluacion.personasAfectadasModificadas).toBe(true);
    expect(res.mision.estado).toBe("COMPLETADA");
    expect(res.patrulla?.estado).toBe("DISPONIBLE");
    expect(res.incidente?.estado).toBe("NO_ABORDABLE");
    expect(res.incidente?.fechaCierre).toBe(now.toISOString());
    expect(res.incidente?.motivoNoAbordable).toContain("faja fiscal concesionada");
    const updateInc = updatedTables.find((u) => u.table === "incidente");
    expect(updateInc?.values.estado).toBe("NO_ABORDABLE");
  });
});
