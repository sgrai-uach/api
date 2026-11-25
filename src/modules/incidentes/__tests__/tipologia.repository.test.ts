import { describe, it, expect, vi, beforeEach } from "vitest";
import { TipologiaRepository } from "../tipologia.repository";
import { db } from "@/lib/db";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
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

describe("TipologiaRepository (HU-37)", () => {
  let repo: TipologiaRepository;

  const incidenteId = "50000000-0000-4000-8000-000000000001";
  const usuarioId = "00000000-0000-4000-8000-000000000004";
  const tipoIncidenteId = "40000000-0000-4000-8000-000000000001";
  const misionId = "60000000-0000-4000-8000-000000000001";
  const patrullaId = "80000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new TipologiaRepository();
  });

  function mockTransaction(mockTrx: Record<string, unknown>) {
    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => {
        return await cb(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);
  }

  it("debe lanzar NotFoundError si el tipo de incidente no existe en BD", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockReturnValue(createSelectChain({ executeTakeFirst: null })),
    });

    await expect(
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar BadRequestError si el tipo de incidente no está activo", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockReturnValue(
        createSelectChain({
          executeTakeFirst: {
            id: tipoIncidenteId,
            nombre: "Tipo Inactivo",
            activo: false,
          },
        })
      ),
    });

    await expect(
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(BadRequestError);
  });

  it("debe lanzar NotFoundError si el incidente no existe", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return createSelectChain({
            executeTakeFirst: { id: tipoIncidenteId, nombre: "Inundación", activo: true },
          });
        }
        if (table === "incidente") {
          return createSelectChain({ executeTakeFirst: null });
        }
        return {};
      }),
    });

    await expect(
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar ConflictError si el incidente está en estado RESUELTO o EN_ATENCION", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return createSelectChain({
            executeTakeFirst: { id: tipoIncidenteId, nombre: "Inundación", activo: true },
          });
        }
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-001",
              estado: "RESUELTO",
              prioridad: "MEDIA",
            },
          });
        }
        return {};
      }),
    });

    await expect(
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ConflictError si la misión asociada no ha sido aceptada todavía (se encuentra en DESPACHADA)", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return createSelectChain({
            executeTakeFirst: { id: tipoIncidenteId, nombre: "Inundación", activo: true },
          });
        }
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-001",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
              tipo_incidente_id: "40000000-0000-4000-8000-000000000006",
              tipo_afectacion: "Otro",
            },
          });
        }
        if (table === "mision") {
          return createSelectChain({
            execute: [
              {
                id: misionId,
                codigo: "MIS-2026-001",
                estado: "DESPACHADA",
                tipo_mision: "VERIFICACION",
                patrulla_id: patrullaId,
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
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ConflictError si la misión de verificación no tiene patrulla_id asignada", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return createSelectChain({
            executeTakeFirst: { id: tipoIncidenteId, nombre: "Inundación", activo: true },
          });
        }
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-001",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
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
                patrulla_id: null,
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
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ConflictError si la patrulla verificadora está desactivada o dada de baja lógica", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return createSelectChain({
            executeTakeFirst: { id: tipoIncidenteId, nombre: "Inundación", activo: true },
          });
        }
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-001",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
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
                patrulla_activo: false,
                patrulla_eliminado_en: new Date("2026-11-01T00:00:00Z"),
                patrulla_lider_id: usuarioId,
              },
            ],
          });
        }
        return {};
      }),
    });

    await expect(
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ForbiddenError si el usuario evaluador no pertenece a la patrulla asignada", async () => {
    mockTransaction({
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return createSelectChain({
            executeTakeFirst: { id: tipoIncidenteId, nombre: "Inundación", activo: true },
          });
        }
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-001",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
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
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe ejecutar exitosamente la transacción actualizando incidente e insertando en mision_hito", async () => {
    const updateExecuteTakeFirstOrThrow = vi.fn().mockResolvedValueOnce({
      id: incidenteId,
      codigo: "INC-2026-001",
      estado: "VERIFICANDO",
      prioridad: "MEDIA",
      tipo_incidente_id: tipoIncidenteId,
      tipo_afectacion: "Inundación",
      actualizado_en: new Date("2026-11-10T03:00:00Z"),
    });

    const insertExecuteTakeFirstOrThrow = vi.fn().mockResolvedValueOnce({
      id: "70000000-0000-4000-8000-000000000001",
      mision_id: misionId,
      hito: "TIPOLOGIA_RECLASIFICADA",
      descripcion:
        "Tipología reclasificada en terreno a: Inundación. Justificación: Constatación presencial de desborde.",
      registrado_por_id: usuarioId,
      creado_en: new Date("2026-11-10T03:00:00Z"),
    });

    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return createSelectChain({
            executeTakeFirst: { id: tipoIncidenteId, nombre: "Inundación", activo: true },
          });
        }
        if (table === "incidente") {
          return createSelectChain({
            executeTakeFirst: {
              id: incidenteId,
              codigo: "INC-2026-001",
              estado: "VERIFICANDO",
              prioridad: "MEDIA",
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
                patrulla_activo: true,
                patrulla_eliminado_en: null,
                patrulla_lider_id: usuarioId,
              },
            ],
          });
        }
        return {};
      }),
      updateTable: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returningAll: vi.fn().mockReturnValue({
              executeTakeFirstOrThrow: updateExecuteTakeFirstOrThrow,
            }),
          }),
        }),
      }),
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returningAll: vi.fn().mockReturnValue({
            executeTakeFirstOrThrow: insertExecuteTakeFirstOrThrow,
          }),
        }),
      }),
    };

    mockTransaction(mockTrx);

    const res = await repo.reclasificarTipologia(incidenteId, usuarioId, false, {
      tipoIncidenteId,
      justificacion: "Constatación presencial de desborde.",
    });

    expect(mockTrx.updateTable).toHaveBeenCalledWith("incidente");
    expect(mockTrx.insertInto).toHaveBeenCalledWith("mision_hito");
    expect(res.incidente.tipoAfectacion).toBe("Inundación");
    expect(res.hito.descripcion).toBe(
      "Tipología reclasificada en terreno a: Inundación. Justificación: Constatación presencial de desborde."
    );
  });
});
