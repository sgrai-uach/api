/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { insertarEventoAtpConDelegaciones } from "../evento-atp.repository";

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

interface InsercionCapturada {
  tabla: string;
  valores: any;
}

function crearTransaccionFalsa(opciones?: {
  fallarEnPuente?: boolean;
  delegaciones?: any[];
}) {
  const inserciones: InsercionCapturada[] = [];

  const trx = {
    insertInto: vi.fn((tabla: string) => {
      if (tabla === "evento_atp") {
        return {
          values: vi.fn((valores: any) => {
            inserciones.push({ tabla, valores });
            return {
              returningAll: () => ({
                executeTakeFirstOrThrow: async () => ({
                  id: "50000000-0000-4000-8000-000000000001",
                  ...valores,
                  creado_en: new Date("2026-05-01T09:55:00.000Z"),
                  actualizado_en: new Date("2026-05-01T09:55:00.000Z"),
                }),
              }),
            };
          }),
        };
      }

      return {
        values: vi.fn((valores: any) => {
          if (opciones?.fallarEnPuente) {
            throw new Error("Fallo simulado en evento_atp_delegacion");
          }
          inserciones.push({ tabla, valores });
          return { execute: async () => undefined };
        }),
      };
    }),
    selectFrom: vi.fn(() => ({
      innerJoin: () => ({
        select: () => ({
          where: () => ({
            orderBy: () => ({
              execute: async () => opciones?.delegaciones ?? [],
            }),
          }),
        }),
      }),
    })),
  };

  return { trx, inserciones };
}

function configurarTransaccion(trx: any) {
  vi.mocked(db.transaction).mockReturnValue({
    execute: async (callback: (t: any) => Promise<unknown>) => callback(trx),
  } as any);
}

const datosBase = {
  codigo: "ATP-2026-0001",
  nombre: "Sistema Frontal Mayo 2026",
  descripcion:
    "Sistema frontal con precipitaciones intensas y vientos moderados a fuertes durante 48 horas.",
  tipoAmenaza: "METEOROLOGICA" as const,
  nivelAlerta: "AMARILLA" as const,
  fechaInicio: new Date("2026-05-01T10:00:00.000Z"),
  fechaTermino: new Date("2026-05-03T18:00:00.000Z"),
  delegacionIds: ["30000000-0000-4000-8000-000000000001"],
  creadoPorId: "00000000-0000-4000-8000-000000000001",
};

const delegacion = {
  id: "30000000-0000-4000-8000-000000000001",
  codigo: "DEL_NORTE",
  nombre: "Delegación Municipal Norte",
};

describe("evento-atp.repository - Transacción atómica (H61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe insertar evento_atp y evento_atp_delegacion dentro de la misma transacción", async () => {
    const { trx, inserciones } = crearTransaccionFalsa({
      delegaciones: [delegacion],
    });
    configurarTransaccion(trx);

    const resultado = await insertarEventoAtpConDelegaciones(datosBase);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(inserciones.map((i) => i.tabla)).toEqual([
      "evento_atp",
      "evento_atp_delegacion",
    ]);
    expect(inserciones[1].valores).toEqual([
      {
        evento_atp_id: "50000000-0000-4000-8000-000000000001",
        delegacion_id: "30000000-0000-4000-8000-000000000001",
      },
    ]);
    expect(resultado.evento.codigo).toBe("ATP-2026-0001");
    expect(resultado.delegaciones).toEqual([delegacion]);
  });

  it("no debe insertar en la tabla puente cuando el alcance es comunal", async () => {
    const { trx, inserciones } = crearTransaccionFalsa({ delegaciones: [] });
    configurarTransaccion(trx);

    const resultado = await insertarEventoAtpConDelegaciones({
      ...datosBase,
      delegacionIds: [],
    });

    expect(inserciones.map((i) => i.tabla)).toEqual(["evento_atp"]);
    expect(resultado.delegaciones).toEqual([]);
  });

  it("debe propagar el error y revertir la transacción si falla la tabla puente", async () => {
    const { trx } = crearTransaccionFalsa({ fallarEnPuente: true });
    configurarTransaccion(trx);

    await expect(
      insertarEventoAtpConDelegaciones(datosBase)
    ).rejects.toThrow("Fallo simulado en evento_atp_delegacion");
  });

  it("debe insertar el estado ACTIVO por defecto", async () => {
    const { trx, inserciones } = crearTransaccionFalsa({
      delegaciones: [delegacion],
    });
    configurarTransaccion(trx);

    await insertarEventoAtpConDelegaciones(datosBase);

    expect(inserciones[0].valores).toEqual(
      expect.objectContaining({ estado: "ACTIVO" })
    );
  });
});
