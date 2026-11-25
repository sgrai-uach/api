/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  esViolacionCodigoEventoAtpUnico,
  generarSiguienteCodigoEventoAtp,
  insertarEventoAtpConDelegaciones,
} from "../evento-atp.repository";
import { BadRequestError, ConflictError } from "@/modules/seguridad/errors";

/**
 * Controla el valor devuelto por la consulta de correlativo (MAX numérico).
 */
let maximoSecuenciaActual = 0;

/**
 * Registro de las sentencias SQL ejecutadas (advisory locks y correlativo).
 */
const sqlEjecutado: string[] = [];

vi.mock("kysely", async (importOriginal) => {
  const original = await importOriginal<typeof import("kysely")>();

  const sqlMock = (strings: TemplateStringsArray) => ({
    execute: async () => {
      const texto = strings.join(" ");
      sqlEjecutado.push(texto);

      if (texto.includes("MAX(SUBSTRING")) {
        return { rows: [{ maximo: String(maximoSecuenciaActual) }] };
      }

      return { rows: [] };
    },
  });

  return { ...original, sql: sqlMock };
});

vi.mock("@/lib/db", () => ({
  db: {
    transaction: vi.fn(),
  },
}));

interface DelegacionFake {
  id: string;
  activo: boolean;
}

interface OpcionesTransaccion {
  delegaciones?: DelegacionFake[];
  codigosExistentes?: string[];
  maximoSecuencia?: number;
  fallarEnPuente?: boolean;
  errorEnInsert?: unknown;
  delegacionesRespuesta?: any[];
}

function crearTransaccionFalsa(opciones: OpcionesTransaccion = {}) {
  const inserciones: { tabla: string; valores: any }[] = [];
  const consultas: { tabla: string; filtros: any[][] }[] = [];
  const codigosExistentes = new Set(opciones.codigosExistentes ?? []);

  const trx: any = {
    selectFrom: (tabla: string) => {
      const estado: { tabla: string; filtros: any[][] } = { tabla, filtros: [] };

      const builder: any = {
        select: () => builder,
        innerJoin: () => builder,
        orderBy: () => builder,
        limit: () => builder,
        where: (columna: string, operador: string, valor: any) => {
          estado.filtros.push([columna, operador, valor]);
          return builder;
        },
        execute: async () => {
          consultas.push(estado);

          if (tabla === "delegacion") {
            const filtroId = estado.filtros.find((f) => f[0] === "id");
            const filtroActivo = estado.filtros.find((f) => f[0] === "activo");

            let resultado = opciones.delegaciones ?? [];

            if (filtroId) {
              resultado = resultado.filter((d) =>
                (filtroId[2] as string[]).includes(d.id)
              );
            }

            if (filtroActivo) {
              resultado = resultado.filter((d) => d.activo === filtroActivo[2]);
            }

            return resultado.map((d) => ({ id: d.id }));
          }

          if (tabla === "evento_atp") {
            const filtroCodigo = estado.filtros.find((f) => f[0] === "codigo");
            if (filtroCodigo && codigosExistentes.has(filtroCodigo[2])) {
              return [{ id: "50000000-0000-4000-8000-000000000099" }];
            }
            return [];
          }

          return opciones.delegacionesRespuesta ?? [];
        },
        executeTakeFirst: async () => {
          const filas = await builder.execute();
          return filas[0] ?? undefined;
        },
      };

      return builder;
    },
    insertInto: (tabla: string) => ({
      values: (valores: any) => {
        if (tabla === "evento_atp") {
          return {
            returningAll: () => ({
              executeTakeFirstOrThrow: async () => {
                if (opciones.errorEnInsert) {
                  throw opciones.errorEnInsert;
                }
                inserciones.push({ tabla, valores });
                return {
                  id: "50000000-0000-4000-8000-000000000001",
                  ...valores,
                  creado_en: new Date("2026-05-01T09:55:00.000Z"),
                  actualizado_en: new Date("2026-05-01T09:55:00.000Z"),
                };
              },
            }),
          };
        }

        return {
          execute: async () => {
            if (opciones.fallarEnPuente) {
              throw new Error("Fallo simulado en evento_atp_delegacion");
            }
            inserciones.push({ tabla, valores });
          },
        };
      },
    }),
  };

  return { trx, inserciones, consultas, codigosExistentes };
}

function configurarTransaccion(trx: any) {
  vi.mocked(db.transaction).mockReturnValue({
    execute: async (callback: (t: any) => Promise<unknown>) => callback(trx),
  } as any);
}

const delegacion = {
  id: "30000000-0000-4000-8000-000000000001",
  codigo: "DEL_NORTE",
  nombre: "Delegación Municipal Norte",
};

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

describe("evento-atp.repository - Transacción atómica (H61)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlEjecutado.length = 0;
    maximoSecuenciaActual = 0;
  });

  it("debe insertar evento_atp y evento_atp_delegacion dentro de la misma transacción", async () => {
    const { trx, inserciones } = crearTransaccionFalsa({
      delegaciones: [{ id: delegacion.id, activo: true }],
      delegacionesRespuesta: [delegacion],
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
    const { trx } = crearTransaccionFalsa({
      fallarEnPuente: true,
      delegaciones: [{ id: delegacion.id, activo: true }],
    });
    configurarTransaccion(trx);

    await expect(
      insertarEventoAtpConDelegaciones(datosBase)
    ).rejects.toThrow("Fallo simulado en evento_atp_delegacion");
  });

  it("debe insertar el estado ACTIVO por defecto", async () => {
    const { trx, inserciones } = crearTransaccionFalsa({
      delegaciones: [{ id: delegacion.id, activo: true }],
    });
    configurarTransaccion(trx);

    await insertarEventoAtpConDelegaciones(datosBase);

    expect(inserciones[0].valores).toEqual(
      expect.objectContaining({ estado: "ACTIVO" })
    );
  });

  it("debe validar las delegaciones dentro de la transacción filtrando las inactivas", async () => {
    const { trx, inserciones, consultas } = crearTransaccionFalsa({
      delegaciones: [{ id: delegacion.id, activo: false }],
    });
    configurarTransaccion(trx);

    await expect(
      insertarEventoAtpConDelegaciones(datosBase)
    ).rejects.toThrow(BadRequestError);

    const consultaDelegacion = consultas.find((c) => c.tabla === "delegacion");
    expect(consultaDelegacion?.filtros).toContainEqual([
      "activo",
      "=",
      true,
    ]);
    expect(inserciones).toHaveLength(0);
  });

  it("debe rechazar con ConflictError un código manual ya existente", async () => {
    const { trx, inserciones } = crearTransaccionFalsa({
      codigosExistentes: ["ATP-2026-0001"],
      delegaciones: [{ id: delegacion.id, activo: true }],
    });
    configurarTransaccion(trx);

    await expect(
      insertarEventoAtpConDelegaciones(datosBase)
    ).rejects.toThrow(ConflictError);

    expect(inserciones).toHaveLength(0);
    expect(
      sqlEjecutado.some((sql) => sql.includes("pg_advisory_xact_lock"))
    ).toBe(true);
  });

  it("debe convertir la violación 23505 del código en ConflictError", async () => {
    const { trx } = crearTransaccionFalsa({
      errorEnInsert: {
        code: "23505",
        constraint: "evento_atp_codigo_key",
      },
      delegaciones: [{ id: delegacion.id, activo: true }],
    });
    configurarTransaccion(trx);

    await expect(
      insertarEventoAtpConDelegaciones(datosBase)
    ).rejects.toThrow(ConflictError);
  });

  it("debe propagar los errores que no son violaciones de unicidad del código", async () => {
    const { trx } = crearTransaccionFalsa({
      errorEnInsert: { code: "23503", constraint: "evento_atp_creado_por_id_fkey" },
      delegaciones: [{ id: delegacion.id, activo: true }],
    });
    configurarTransaccion(trx);

    await expect(
      insertarEventoAtpConDelegaciones(datosBase)
    ).rejects.toThrow();
  });

  it("debe generar el correlativo numérico ignorando sufijos no numéricos", async () => {
    const { trx } = crearTransaccionFalsa();
    maximoSecuenciaActual = 1;

    const codigo = await generarSiguienteCodigoEventoAtp(trx, 2026);

    expect(codigo).toBe("ATP-2026-0002");
    expect(
      sqlEjecutado.some((sql) => sql.includes("MAX(SUBSTRING"))
    ).toBe(true);
    expect(
      sqlEjecutado.some((sql) => sql.includes("codigo ~"))
    ).toBe(true);
  });

  it("debe avanzar el correlativo si el candidato calculado ya existe", async () => {
    const { trx } = crearTransaccionFalsa({
      codigosExistentes: ["ATP-2026-0002"],
    });
    maximoSecuenciaActual = 1;

    const codigo = await generarSiguienteCodigoEventoAtp(trx, 2026);

    expect(codigo).toBe("ATP-2026-0003");
  });

  it("debe detectar correctamente la violación de unicidad del código", () => {
    expect(
      esViolacionCodigoEventoAtpUnico({
        code: "23505",
        constraint: "evento_atp_codigo_key",
      })
    ).toBe(true);
    expect(
      esViolacionCodigoEventoAtpUnico({
        code: "23505",
        constraint: "otra_constraint",
      })
    ).toBe(false);
    expect(esViolacionCodigoEventoAtpUnico(new Error("fallo"))).toBe(false);
  });
});
