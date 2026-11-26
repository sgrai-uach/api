import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/modules/seguridad/errors";

const mockState = vi.hoisted(() => ({
  queue: [] as unknown[],
}));

vi.mock("@/lib/db", () => {
  const createChain = (resultProvider: () => unknown) => {
    const chain: Record<string, unknown> = {};
    const methods = [
      "selectFrom",
      "innerJoin",
      "leftJoin",
      "select",
      "where",
      "orderBy",
      "insertInto",
      "values",
      "returning",
    ];
    for (const m of methods) {
      chain[m] = vi.fn(() => chain);
    }
    chain.executeTakeFirst = vi.fn(async () => resultProvider());
    chain.executeTakeFirstOrThrow = vi.fn(async () => resultProvider());
    chain.execute = vi.fn(async () => {
      const val = resultProvider();
      return Array.isArray(val) ? val : val ? [val] : [];
    });
    return chain;
  };

  return {
    db: {
      selectFrom: vi.fn(() => createChain(() => mockState.queue.shift())),
      insertInto: vi.fn(() => createChain(() => mockState.queue.shift())),
    },
  };
});

import { validarAsociacionYAutorizacionAdjuntoRepo } from "../evidencia.repository";

describe("evidencia.repository - validación relacional y autorización horizontal (HU-43)", () => {
  const userId = "00000000-0000-4000-8000-000000000005";
  const incidenteA = "a1000000-0000-4000-8000-000000000004";
  const incidenteB = "a1000000-0000-4000-8000-000000000006";
  const misionId = "d1000000-0000-4000-8000-000000000002";
  const reporteId = "70000000-0000-4000-8000-000000000001";
  const cuadrillaId = "c1000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    mockState.queue = [];
    vi.clearAllMocks();
  });

  it("deriva incidenteId y misionId automáticamente vía JOIN cuando solo se envía reporteTerrenoId", async () => {
    mockState.queue = [
      // 1. reporte_terreno innerJoin mision
      {
        id: reporteId,
        mision_id: misionId,
        incidente_id: incidenteA,
        patrulla_id: null,
        cuadrilla_id: cuadrillaId,
      },
      // 2. incidente abierto
      { id: incidenteA, estado: "EN_ATENCION" },
      // 3. cuadrilla delegado
      { id: cuadrillaId },
    ];

    const res = await validarAsociacionYAutorizacionAdjuntoRepo({
      incidenteId: null,
      reporteTerrenoId: reporteId,
      usuarioId: userId,
      esAdmin: false,
    });

    expect(res).toEqual({
      incidenteId: incidenteA,
      misionId,
    });
  });

  it("rechaza con ConflictError (409) si reporteTerrenoId e incidenteId pertenecen a incidentes distintos", async () => {
    mockState.queue = [
      {
        id: reporteId,
        mision_id: misionId,
        incidente_id: incidenteA,
        patrulla_id: null,
        cuadrilla_id: cuadrillaId,
      },
    ];

    await expect(
      validarAsociacionYAutorizacionAdjuntoRepo({
        incidenteId: incidenteB,
        reporteTerrenoId: reporteId,
        usuarioId: userId,
        esAdmin: true,
      })
    ).rejects.toThrow(ConflictError);
  });

  it("rechaza con NotFoundError (404) cuando el incidente no existe", async () => {
    mockState.queue = [undefined];

    await expect(
      validarAsociacionYAutorizacionAdjuntoRepo({
        incidenteId: "99999999-9999-4999-8999-999999999999",
        reporteTerrenoId: null,
        usuarioId: userId,
        esAdmin: false,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("rechaza con ConflictError (409) cuando el incidente está cerrado (RESUELTO o NO_ABORDABLE)", async () => {
    mockState.queue = [{ id: incidenteB, estado: "RESUELTO" }];

    await expect(
      validarAsociacionYAutorizacionAdjuntoRepo({
        incidenteId: incidenteB,
        reporteTerrenoId: null,
        usuarioId: userId,
        esAdmin: false,
      })
    ).rejects.toThrow(ConflictError);
  });

  it("rechaza con ForbiddenError (403) cuando un usuario no pertenece a la unidad asignada (IDOR)", async () => {
    mockState.queue = [
      // 1. incidente abierto
      { id: incidenteA, estado: "EN_ATENCION" },
      // 2. misiones activas del incidente (solo patrulla P1)
      [{ id: misionId, patrulla_id: "p1000000-0000-4000-8000-000000000001", cuadrilla_id: null }],
      // 3. patrulla_verificadora lider -> null
      undefined,
      // 4. patrulla_personal integrante -> null
      undefined,
    ];

    await expect(
      validarAsociacionYAutorizacionAdjuntoRepo({
        incidenteId: incidenteA,
        reporteTerrenoId: null,
        usuarioId: userId,
        esAdmin: false,
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
