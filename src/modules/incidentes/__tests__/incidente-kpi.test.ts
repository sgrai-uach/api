import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  obtenerIncidentesKpisService,
  obtenerFechaActualChile,
} from "../incidente-kpi.service";
import * as repo from "../incidente-kpi.repository";
import {
  IncidentesKpisQuerySchema,
  IncidentesKpisResponseSchema,
} from "../incidente-kpi.schema";

vi.mock("../incidente-kpi.repository", () => ({
  obtenerContadoresIncidentesDiaRepo: vi.fn(),
}));

describe("Módulo Incidentes - KPIs y Dashboard de Estados (HU-18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Validación de Esquemas Zod (incidente-kpi.schema.ts)", () => {
    it("debe validar correctamente parámetros de consulta válidos", () => {
      const valido = IncidentesKpisQuerySchema.safeParse({
        fecha: "2026-10-03",
        delegacionId: "11111111-1111-4111-8111-111111111111",
      });
      expect(valido.success).toBe(true);
      if (valido.success) {
        expect(valido.data.fecha).toBe("2026-10-03");
        expect(valido.data.delegacionId).toBe("11111111-1111-4111-8111-111111111111");
      }
    });

    it("debe aceptar consulta sin parámetros (usando defaults en servicio)", () => {
      const valido = IncidentesKpisQuerySchema.safeParse({});
      expect(valido.success).toBe(true);
      if (valido.success) {
        expect(valido.data.fecha).toBeUndefined();
        expect(valido.data.delegacionId).toBeUndefined();
      }
    });

    it("debe rechazar formato de fecha inválido", () => {
      const invalido = IncidentesKpisQuerySchema.safeParse({
        fecha: "03-10-2026",
      });
      expect(invalido.success).toBe(false);
      if (!invalido.success) {
        expect(invalido.error.issues[0].message).toContain("YYYY-MM-DD");
      }
    });

    it("debe rechazar un delegacionId que no sea UUID", () => {
      const invalido = IncidentesKpisQuerySchema.safeParse({
        delegacionId: "no-es-uuid",
      });
      expect(invalido.success).toBe(false);
    });

    it("debe validar la estructura completa de respuesta esperada", () => {
      const mockResponse = {
        message: "Contadores de incidentes del día obtenidos exitosamente.",
        data: {
          fecha: "2026-10-03",
          zonaHoraria: "America/Santiago" as const,
          delegacionId: null,
          total: 10,
          contadores: {
            reportado: 2,
            verificando: 3,
            enAtencion: 3,
            noAbordables: 1,
            resueltos: 1,
          },
          actualizadoEn: new Date().toISOString(),
        },
      };

      const res = IncidentesKpisResponseSchema.safeParse(mockResponse);
      expect(res.success).toBe(true);
    });
  });

  describe("Servicio obtenerIncidentesKpisService", () => {
    it("debe calcular contadores del día actual si no se proporciona fecha", async () => {
      const mockContadores: repo.FilaContadoresKpi = {
        total: 15,
        reportado: 4,
        verificando: 2,
        en_atencion: 5,
        no_abordable: 1,
        resuelto: 3,
      };

      vi.mocked(repo.obtenerContadoresIncidentesDiaRepo).mockResolvedValueOnce(mockContadores);

      const fechaEsperada = obtenerFechaActualChile();
      const resultado = await obtenerIncidentesKpisService({});

      expect(repo.obtenerContadoresIncidentesDiaRepo).toHaveBeenCalledWith(
        fechaEsperada,
        undefined
      );
      expect(resultado.message).toBe("Contadores de incidentes del día obtenidos exitosamente.");
      expect(resultado.data.fecha).toBe(fechaEsperada);
      expect(resultado.data.zonaHoraria).toBe("America/Santiago");
      expect(resultado.data.total).toBe(15);
      expect(resultado.data.contadores).toEqual({
        reportado: 4,
        verificando: 2,
        enAtencion: 5,
        noAbordables: 1,
        resueltos: 3,
      });
    });

    it("debe consultar la fecha y delegación específica si se indican en la consulta", async () => {
      const mockContadores: repo.FilaContadoresKpi = {
        total: 5,
        reportado: 1,
        verificando: 1,
        en_atencion: 2,
        no_abordable: 0,
        resuelto: 1,
      };

      vi.mocked(repo.obtenerContadoresIncidentesDiaRepo).mockResolvedValueOnce(mockContadores);

      const resultado = await obtenerIncidentesKpisService({
        fecha: "2026-10-01",
        delegacionId: "22222222-2222-4222-8222-222222222222",
      });

      expect(repo.obtenerContadoresIncidentesDiaRepo).toHaveBeenCalledWith(
        "2026-10-01",
        "22222222-2222-4222-8222-222222222222"
      );
      expect(resultado.data.fecha).toBe("2026-10-01");
      expect(resultado.data.delegacionId).toBe("22222222-2222-4222-8222-222222222222");
      expect(resultado.data.contadores.enAtencion).toBe(2);
    });

    it("debe retornar contadores en 0 si no se registran incidentes", async () => {
      vi.mocked(repo.obtenerContadoresIncidentesDiaRepo).mockResolvedValueOnce({
        total: 0,
        reportado: 0,
        verificando: 0,
        en_atencion: 0,
        no_abordable: 0,
        resuelto: 0,
      });

      const resultado = await obtenerIncidentesKpisService({ fecha: "2026-10-02" });

      expect(resultado.data.total).toBe(0);
      expect(resultado.data.contadores).toEqual({
        reportado: 0,
        verificando: 0,
        enAtencion: 0,
        noAbordables: 0,
        resueltos: 0,
      });
    });
  });

  describe("Utilidad obtenerFechaActualChile", () => {
    it("debe retornar una fecha válida en formato YYYY-MM-DD", () => {
      const fecha = obtenerFechaActualChile();
      expect(fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
