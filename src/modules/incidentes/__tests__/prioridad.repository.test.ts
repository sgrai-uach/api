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
            executeTakeFirstOrThrow: vi.fn().mockRejectedValueOnce(new Error("duplicate key uq_reporte_terreno_mision_version")),
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
});
