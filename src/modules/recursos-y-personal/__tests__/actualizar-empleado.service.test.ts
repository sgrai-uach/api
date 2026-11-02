import { describe, it, expect, vi, beforeEach } from "vitest";
import { actualizarEmpleado } from "../services/actualizar-empleado.service";
import { db } from "@/lib/db";
import type { Transaction } from "kysely";
import type { Database } from "@/lib/db";

type TrxParameter = Transaction<Database>;

/**
 * H11 - La disponibilidad reside en `usuario.estado_operativo` y la ficha `personal`
 * queda como perfil opcional de terreno.
 */
describe("Servicio actualizarEmpleado (H11 - disponibilidad en usuario)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function crearMockTrx(filasPorTabla: Record<string, unknown>) {
    const ejecutados: string[] = [];

    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.selectAll = chain;
    builder.where = chain;
    builder.leftJoin = chain;
    builder.innerJoin = chain;
    builder.executeTakeFirst = vi.fn(async () => filasPorTabla.__actual ?? null);
    builder.executeTakeFirstOrThrow = vi.fn(async () => filasPorTabla.__actual ?? {});

    const mockTrx = {
      selectFrom: vi.fn((tabla: string) => {
        builder.executeTakeFirst = vi.fn(async () => filasPorTabla[tabla] ?? null);
        builder.executeTakeFirstOrThrow = vi.fn(async () => filasPorTabla[tabla] ?? {});
        return builder;
      }),
      insertInto: vi.fn(() => ({
        values: vi.fn(() => ({
          execute: vi.fn(async () => {
            ejecutados.push("insert:personal");
          }),
        })),
      })),
      updateTable: vi.fn((tabla: string) => ({
        set: vi.fn((datos: Record<string, unknown>) => ({
          where: () => ({
            execute: vi.fn(async () => {
              ejecutados.push(`update:${tabla}:${JSON.stringify(datos)}`);
            }),
          }),
        })),
      })),
      deleteFrom: vi.fn((tabla: string) => ({
        where: () => ({
          execute: vi.fn(async () => {
            ejecutados.push(`delete:${tabla}`);
          }),
        }),
      })),
    };

    return { mockTrx, ejecutados };
  }

  function mockTransaction(mockTrx: unknown) {
    vi.spyOn(db, "transaction").mockReturnValue({
      execute: vi.fn().mockImplementation(async (callback: (trx: TrxParameter) => Promise<unknown>) => {
        return await callback(mockTrx as TrxParameter);
      }),
    } as unknown as ReturnType<typeof db.transaction>);
  }

  const fichaPersonal = {
    id: "personal-1",
    usuario_id: "usuario-1",
    delegacion_id: "delegacion-1",
    especialidad: "Motosierrista",
    cargo: "Brigadista",
    disponible_terreno: true,
    observaciones: null,
  };

  it("debe eliminar la ficha de terreno y conservar el estado en 'usuario' al cambiar a un rol administrativo", async () => {
    const { mockTrx, ejecutados } = crearMockTrx({
      personal: fichaPersonal,
      usuario: {
        id: "usuario-1",
        activo: true,
        estado_operativo: "descanso",
        fecha_salida: null,
        delegacion_id: "delegacion-1",
      },
      rol: { id: "rol-admin", codigo: "CALL_CENTER" },
    });

    mockTransaction(mockTrx);

    await actualizarEmpleado("usuario-1", { rol_id: "rol-admin" });

    expect(ejecutados).toContain("delete:personal");
    const actualizacionUsuario = ejecutados.find((e) => e.startsWith("update:usuario:"));
    expect(actualizacionUsuario).toBeDefined();
    expect(actualizacionUsuario).toContain('"estado_operativo":"descanso"');
  });

  it("debe resetear a 'disponible' un estado de terreno cuando el rol deja de ser de terreno", async () => {
    const { mockTrx, ejecutados } = crearMockTrx({
      personal: fichaPersonal,
      usuario: {
        id: "usuario-1",
        activo: true,
        estado_operativo: "en_mision",
        fecha_salida: null,
        delegacion_id: "delegacion-1",
      },
      rol: { id: "rol-admin", codigo: "CALL_CENTER" },
    });

    mockTransaction(mockTrx);

    await actualizarEmpleado("usuario-1", { rol_id: "rol-admin" });

    const actualizacionUsuario = ejecutados.find((e) => e.startsWith("update:usuario:"));
    expect(actualizacionUsuario).toContain('"estado_operativo":"disponible"');
  });

  it("debe forzar 'inactivo' y deshabilitar la disponibilidad de terreno cuando la cuenta se desactiva", async () => {
    const { mockTrx, ejecutados } = crearMockTrx({
      personal: fichaPersonal,
      usuario: {
        id: "usuario-1",
        activo: true,
        estado_operativo: "disponible",
        fecha_salida: null,
        delegacion_id: "delegacion-1",
        rol_codigo: "BRIGADISTA",
      },
    });

    mockTransaction(mockTrx);

    await actualizarEmpleado("usuario-1", { activo: false });

    const actualizacionUsuario = ejecutados.find((e) => e.startsWith("update:usuario:"));
    const actualizacionPersonal = ejecutados.find((e) => e.startsWith("update:personal:"));

    expect(actualizacionUsuario).toContain('"estado_operativo":"inactivo"');
    expect(actualizacionUsuario).toContain('"activo":false');
    expect(actualizacionPersonal).toBeDefined();
    expect(actualizacionPersonal).toContain('"disponible_terreno":false');
  });

  it("debe rechazar un estado de terreno para un usuario administrativo", async () => {
    const { mockTrx } = crearMockTrx({
      personal: null,
      usuario: {
        id: "usuario-1",
        activo: true,
        estado_operativo: "disponible",
        fecha_salida: null,
        delegacion_id: "delegacion-1",
        rol_codigo: "CALL_CENTER",
      },
    });

    mockTransaction(mockTrx);

    await expect(
      actualizarEmpleado("usuario-1", { estado_operativo: "en_mision" })
    ).rejects.toThrow(/sólo es válido para funcionarios con perfil de terreno/);
  });
});
