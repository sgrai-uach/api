import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ListarMisionesQuerySchema,
  ListarMisionesResponseSchema,
} from "../mision-listado.schema";
import { listarMisionesService } from "../mision-listado.service";
import * as repo from "../mision-listado.repository";

vi.mock("../mision-listado.repository", () => ({
  listarMisionesPaginadoRepo: vi.fn(),
}));

describe("Módulo Misiones - Listado de Misiones (H34)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ListarMisionesQuerySchema", () => {
    it("debe aplicar valores de paginación por defecto si se envía objeto vacío", () => {
      const res = ListarMisionesQuerySchema.safeParse({});
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.page).toBe(1);
        expect(res.data.limit).toBe(20);
        expect(res.data.ordenarPor).toBe("creadoEn");
        expect(res.data.orden).toBe("desc");
      }
    });

    it("debe validar filtros completos: estado, tipoMision, prioridad, delegacionId", () => {
      const input = {
        page: "2",
        limit: "10",
        estado: "EN_CURSO",
        tipoMision: "VERIFICACION",
        prioridad: "ALTA",
        delegacionId: "30000000-0000-4000-8000-000000000001",
        incidenteId: "a0000000-0000-4000-8000-000000000001",
        busqueda: "Picarte",
      };
      const res = ListarMisionesQuerySchema.safeParse(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.page).toBe(2);
        expect(res.data.limit).toBe(10);
        expect(res.data.estado).toBe("EN_CURSO");
        expect(res.data.tipoMision).toBe("VERIFICACION");
        expect(res.data.prioridad).toBe("ALTA");
        expect(res.data.delegacionId).toBe("30000000-0000-4000-8000-000000000001");
        expect(res.data.incidenteId).toBe("a0000000-0000-4000-8000-000000000001");
        expect(res.data.busqueda).toBe("Picarte");
      }
    });

    it("debe rechazar estados no válidos", () => {
      const res = ListarMisionesQuerySchema.safeParse({ estado: "INEXISTENTE" });
      expect(res.success).toBe(false);
    });

    it("debe rechazar tipoMision no válido", () => {
      const res = ListarMisionesQuerySchema.safeParse({ tipoMision: "INVALIDO" });
      expect(res.success).toBe(false);
    });

    it("debe rechazar delegacionId que no sea UUID", () => {
      const res = ListarMisionesQuerySchema.safeParse({ delegacionId: "123-no-uuid" });
      expect(res.success).toBe(false);
    });
  });

  describe("listarMisionesService", () => {
    it("debe calcular metadatos de paginación y retornar listado correctamente", async () => {
      vi.mocked(repo.listarMisionesPaginadoRepo).mockResolvedValueOnce({
        filas: [
          {
            id: "m0000000-0000-4000-8000-000000000001",
            codigo: "MIS-0001",
            titulo: "Verificación de anegamiento",
            descripcion: "Inspeccionar terreno",
            tipo_mision: "VERIFICACION",
            estado: "EN_CURSO",
            prioridad: "ALTA",
            justificacion_rechazo: null,
            incidente_id: "a0000000-0000-4000-8000-000000000001",
            incidente_codigo: "INC-0001",
            cuadrilla_id: null,
            cuadrilla_nombre: null,
            patrulla_id: "p0000000-0000-4000-8000-000000000001",
            patrulla_nombre: "Patrulla Alfa",
            delegacion_id: "30000000-0000-4000-8000-000000000001",
            delegacion_nombre: "Norte",
            fecha_inicio: new Date("2026-10-04T12:00:00Z"),
            fecha_cierre: null,
            creado_en: new Date("2026-10-04T11:00:00Z"),
            actualizado_en: new Date("2026-10-04T12:00:00Z"),
          },
        ] as any,
        total: 15,
      });

      const res = await listarMisionesService({
        page: 1,
        limit: 10,
        ordenarPor: "creadoEn",
        orden: "desc",
      });

      expect(res.message).toBe("Listado de misiones obtenido exitosamente");
      expect(res.meta).toEqual({
        total: 15,
        page: 1,
        limit: 10,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
      expect(res.data).toHaveLength(1);
      expect(res.data[0].codigo).toBe("MIS-0001");
      expect(res.data[0].delegacionNombre).toBe("Norte");
      expect(res.data[0].fechaInicio).toBe("2026-10-04T12:00:00.000Z");
    });
  });
});
