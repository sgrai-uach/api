/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import {
  actualizarEventoAtpDeEntidades,
  desvincularEntidadesDelEvento,
  obtenerEntidadesExistentes,
} from "../vinculacion.repository";

vi.mock("@/lib/db", () => ({ db: {} }));

const grupos = {
  incidenteIds: ["a0000000-0000-4000-8000-000000000001"],
  eventoPrevencionIds: ["b0000000-0000-4000-8000-000000000001"],
  recuperacionIds: ["c0000000-0000-4000-8000-000000000001"],
  eventoAsistenciaSocialIds: ["d0000000-0000-4000-8000-000000000001"],
};

function crearConsultaFalsa(filas: any[]) {
  const cadena = {
    select: vi.fn(() => cadena),
    where: vi.fn(() => cadena),
    orderBy: vi.fn(() => cadena),
    forUpdate: vi.fn(() => cadena),
    execute: vi.fn(async () => filas),
  };
  return cadena;
}

function crearTrxFalso() {
  const consultas: Record<string, ReturnType<typeof crearConsultaFalsa>> = {};
  const updates: Array<{ tabla: string; set: any; returning: any }> = [];

  const trx = {
    selectFrom: vi.fn((tabla: string) => {
      const filasPorTabla: Record<string, any[]> = {
        incidente: [
          {
            id: grupos.incidenteIds[0],
            codigo: "INC-1",
            tipo_afectacion: "Inundación",
            evento_atp_id: null,
          },
        ],
        evento_prevencion: [
          {
            id: grupos.eventoPrevencionIds[0],
            codigo: "PREV-1",
            nombre: "Prevención",
            evento_atp_id: null,
          },
        ],
        recuperacion: [
          {
            id: grupos.recuperacionIds[0],
            codigo: "REC-1",
            nombre: "Recuperación",
            evento_atp_id: null,
          },
        ],
        evento_asistencia_social: [
          {
            id: grupos.eventoAsistenciaSocialIds[0],
            codigo: "AS-1",
            tipo_afectacion: "Social",
            evento_atp_id: null,
          },
        ],
      };
      const consulta = crearConsultaFalsa(filasPorTabla[tabla] ?? []);
      consultas[tabla] = consulta;
      return consulta;
    }),
    updateTable: vi.fn((tabla: string) => {
      const update = {
        set: vi.fn((valores: any) => {
          const entrada = { tabla, set: valores, returning: null as any };
          updates.push(entrada);

          const cadena: any = {
            where: vi.fn(() => cadena),
            returning: vi.fn((columnas: any) => {
              entrada.returning = columnas;
              return { execute: vi.fn(async () => []) };
            }),
          };

          return cadena;
        }),
      };
      return update;
    }),
  };

  return { trx, consultas, updates };
}

describe("vinculacion.repository - bloqueos y auditoría (H60)", () => {
  it("bloquea las cuatro tablas con FOR UPDATE y orden determinista", async () => {
    const { trx, consultas } = crearTrxFalso();

    const filas = await obtenerEntidadesExistentes(trx as any, grupos);

    expect(filas).toHaveLength(4);
    for (const tabla of [
      "incidente",
      "evento_prevencion",
      "recuperacion",
      "evento_asistencia_social",
    ]) {
      expect(consultas[tabla].orderBy).toHaveBeenCalledWith("id", "asc");
      expect(consultas[tabla].forUpdate).toHaveBeenCalled();
    }
  });

  it("actualiza evento_atp_id y actualizado_en con RETURNING", async () => {
    const { trx, updates } = crearTrxFalso();

    await actualizarEventoAtpDeEntidades(
      trx as any,
      "50000000-0000-4000-8000-000000000001",
      grupos
    );

    expect(updates).toHaveLength(4);
    for (const update of updates) {
      expect(update.set.evento_atp_id).toBe(
        "50000000-0000-4000-8000-000000000001"
      );
      expect(update.set.actualizado_en).toBeInstanceOf(Date);
      expect(update.returning).toContain("evento_atp_id");
    }
  });

  it("desvincula con NULL y actualiza actualizado_en", async () => {
    const { trx, updates } = crearTrxFalso();

    await desvincularEntidadesDelEvento(
      trx as any,
      "50000000-0000-4000-8000-000000000001",
      grupos
    );

    expect(updates).toHaveLength(4);
    for (const update of updates) {
      expect(update.set.evento_atp_id).toBeNull();
      expect(update.set.actualizado_en).toBeInstanceOf(Date);
    }
  });
});
