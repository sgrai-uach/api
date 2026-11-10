import { describe, it, expect, vi, beforeEach } from "vitest";
import { TipologiaRepository } from "../tipologia.repository";
import { db } from "@/lib/db";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";

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

  it("debe lanzar NotFoundError si el tipo de incidente no existe en BD", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValueOnce(null), // tipo_incidente no existe
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
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar BadRequestError si el tipo de incidente no está activo", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValueOnce({
              id: tipoIncidenteId,
              nombre: "Tipo Inactivo",
              activo: false,
            }),
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
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(BadRequestError);
  });

  it("debe lanzar NotFoundError si el incidente no existe", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValueOnce({
                  id: tipoIncidenteId,
                  nombre: "Inundación",
                  activo: true,
                }),
              }),
            }),
          };
        }
        if (table === "incidente") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValueOnce(null), // incidente no existe
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
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("debe lanzar ConflictError si la misión asociada no ha sido aceptada todavía (se encuentra en DESPACHADA)", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValueOnce({
                  id: tipoIncidenteId,
                  nombre: "Inundación",
                  activo: true,
                }),
              }),
            }),
          };
        }
        if (table === "incidente") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValueOnce({
                  id: incidenteId,
                  codigo: "INC-2026-001",
                  estado: "VERIFICANDO",
                  prioridad: "MEDIA",
                  tipo_incidente_id: "40000000-0000-4000-8000-000000000006",
                  tipo_afectacion: "Otro",
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
                      estado: "DESPACHADA", // Aún no aceptada
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
      repo.reclasificarTipologia(incidenteId, usuarioId, false, {
        tipoIncidenteId,
        justificacion: "Justificación de prueba válida.",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("debe lanzar ForbiddenError si el usuario evaluador no pertenece a la patrulla asignada", async () => {
    const mockTrx = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === "tipo_incidente") {
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValueOnce({
                  id: tipoIncidenteId,
                  nombre: "Inundación",
                  activo: true,
                }),
              }),
            }),
          };
        }
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
                      patrulla_lider_id: "otro-lider-uuid",
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
                    executeTakeFirst: vi.fn().mockResolvedValueOnce(null), // No es miembro
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
          return {
            select: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                executeTakeFirst: vi.fn().mockResolvedValueOnce({
                  id: tipoIncidenteId,
                  nombre: "Inundación",
                  activo: true,
                }),
              }),
            }),
          };
        }
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
                      patrulla_lider_id: usuarioId, // Es el líder
                    },
                  ]),
                }),
              }),
            }),
          };
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

    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => {
        return await cb(mockTrx);
      }),
    } as unknown as ReturnType<typeof db.transaction>);

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

