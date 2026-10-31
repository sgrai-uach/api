import { describe, it, expect, vi, beforeEach } from "vitest";

interface InsertRecord {
  table: string;
  vals: Record<string, unknown>;
}

const { mockInsertedValues, mockUpdatedValues, mockDb } = vi.hoisted(() => {
  const mockInsertedValues: InsertRecord[] = [];
  const mockUpdatedValues: { table: string; values: unknown }[] = [];

  const mockTrx = {
    insertInto: vi.fn((table: string) => ({
      values: vi.fn((vals: Record<string, unknown>) => {
        mockInsertedValues.push({ table, vals });
        return {
          returning: vi.fn(() => ({
            executeTakeFirstOrThrow: vi.fn().mockResolvedValue({ id: "patrulla-uuid-123" }),
          })),
          execute: vi.fn().mockResolvedValue(undefined),
        };
      }),
    })),
    updateTable: vi.fn((table: string) => ({
      set: vi.fn((vals: unknown) => {
        mockUpdatedValues.push({ table, values: vals });
        return {
          where: vi.fn(() => ({
            execute: vi.fn().mockResolvedValue(undefined),
          })),
        };
      }),
    })),
    selectFrom: vi.fn(() => ({
      where: vi.fn(() => ({
        select: vi.fn(() => ({
          execute: vi.fn().mockResolvedValue([
            { personal_id: "pers-1", usuario_id: "user-1" },
            { personal_id: "pers-2", usuario_id: "user-2" },
          ]),
        })),
      })),
    })),
  };

  const mockDb = {
    transaction: vi.fn(() => ({
      execute: vi.fn(async (callback: (trx: typeof mockTrx) => Promise<unknown>) => {
        return await callback(mockTrx);
      }),
    })),
    selectFrom: vi.fn(() => ({
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      select: vi.fn((columns: unknown) => ({
        execute: vi.fn().mockResolvedValue(columns),
      })),
    })),
  };

  return { mockInsertedValues, mockUpdatedValues, mockDb };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import {
  crearPatrullaTransaccionalRepo,
  obtenerPersonalParaPatrullaRepo,
} from "../patrulla.repository";

describe("patrulla.repository - Verificación de corrección de defectos QA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertedValues.length = 0;
    mockUpdatedValues.length = 0;
  });

  it("[BUG-H83-API-01] debe asignar LIDER al integrante cuyo usuario coincide con usuarioLiderId aunque sea el segundo", async () => {
    const personalFilas = [
      { personal_id: "pers-1", usuario_id: "user-1" },
      { personal_id: "pers-2", usuario_id: "user-2" },
    ];

    const patrullaId = await crearPatrullaTransaccionalRepo({
      codigo: "PV-TEST-01",
      nombre: "Patrulla Test",
      delegacionId: "del-uuid-1",
      vehiculoId: null,
      usuarioLiderId: "user-2", // Segundo integrante es el líder
      latitud: null,
      longitud: null,
      personalIds: ["pers-1", "pers-2"],
      personalFilas,
    });

    expect(patrullaId).toBe("patrulla-uuid-123");

    // Verificar las inserciones en patrulla_personal
    const insercionesPersonal = mockInsertedValues
      .filter((item) => item.table === "patrulla_personal")
      .map((item) => item.vals);

    expect(insercionesPersonal).toHaveLength(2);
    // pers-1 no es el líder: debe ser OPERATIVO
    expect(insercionesPersonal[0]).toMatchObject({
      personal_id: "pers-1",
      rol_en_patrulla: "OPERATIVO",
    });
    // pers-2 es el líder: debe ser LIDER
    expect(insercionesPersonal[1]).toMatchObject({
      personal_id: "pers-2",
      rol_en_patrulla: "LIDER",
    });
  });

  it("[BUG-H83-API-03] debe actualizar usuario.estado_operativo a 'en_patrulla' y no la tabla personal", async () => {
    const personalFilas = [
      { personal_id: "pers-1", usuario_id: "user-1" },
    ];

    await crearPatrullaTransaccionalRepo({
      codigo: "PV-TEST-02",
      nombre: "Patrulla Test 2",
      delegacionId: "del-uuid-1",
      vehiculoId: null,
      usuarioLiderId: "user-1",
      latitud: null,
      longitud: null,
      personalIds: ["pers-1"],
      personalFilas,
    });

    // Debe haber actualizado la tabla 'usuario'
    const updateUsuario = mockUpdatedValues.find((u) => u.table === "usuario");
    expect(updateUsuario).toBeDefined();
    expect(updateUsuario?.values).toMatchObject({
      estado_operativo: "en_patrulla",
    });

    // No debe actualizar la tabla 'personal' para estado_operativo
    const updatePersonal = mockUpdatedValues.find((u) => u.table === "personal");
    expect(updatePersonal).toBeUndefined();
  });

  it("[BUG-H83-API-03] obtenerPersonalParaPatrullaRepo debe consultar u.estado_operativo y no p.estado_operativo", async () => {
    let columnasSeleccionadas: unknown[] = [];
    mockDb.selectFrom.mockReturnValueOnce({
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              select: vi.fn((cols: unknown[]) => {
                columnasSeleccionadas = cols;
                return {
                  execute: vi.fn().mockResolvedValue([]),
                };
              }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof mockDb.selectFrom>);

    await obtenerPersonalParaPatrullaRepo(["pers-1"]);

    expect(columnasSeleccionadas).toContain("u.estado_operativo");
    expect(columnasSeleccionadas).not.toContain("p.estado_operativo");
  });
});
