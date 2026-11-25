import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrioridadRepository } from "../prioridad.repository";
import { db } from "@/lib/db";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "@/modules/seguridad/errors";

function createSelectChain(result: { executeTakeFirst?: unknown; execute?: unknown[] }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn().mockImplementation(self);
  chain.leftJoin = vi.fn().mockImplementation(self);
  chain.innerJoin = vi.fn().mockImplementation(self);
  chain.where = vi.fn().mockImplementation(self);
  chain.orderBy = vi.fn().mockImplementation(self);
  chain.forUpdate = vi.fn().mockImplementation(self);
  chain.executeTakeFirst = vi.fn().mockResolvedValueOnce(result.executeTakeFirst);
  chain.execute = vi.fn().mockResolvedValueOnce(result.execute ?? []);
  return chain;
}

describe("PrioridadRepository (HU-38 - Reglas de seguridad y concurrencia)", () => {
  let repo: PrioridadRepository;
  const incidenteId = "a1000000-0000-4000-8000-000000000004";
  const usuarioId = "d1000000-0000-4000-8000-000000000001";
  const misionId = "60000000-0000-4000-8000-000000000001";
  const patrullaId = "80000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrioridadRepository();
  });

  function mockTransaction(mockTrx: Record<string, unknown>) {
    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => {
        return await cb(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);
  }

  it("debe rechazar con ConflictError si el incidente está en estado RESUELTO en calcularPrioridadPreliminar (BUG-H38-API-02)", async () => {
    vi.spyOn(db, "selectFrom").mockReturnValue(
      createSelectChain({
        executeTakeFirst: {
          id: incidenteId,
          estado: "RESUELTO",
          prioridad: "MEDIA",
          prioridad_sugerida: "MEDIA",
        },
      }) as unknown as ReturnType<typeof db.selectFrom>
    );

    await expect(
      repo.calcularPrioridadPreliminar(incidenteId, { nucleoFamiliarTotal: 2 }, usuarioId, false)
    ).rejects.toThrow(ConflictError);
  });

  it("debe rechazar con ConflictError si la misión de verificación tiene patrulla_id = null (BUG-H38-API-02)", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-0004",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
              prioridad_sugerida: "MEDIA",
              justificacion_prioridad: null,
              requiere_asistencia_social: false,
              tipo_incidente_id: null,
              tipo_afectacion: "Inundación",
            },
          });
        }
        if (table === "mision") {
          return createSelectChain({
            execute: [
              {
                id: misionId,
                codigo: "MIS-2026-0002",
                estado: "EN_CURSO",
                tipo_mision: "VERIFICACION",
                patrulla_id: null,
                fecha_inicio: new Date(),
                patrulla_activo: null,
                patrulla_eliminado_en: null,
                patrulla_lider_id: null,
              },
            ],
          });
        }
        return {};
      }),
    });

    await expect(
      repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
        prioridad: "MEDIA",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("debe rechazar con ForbiddenError si el usuario no pertenece a la patrulla asignada (BUG-H38-API-02)", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-0004",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
              prioridad_sugerida: "MEDIA",
              justificacion_prioridad: null,
              requiere_asistencia_social: false,
              tipo_incidente_id: null,
              tipo_afectacion: "Inundación",
            },
          });
        }
        if (table === "mision") {
          return createSelectChain({
            execute: [
              {
                id: misionId,
                codigo: "MIS-2026-0001",
                estado: "EN_CURSO",
                tipo_mision: "VERIFICACION",
                patrulla_id: patrullaId,
                fecha_inicio: new Date(),
                patrulla_activo: true,
                patrulla_eliminado_en: null,
                patrulla_lider_id: "otro-lider-uuid",
              },
            ],
          });
        }
        if (table === "patrulla_personal") {
          return createSelectChain({ executeTakeFirst: null });
        }
        return {};
      }),
    });

    await expect(
      repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
        prioridad: "MEDIA",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe calcular autoritativamente prioridadSugerida desde familias en raíz y rechazar sin justificacion_prioridad (BUG-H38-API-01)", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-0004",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
              prioridad_sugerida: "MEDIA",
              justificacion_prioridad: null,
              requiere_asistencia_social: false,
              tipo_incidente_id: null,
              tipo_afectacion: "Inundación",
            },
          });
        }
        if (table === "mision") {
          return createSelectChain({
            execute: [
              {
                id: misionId,
                codigo: "MIS-2026-0001",
                estado: "EN_CURSO",
                tipo_mision: "VERIFICACION",
                patrulla_id: patrullaId,
                fecha_inicio: new Date(),
                patrulla_activo: true,
                patrulla_eliminado_en: null,
                patrulla_lider_id: usuarioId,
              },
            ],
          });
        }
        return {};
      }),
    });

    await expect(
      repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
        prioridad: "BAJA",
        prioridadSugerida: "BAJA",
        familias: [{ nucleoFamiliarTotal: 3, personasElectrodependientes: 1 }],
      })
    ).rejects.toThrow(BadRequestError);
  });

  it("debe propagar errores SQL en reporte_terreno sin silenciar con ID ficticio (BUG-H38-API-04)", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-0004",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
              prioridad_sugerida: "MEDIA",
              justificacion_prioridad: null,
              requiere_asistencia_social: false,
              tipo_incidente_id: null,
              tipo_afectacion: "Inundación",
            },
          });
        }
        if (table === "mision") {
          return createSelectChain({
            execute: [
              {
                id: misionId,
                codigo: "MIS-2026-0001",
                estado: "EN_CURSO",
                tipo_mision: "VERIFICACION",
                patrulla_id: patrullaId,
                fecha_inicio: new Date(),
                patrulla_activo: true,
                patrulla_eliminado_en: null,
                patrulla_lider_id: usuarioId,
              },
            ],
          });
        }
        if (table === "reporte_terreno") {
          return createSelectChain({ executeTakeFirst: { max_version: 0 } });
        }
        if (table === "usuario") {
          return createSelectChain({
            executeTakeFirst: { nombre: "Patrullero", email: "p@valdivia.cl", rut: null },
          });
        }
        return {};
      }),
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returningAll: vi.fn().mockReturnValue({
            executeTakeFirstOrThrow: vi
              .fn()
              .mockRejectedValueOnce(new Error("duplicate key uq_reporte_terreno_mision_version")),
          }),
        }),
      }),
    });

    await expect(
      repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
        prioridad: "MEDIA",
      })
    ).rejects.toThrow("duplicate key uq_reporte_terreno_mision_version");
  });

  it("debe registrar reportes versionados #1 (Inicial) y #2 (Rectificación) sin requerir FIBE en HU-38", async () => {
    let maxVersion = 0;

    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-001",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
              prioridad_sugerida: "MEDIA",
              justificacion_prioridad: null,
              requiere_asistencia_social: false,
              tipo_incidente_id: null,
              tipo_afectacion: "Inundación",
            },
          });
        }
        if (table === "mision") {
          return createSelectChain({
            execute: [
              {
                id: misionId,
                codigo: "MIS-2026-001",
                estado: "EN_CURSO",
                tipo_mision: "VERIFICACION",
                patrulla_id: patrullaId,
                fecha_inicio: new Date(),
                patrulla_activo: true,
                patrulla_eliminado_en: null,
                patrulla_lider_id: usuarioId,
              },
            ],
          });
        }
        if (table === "reporte_terreno") {
          return createSelectChain({ executeTakeFirst: { max_version: maxVersion } });
        }
        if (table === "usuario") {
          return createSelectChain({
            executeTakeFirst: { nombre: "Patrullero", email: "p@valdivia.cl", rut: null },
          });
        }
        return {};
      }),
      insertInto: vi.fn().mockImplementation((table: string) => {
        if (table === "reporte_terreno") {
          return {
            values: vi.fn().mockImplementation((valores: Record<string, unknown>) => ({
              returningAll: vi.fn().mockReturnValue({
                executeTakeFirstOrThrow: vi.fn().mockImplementation(async () => {
                  maxVersion = Number(valores.version_reporte ?? 1);
                  return {
                    id: `e0000000-0000-4000-8000-00000000000${maxVersion}`,
                    mision_id: misionId,
                    version_reporte: valores.version_reporte,
                    es_rectificacion: valores.es_rectificacion,
                    prioridad_sugerida: valores.prioridad_sugerida,
                    prioridad_asignada: valores.prioridad_asignada,
                    justificacion_prioridad: valores.justificacion_prioridad,
                    resumen_tecnico: valores.resumen_tecnico,
                    personas_afectadas: valores.personas_afectadas,
                    requiere_apoyo_adicional: valores.requiere_apoyo_adicional,
                    observaciones: valores.observaciones,
                    acciones_realizadas: valores.acciones_realizadas,
                    danos_estimados: valores.danos_estimados,
                    detalles_evaluacion: valores.detalles_evaluacion,
                    creado_en: new Date("2026-11-11T22:00:00Z"),
                  };
                }),
              }),
            })),
          };
        }
        return {
          values: vi.fn().mockImplementation((valores: Record<string, unknown>) => ({
            returningAll: vi.fn().mockReturnValue({
              executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
                id: "h0000000-0000-4000-8000-000000000001",
                hito: valores.hito,
                descripcion: valores.descripcion,
                creado_en: new Date("2026-11-11T22:00:00Z"),
              }),
            }),
          })),
        };
      }),
      updateTable: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return {
            set: vi.fn().mockImplementation((valores: Record<string, unknown>) => ({
              where: vi.fn().mockReturnValue({
                returningAll: vi.fn().mockReturnValue({
                  executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
                    id: incidenteId,
                    codigo: "INC-2026-001",
                    estado: "VERIFICANDO",
                    prioridad: valores.prioridad,
                    prioridad_sugerida: valores.prioridad_sugerida,
                    justificacion_prioridad: valores.justificacion_prioridad,
                    requiere_asistencia_social: false,
                    actualizado_en: new Date("2026-11-11T22:00:00Z"),
                  }),
                }),
              }),
            })),
          };
        }
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue({}),
            }),
          }),
        };
      }),
    });

    const res1 = await repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
      prioridad: "ALTA",
      justificacion: "Requiere atención prioritaria por vulnerabilidad",
      evaluacion: {
        nucleoFamiliarTotal: 3,
        cantidadNinos: 1,
        nivelCompromisoVivienda: "LEVE",
      },
    });

    expect(res1.incidente.prioridad).toBe("ALTA");
    expect(res1.incidente.modificoPrioridadSugerida).toBe(true);
    expect(res1.incidente.requiereAsistenciaSocial).toBe(false);
    expect(res1.reporteTerreno.versionReporte).toBe(1);
    expect(res1.reporteTerreno.esRectificacion).toBe(false);
    expect(res1.hito.hito).toBe("PRIORIDAD_ASIGNADA");

    const res2 = await repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
      prioridad: "CRITICA",
      evaluacion: {
        nucleoFamiliarTotal: 4,
        cantidadNinos: 1,
        personasElectrodependientes: 1,
        mascotasAfectadas: 2,
        nivelCompromisoVivienda: "MODERADO",
        detallesAdicionales: "Se identificó paciente electrodependiente en dormitorio interior.",
      },
    });

    expect(res2.incidente.prioridad).toBe("CRITICA");
    expect(res2.incidente.prioridadSugerida).toBe("CRITICA");
    expect(res2.reporteTerreno.versionReporte).toBe(2);
    expect(res2.reporteTerreno.esRectificacion).toBe(true);
    expect(res2.reporteTerreno.etiquetaReporte).toContain("Reporte de Evaluación #2 (Rectificación)");
    expect(res2.hito.hito).toBe("PRIORIDAD_RECTIFICADA");
  });
});
