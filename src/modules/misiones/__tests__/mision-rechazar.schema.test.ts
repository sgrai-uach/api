import { describe, it, expect } from "vitest";
import {
  RechazarMisionInputSchema,
  RechazarMisionBodySchema,
  RechazarMisionResponseSchema,
} from "../mision.schema";

describe("HU-69: Esquemas Zod para Rechazo de Misión por Patrulla", () => {
  describe("RechazarMisionInputSchema", () => {
    it("debe fallar si no se proporciona ningún motivo de rechazo", () => {
      const resultado = RechazarMisionInputSchema.safeParse({});
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("al menos 5 caracteres");
      }
    });

    it("debe fallar si la justificación tiene menos de 5 caracteres (ej. 4 caracteres)", () => {
      const resultado = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "hola",
      });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("al menos 5 caracteres");
      }
    });

    it("debe fallar si la justificación contiene solo espacios en blanco que suman menos de 5 caracteres útiles", () => {
      const resultado = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "   abc ",
      });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("al menos 5 caracteres");
      }
    });

    it("debe aceptar justificación válida con snake_case ('justificacion_rechazo') >= 5 caracteres", () => {
      const payload = {
        justificacion_rechazo: "Pana mecánica en el móvil institucional",
      };
      const resultado = RechazarMisionInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.justificacionRechazo).toBe(
          "Pana mecánica en el móvil institucional"
        );
      }
    });

    it("debe aceptar justificación válida con camelCase ('justificacionRechazo') >= 5 caracteres", () => {
      const payload = {
        justificacionRechazo: "Ruta cortada por caída de árbol en camino Niebla",
      };
      const resultado = RechazarMisionInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.justificacionRechazo).toBe(
          "Ruta cortada por caída de árbol en camino Niebla"
        );
      }
    });

    it("debe aceptar coordenadas geográficas opcionales", () => {
      const payload = {
        justificacion_rechazo: "Emergencia con riesgo vital en desarrollo",
        latitud: -39.81422,
        longitud: -73.24589,
      };
      const resultado = RechazarMisionInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.latitud).toBe(-39.81422);
        expect(resultado.data.longitud).toBe(-73.24589);
      }
    });
  });

  describe("RechazarMisionBodySchema (OpenAPI)", () => {
    it("debe validar un payload formal para OpenAPI", () => {
      const payload = {
        justificacion_rechazo: "Corte de puente de acceso al sector",
        latitud: -39.82,
        longitud: -73.24,
      };
      const resultado = RechazarMisionBodySchema.safeParse(payload);
      expect(resultado.success).toBe(true);
    });

    it("debe rechazar con menos de 5 caracteres", () => {
      const payload = {
        justificacion_rechazo: "No",
      };
      const resultado = RechazarMisionBodySchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });
  });

  describe("RechazarMisionResponseSchema", () => {
    it("debe validar la estructura de respuesta exitosa", () => {
      const respuesta = {
        message: "Misión rechazada exitosamente. El incidente ha vuelto a estado REPORTADO para su reasignación.",
        data: {
          mision: {
            id: "60000000-0000-4000-8000-000000000050",
            codigo: "MIS-2026-8341",
            estado: "RECHAZADA",
            justificacionRechazo: "Desperfecto mecánico en el neumático delantero.",
            actualizadoEn: "2026-11-03T18:45:00.000Z",
          },
          patrulla: {
            id: "f1000000-0000-4000-8000-000000000001",
            nombre: "Patrulla Ánimas Norte 1",
            estado: "DISPONIBLE",
          },
          incidente: {
            id: "50000000-0000-4000-8000-000000000001",
            codigo: "INC-2026-1042",
            estado: "REPORTADO",
          },
          hito: {
            id: "70000000-0000-4000-8000-000000000002",
            hito: "RECHAZADA",
            descripcion: "Misión rechazada por patrulla: Desperfecto mecánico en el neumático delantero.",
            creadoEn: "2026-11-03T18:45:00.000Z",
          },
        },
      };

      const resultado = RechazarMisionResponseSchema.safeParse(respuesta);
      expect(resultado.success).toBe(true);
    });
  });
});

