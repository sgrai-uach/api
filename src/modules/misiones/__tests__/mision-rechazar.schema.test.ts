import { describe, it, expect } from "vitest";
import {
  RechazarMisionInputSchema,
  RechazarMisionBodySchema,
  RechazarMisionResponseSchema,
} from "../mision.schema";

describe("HU-41: Esquemas Zod para Rechazo de Misión por Delegado de Cuadrilla", () => {
  describe("RechazarMisionInputSchema", () => {
    it("debe fallar con 400 si no se proporciona justificación", () => {
      const resultado = RechazarMisionInputSchema.safeParse({});
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("al menos 5 caracteres");
      }
    });

    it("debe fallar si justificacion_rechazo está vacía", () => {
      const resultado = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "",
      });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("al menos 5 caracteres");
      }
    });

    it("debe fallar si justificacion_rechazo tiene menos de 5 caracteres (ej. 4 caracteres)", () => {
      const resultado = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "abcd",
      });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("al menos 5 caracteres");
      }
    });

    it("debe fallar si la justificación con espacios tiene menos de 5 caracteres útiles", () => {
      const resultado = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "   abc ",
      });
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("al menos 5 caracteres");
      }
    });

    it("debe aceptar justificacion_rechazo en snake_case con 5 o más caracteres", () => {
      const resultado = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "Falla hidráulica en camión tolva",
      });
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.justificacionRechazo).toBe(
          "Falla hidráulica en camión tolva"
        );
      }
    });

    it("debe aceptar justificacionRechazo en camelCase con 5 o más caracteres", () => {
      const resultado = RechazarMisionInputSchema.safeParse({
        justificacionRechazo: "Acceso bloqueado por deslizamiento",
      });
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.justificacionRechazo).toBe(
          "Acceso bloqueado por deslizamiento"
        );
      }
    });

    it("debe aceptar coordenadas geográficas opcionales en paridad", () => {
      const resultado = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "Camión con desperfecto mecánico en ruta",
        latitud: -39.81422,
        longitud: -73.24589,
      });
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.latitud).toBe(-39.81422);
        expect(resultado.data.longitud).toBe(-73.24589);
      }
    });

    it("debe fallar si se envía latitud sin longitud o viceversa", () => {
      const soloLat = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "Motivo válido de rechazo",
        latitud: -39.81422,
      });
      expect(soloLat.success).toBe(false);

      const soloLng = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "Motivo válido de rechazo",
        longitud: -73.24589,
      });
      expect(soloLng.success).toBe(false);
    });

    it("debe fallar si las coordenadas están fuera de rango WGS84", () => {
      const latInvalida = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "Motivo válido de rechazo",
        latitud: -95,
        longitud: -73.245,
      });
      expect(latInvalida.success).toBe(false);

      const lngInvalida = RechazarMisionInputSchema.safeParse({
        justificacion_rechazo: "Motivo válido de rechazo",
        latitud: -39.814,
        longitud: 185,
      });
      expect(lngInvalida.success).toBe(false);
    });
  });

  describe("RechazarMisionBodySchema (OpenAPI)", () => {
    it("debe rechazar menos de 5 caracteres", () => {
      const resultado = RechazarMisionBodySchema.safeParse({
        justificacion_rechazo: "1234",
      });
      expect(resultado.success).toBe(false);
    });

    it("debe validar cuerpo correcto", () => {
      const resultado = RechazarMisionBodySchema.safeParse({
        justificacion_rechazo: "Falla mecánica grave",
      });
      expect(resultado.success).toBe(true);
    });
  });

  describe("RechazarMisionResponseSchema", () => {
    it("debe validar el contrato de respuesta exitoso", () => {
      const respuesta = {
        message:
          "Misión rechazada exitosamente. La cuadrilla ha vuelto a estado DISPONIBLE y el incidente ha retornado a VERIFICANDO para su reasignación.",
        data: {
          mision: {
            id: "70000000-0000-4000-8000-000000000001",
            codigo: "MIS-2026-0005",
            tipoMision: "ATENCION_CUADRILLA",
            estado: "RECHAZADA",
            justificacionRechazo: "Falla hidráulica en camión tolva",
            fechaCierre: "2026-11-16T23:15:00.000Z",
            actualizadoEn: "2026-11-16T23:15:00.000Z",
          },
          cuadrilla: {
            id: "50000000-0000-4000-8000-000000000001",
            nombre: "Cuadrilla Vías y Canales 1",
            estado: "DISPONIBLE",
            delegacionId: "30000000-0000-4000-8000-000000000001",
            usuarioDelegadoId: "d0000000-0000-4000-8000-000000000001",
          },
          incidente: {
            id: "30000000-0000-4000-8000-000000000001",
            codigo: "INC-2026-0001",
            estado: "VERIFICANDO",
            prioridad: "ALTA",
          },
          hito: {
            id: "80000000-0000-4000-8000-000000000099",
            misionId: "70000000-0000-4000-8000-000000000001",
            hito: "RECHAZADA",
            descripcion: "Misión rechazada por cuadrilla: Falla hidráulica en camión tolva",
            registradoPorId: "d0000000-0000-4000-8000-000000000001",
            latitud: -39.81422,
            longitud: -73.24589,
            creadoEn: "2026-11-16T23:15:00.000Z",
          },
        },
      };

      const resultado = RechazarMisionResponseSchema.safeParse(respuesta);
      expect(resultado.success).toBe(true);
    });
  });
});
