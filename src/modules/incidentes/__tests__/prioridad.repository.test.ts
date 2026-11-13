import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrioridadRepository } from "../prioridad.repository";
import { db } from "@/lib/db";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";

describe("PrioridadRepository (HU-38)", () => {
  let repo: PrioridadRepository;

  const incidenteId = "50000000-0000-4000-8000-000000000001";
  const usuarioId = "00000000-0000-4000-8000-000000000004";
  const misionId = "60000000-0000-4000-8000-000000000001";
  const patrullaId = "80000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrioridadRepository();
  });

  it("debe lanzar NotFoundError si el incidente no existe", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValueOnce(null),
          }),
        }),
      }),
    };

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => {
        return await cb(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    await expect(
      repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
        prioridad: "ALTA",
        prioridadSugerida: "ALTA",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar ConflictError si la misión se encuentra en estado DESPACHADA (no aceptada)", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValueOnce({
                  id: incidenteId,
                  codigo: "INC-2026-001",
                  estado: "VERIFICANDO",
                  prioridad: "MEDIA",
                  prioridad_sugerida: "MEDIA",
                }),
              }),
            }),
          };
        }
        if (table === "mision") {
          return {
            leftJoin: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValueOnce([
                    {
                      id: misionId,
                      codigo: "MIS-2026-001",
                      estado: "DESPACHADA",
                      tipo_mision: "VERIFICACION",
                      patrulla_id: patrullaId,
                      patrulla_lider_id: usuarioId,
                    },
                  ]),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => {
        return await cb(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    await expect(
      repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
        prioridad: "ALTA",
        justificacionPrioridad: "Riesgo constatado en terreno.",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ForbiddenError si el funcionario no pertenece a la patrulla verificadora asignada", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValueOnce({
                  id: incidenteId,
                  codigo: "INC-2026-001",
                  estado: "VERIFICANDO",
                  prioridad: "MEDIA",
                }),
              }),
            }),
          };
        }
        if (table === "mision") {
          return {
            leftJoin: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValueOnce([
                    {
                      id: misionId,
                      codigo: "MIS-2026-001",
                      estado: "EN_CURSO",
                      tipo_mision: "VERIFICACION",
                      patrulla_id: patrullaId,
                      patrulla_lider_id: "00000000-0000-4000-8000-000000000099",
                    },
                  ]),
                }),
              }),
            }),
          };
        }
        if (table === "patrulla_personal") {
          return {
            innerJoin: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    executeTakeFirst: vi.fn().mockResolvedValueOnce(null),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => {
        return await cb(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    await expect(
      repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
        prioridad: "MEDIA",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe lanzar BadRequestError si se modifica la prioridad_sugerida almacenada en BD sin justificación de al menos 5 caracteres", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValueOnce({
                  id: incidenteId,
                  codigo: "INC-2026-001",
                  estado: "VERIFICANDO",
                  prioridad: "MEDIA",
                  prioridad_sugerida: "MEDIA",
                }),
              }),
            }),
          };
        }
        if (table === "mision") {
          return {
            leftJoin: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValueOnce([
                    {
                      id: misionId,
                      codigo: "MIS-2026-001",
                      estado: "EN_CURSO",
                      tipo_mision: "VERIFICACION",
                      patrulla_id: patrullaId,
                      patrulla_lider_id: usuarioId,
                    },
                  ]),
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => {
        return await cb(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    await expect(
      repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
        prioridad: "CRITICA",
        // Sin justificación cuando prioridad_sugerida en BD es MEDIA
      })
    ).rejects.toThrow(BadRequestError);
  });

  it("debe actualizar incidente, crear reporte_terreno versionado (#1 inicial y #2 rectificación) y registrar hito en mision_hito", async () => {
    let conteoReportesMock = 0;

    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "incidente") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue({
                  id: incidenteId,
                  codigo: "INC-2026-001",
                  estado: "VERIFICANDO",
                  prioridad: "MEDIA",
                  prioridad_sugerida: "MEDIA",
                  requiere_asistencia_social: false,
                }),
              }),
            }),
          };
        }
        if (table === "mision") {
          return {
            leftJoin: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  execute: vi.fn().mockResolvedValue([
                    {
                      id: misionId,
                      codigo: "MIS-2026-001",
                      estado: "EN_CURSO",
                      tipo_mision: "VERIFICACION",
                      patrulla_id: patrullaId,
                      patrulla_lider_id: usuarioId,
                      fecha_inicio: new Date("2026-11-11T20:00:00Z"),
                    },
                  ]),
                }),
              }),
            }),
          };
        }
        if (table === "reporte_terreno") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockImplementation(async () => ({
                  total: conteoReportesMock,
                })),
              }),
            }),
          };
        }
        if (table === "usuario") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValue({
                  nombre: "Líder Patrulla",
                  email: "lider@valdivia.cl",
                  rut: "15.111.222-3",
                }),
              }),
            }),
          };
        }
        return {};
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
                    requiere_asistencia_social: valores.requiere_asistencia_social,
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
      insertInto: vi.fn().mockImplementation((table: string) => {
        if (table === "reporte_terreno") {
          return {
            values: vi.fn().mockImplementation((vals: Record<string, unknown>) => ({
              returningAll: vi.fn().mockReturnValue({
                executeTakeFirstOrThrow: vi.fn().mockImplementation(async () => {
                  conteoReportesMock += 1;
                  return {
                    id: `e0000000-0000-4000-8000-00000000000${conteoReportesMock}`,
                    ...vals,
                    creado_en: new Date("2026-11-11T22:00:00Z"),
                  };
                }),
              }),
            })),
          };
        }
        if (table === "mision_hito") {
          return {
            values: vi.fn().mockImplementation((vals: Record<string, unknown>) => ({
              returningAll: vi.fn().mockReturnValue({
                executeTakeFirstOrThrow: vi.fn().mockResolvedValue({
                  id: "70000000-0000-4000-8000-000000000010",
                  ...vals,
                  creado_en: new Date("2026-11-11T22:00:00Z"),
                }),
              }),
            })),
          };
        }
        return {};
      }),
    };

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => {
        return await cb(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

    // 1er envío: Reporte #1 (Inicial) modificando prioridad sugerida MEDIA a ALTA con justificación
    const res1 = await repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
      prioridad: "ALTA",
      justificacionPrioridad:
        "Aumento rápido del caudal hacia acceso principal de vivienda con niños.",
      evaluacion: {
        nucleoFamiliarTotal: 3,
        cantidadNinos: 1,
        mascotasAfectadas: 2,
        nivelCompromisoVivienda: "LEVE",
        detallesAdicionales: "Se requiere monitoreo y sacos de arena.",
      },
    });

    expect(res1.incidente.prioridad).toBe("ALTA");
    expect(res1.incidente.prioridadSugerida).toBe("MEDIA");
    expect(res1.incidente.modificoPrioridadSugerida).toBe(true);
    expect(res1.reporteTerreno.versionReporte).toBe(1);
    expect(res1.reporteTerreno.esRectificacion).toBe(false);
    expect(res1.hito.hito).toBe("PRIORIDAD_ASIGNADA");

    // 2do envío (modificación y reenvío al Centro de Mando): Reporte #2 (Rectificación)
    const res2 = await repo.actualizarPrioridadIncidente(incidenteId, usuarioId, false, {
      prioridad: "CRITICA",
      evaluacion: {
        nucleoFamiliarTotal: 4,
        cantidadNinos: 1,
        personasElectrodependientes: 1, // Dispara prioridad sugerida CRITICA
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

