import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ListarPersonalQuerySchema,
  ListarPersonalResponseSchema,
} from "../personal-listado.schema";
import { listarPersonalService } from "../personal-listado.service";
import * as repo from "../personal-listado.repository";

vi.mock("../personal-listado.repository", () => ({
  listarPersonalPaginadoRepo: vi.fn(),
}));

describe("Módulo Recursos y Personal - Listado de Personal (H34)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ListarPersonalQuerySchema", () => {
    it("debe aplicar valores de paginación por defecto si se envía objeto vacío", () => {
      const res = ListarPersonalQuerySchema.safeParse({});
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.page).toBe(1);
        expect(res.data.limit).toBe(20);
        expect(res.data.ordenarPor).toBe("apellidos");
        expect(res.data.orden).toBe("asc");
      }
    });

    it("debe validar filtros canónicos: delegacionId, estadoOperativo, cargo, especialidad", () => {
      const input = {
        page: "2",
        limit: "15",
        delegacionId: "30000000-0000-4000-8000-000000000001",
        estadoOperativo: "disponible",
        cargo: "Conductor",
        especialidad: "Motosierrista",
        busqueda: "Pérez",
      };
      const res = ListarPersonalQuerySchema.safeParse(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.page).toBe(2);
        expect(res.data.limit).toBe(15);
        expect(res.data.delegacionId).toBe("30000000-0000-4000-8000-000000000001");
        expect(res.data.estadoOperativo).toBe("disponible");
        expect(res.data.cargo).toBe("Conductor");
        expect(res.data.especialidad).toBe("Motosierrista");
        expect(res.data.busqueda).toBe("Pérez");
      }
    });

    it("debe aceptar aliases en snake_case para retrocompatibilidad", () => {
      const input = {
        delegacion_id: "30000000-0000-4000-8000-000000000001",
        rol_id: "10000000-0000-4000-8000-000000000001",
        estado_operativo: "en_mision",
        solo_personal: "true",
        q: "González",
        ordenar_por: "nombres",
      };
      const res = ListarPersonalQuerySchema.safeParse(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.delegacion_id).toBe("30000000-0000-4000-8000-000000000001");
        expect(res.data.rol_id).toBe("10000000-0000-4000-8000-000000000001");
        expect(res.data.estado_operativo).toBe("en_mision");
        expect(res.data.solo_personal).toBe(true);
        expect(res.data.q).toBe("González");
        expect(res.data.ordenar_por).toBe("nombres");
      }
    });

    it("debe rechazar estadoOperativo inválido", () => {
      const res = ListarPersonalQuerySchema.safeParse({
        estadoOperativo: "DESCONOCIDO",
      });
      expect(res.success).toBe(false);
    });

    it("debe rechazar delegacionId que no sea UUID", () => {
      const res = ListarPersonalQuerySchema.safeParse({
        delegacionId: "invalido",
      });
      expect(res.success).toBe(false);
    });
  });

  describe("listarPersonalService", () => {
    it("debe calcular metadatos de paginación y mapear es_personal correctamente", async () => {
      vi.mocked(repo.listarPersonalPaginadoRepo).mockResolvedValueOnce({
        filas: [
          {
            usuario_id: "00000000-0000-4000-8000-000000000001",
            rut: "11111111-1",
            nombres: "Juan",
            apellidos: "Pérez",
            email: "juan@valdivia.cl",
            telefono: "+56911111111",
            usuario_activo: true,
            fecha_ingreso: "2026-01-01",
            fecha_salida: null,
            rol_id: "10000000-0000-4000-8000-000000000001",
            rol_codigo: "OPERARIO",
            rol_nombre: "Operario",
            delegacion_id: "30000000-0000-4000-8000-000000000001",
            delegacion_codigo: "NORTE",
            delegacion_nombre: "Norte",
            personal_id: "40000000-0000-4000-8000-000000000001",
            especialidad: "Motosierrista",
            cargo: "Operario de Terreno",
            estado_operativo: "disponible",
            disponible_terreno: true,
            observaciones: null,
            personal_updated_at: new Date(),
          },
        ] as any,
        total: 25,
      });

      const resultado = await listarPersonalService({
        page: 2,
        limit: 10,
        ordenarPor: "apellidos",
        orden: "asc",
      });

      expect(resultado.meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0].es_personal).toBe(true);
      expect(resultado.data[0].rut).toBe("11111111-1");
    });
  });
});
