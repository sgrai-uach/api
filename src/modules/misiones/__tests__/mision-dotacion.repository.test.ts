import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTrx } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockTrx: any = {
    selectFrom: vi.fn(),
    updateTable: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    set: vi.fn(),
    select: vi.fn(),
    execute: vi.fn(),
  };

  return { mockTrx };
});

vi.mock("@/lib/db", () => ({
  db: {},
}));

import { marcarDotacionCuadrillaEnMision } from "../mision.repository";

describe("Capa de Persistencia Kysely - Dotación de Cuadrilla (HU-21)", () => {
  const cuadrillaId = "11111111-1111-4111-8111-111111111111";
  const usuarioDelegadoId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrx.selectFrom.mockReturnValue(mockTrx);
    mockTrx.updateTable.mockReturnValue(mockTrx);
    mockTrx.innerJoin.mockReturnValue(mockTrx);
    mockTrx.where.mockReturnValue(mockTrx);
    mockTrx.set.mockReturnValue(mockTrx);
    mockTrx.select.mockReturnValue(mockTrx);
    mockTrx.execute.mockResolvedValue([]);
  });

  it("debe marcar a la dotación de la cuadrilla como 'en_mision'", async () => {
    await marcarDotacionCuadrillaEnMision(mockTrx, cuadrillaId, null);

    expect(mockTrx.updateTable).toHaveBeenCalledWith("usuario");
    expect(mockTrx.set).toHaveBeenCalledWith(
      expect.objectContaining({ estado_operativo: "en_mision" })
    );
    expect(mockTrx.where).toHaveBeenCalledWith("activo", "=", true);
    expect(mockTrx.where).toHaveBeenCalledWith("estado_operativo", "in", [
      "disponible",
      "en_mision",
    ]);
    expect(mockTrx.execute).toHaveBeenCalledTimes(1);
  });

  it("debe incluir al delegado de la cuadrilla aunque no esté en cuadrilla_personal", async () => {
    await marcarDotacionCuadrillaEnMision(mockTrx, cuadrillaId, usuarioDelegadoId);

    expect(mockTrx.updateTable).toHaveBeenCalledTimes(2);
    expect(mockTrx.where).toHaveBeenCalledWith("id", "=", usuarioDelegadoId);    expect(mockTrx.execute).toHaveBeenCalledTimes(2);
  });

  it("debe consultar los integrantes activos y vigentes de la cuadrilla", async () => {
    await marcarDotacionCuadrillaEnMision(mockTrx, cuadrillaId, null);

    expect(mockTrx.selectFrom).toHaveBeenCalledWith("cuadrilla_personal");
    expect(mockTrx.innerJoin).toHaveBeenCalledWith(
      "personal",
      "personal.id",
      "cuadrilla_personal.personal_id"
    );
    expect(mockTrx.where).toHaveBeenCalledWith(
      "cuadrilla_personal.cuadrilla_id",
      "=",
      cuadrillaId
    );
    expect(mockTrx.where).toHaveBeenCalledWith(
      "cuadrilla_personal.activo",
      "=",
      true
    );
    expect(mockTrx.where).toHaveBeenCalledWith(
      "cuadrilla_personal.desvinculado_en",
      "is",
      null
    );
  });
});
