/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  listarRecuperacionesPaginadoRepo,
  buscarRecuperacionPorId,
  buscarPatrullaPorId,
} from "../recuperacion.repository";

vi.mock("@/lib/db", () => {
  const queryBuilderMock: any = {};
  queryBuilderMock.selectFrom = vi.fn().mockReturnThis();
  queryBuilderMock.leftJoin = vi.fn().mockReturnThis();
  queryBuilderMock.innerJoin = vi.fn().mockReturnThis();
  queryBuilderMock.where = vi.fn().mockReturnThis();
  queryBuilderMock.select = vi.fn().mockReturnThis();
  queryBuilderMock.orderBy = vi.fn().mockReturnThis();
  queryBuilderMock.limit = vi.fn().mockReturnThis();
  queryBuilderMock.offset = vi.fn().mockReturnThis();
  queryBuilderMock.executeTakeFirst = vi.fn();
  queryBuilderMock.execute = vi.fn();

  return {
    db: queryBuilderMock,
  };
});

describe("Módulo Eventos ATP - recuperacion.repository (HU-73 / HU-32)", () => {
  const dbMock = db as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listarRecuperacionesPaginadoRepo", () => {
    it("debe aplicar paginación respetando aliases pagina y limite (BUG-H73-API-03)", async () => {
      dbMock.executeTakeFirst.mockResolvedValueOnce({ total: 10 });
      dbMock.execute
        .mockResolvedValueOnce([]) // recuperaciones
        .mockResolvedValueOnce([]); // recursos

      await listarRecuperacionesPaginadoRepo({
        pagina: 2,
        limite: 5,
      } as any);

      expect(dbMock.limit).toHaveBeenCalledWith(5);
      expect(dbMock.offset).toHaveBeenCalledWith(5); // (2-1)*5
    });

    it("debe sanitizar comodines SQL en término de búsqueda (BUG-H73-API-04)", async () => {
      dbMock.executeTakeFirst.mockResolvedValueOnce({ total: 0 });
      dbMock.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      let whereFilterCallback: any = null;
      dbMock.where.mockImplementation((arg: any) => {
        if (typeof arg === "function") {
          whereFilterCallback = arg;
        }
        return dbMock;
      });

      await listarRecuperacionesPaginadoRepo({
        busqueda: "100%_valdivia\\sector",
      } as any);

      expect(whereFilterCallback).toBeDefined();

      const ebMock = {
        or: vi.fn(),
      };
      const ebFn = vi.fn((col, op, pattern) => ({ col, op, pattern }));
      Object.assign(ebFn, ebMock);

      whereFilterCallback(ebFn as any);

      // Verificar que el patrón generado tenga los comodines escapados
      expect(ebFn).toHaveBeenCalledWith(
        "recuperacion.codigo",
        "ilike",
        "%100\\%\\_valdivia\\\\sector%"
      );
    });

    it("debe aplicar ordenamiento por prioridad ponderada ICS (BUG-H73-API-05)", async () => {
      dbMock.executeTakeFirst.mockResolvedValueOnce({ total: 0 });
      dbMock.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await listarRecuperacionesPaginadoRepo({
        ordenarPor: "prioridad",
        orden: "desc",
      } as any);

      expect(dbMock.orderBy).toHaveBeenCalled();
    });

    it("debe filtrar por rango de fechas cuando fechaDesde y fechaHasta son provistos (BUG-H73-API-02)", async () => {
      dbMock.executeTakeFirst.mockResolvedValueOnce({ total: 0 });
      dbMock.execute
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await listarRecuperacionesPaginadoRepo({
        fechaDesde: "2026-11-01T00:00:00.000Z",
        fechaHasta: "2026-11-15T23:59:59.999Z",
      } as any);

      expect(dbMock.where).toHaveBeenCalledWith(
        "recuperacion.creado_en",
        ">=",
        new Date("2026-11-01T00:00:00.000Z")
      );
      expect(dbMock.where).toHaveBeenCalledWith(
        "recuperacion.creado_en",
        "<=",
        new Date("2026-11-15T23:59:59.999Z")
      );
    });
  });

  describe("buscarRecuperacionPorId y buscarPatrullaPorId", () => {
    it("debe consultar recuperacion por ID y filtrar bajas lógicas (BUG-H73-API-09)", async () => {
      const mockRec = { id: "rec-1", codigo: "REC-2026-0001" };
      dbMock.executeTakeFirst.mockResolvedValueOnce(mockRec);

      const res = await buscarRecuperacionPorId(dbMock, "rec-1");
      expect(res).toEqual(mockRec);
      expect(dbMock.where).toHaveBeenCalledWith("id", "=", "rec-1");
      expect(dbMock.where).toHaveBeenCalledWith("eliminado_en", "is", null);
    });

    it("debe consultar patrulla por ID", async () => {
      const mockPat = { id: "pat-1", nombre: "Patrulla Alfa", estado: "DISPONIBLE" };
      dbMock.executeTakeFirst.mockResolvedValueOnce(mockPat);

      const res = await buscarPatrullaPorId(dbMock, "pat-1");
      expect(res).toEqual(mockPat);
      expect(dbMock.where).toHaveBeenCalledWith("id", "=", "pat-1");
    });
  });
});
