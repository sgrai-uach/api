import { describe, it, expect } from "vitest";
import {
  NotificacionIdParamSchema,
  ActualizarEstadoNotificacionInputSchema,
  NotificacionMisionDetalleSchema,
  MisionPendienteTerrenoSchema,
  EstadoNotificacionMisionEnum,
} from "../notificacion-mision.schema";

describe("Notificacion Mision Schema (HU-35)", () => {
  describe("EstadoNotificacionMisionEnum", () => {
    it("debe aceptar los 4 estados canónicos del ciclo de vida", () => {
      const estados = ["PENDIENTE_ENVIO", "ENVIADA", "RECIBIDA", "LEIDA"];
      estados.forEach((e) => {
        expect(EstadoNotificacionMisionEnum.safeParse(e).success).toBe(true);
      });
    });

    it("debe rechazar estados desconocidos", () => {
      expect(EstadoNotificacionMisionEnum.safeParse("EN_CAMINO").success).toBe(false);
      expect(EstadoNotificacionMisionEnum.safeParse("CANCELADA").success).toBe(false);
      expect(EstadoNotificacionMisionEnum.safeParse("").success).toBe(false);
    });
  });

  describe("NotificacionIdParamSchema", () => {
    it("debe validar un UUID v4 correcto", () => {
      const uuid = "70000000-0000-4000-8000-000000000001";
      const result = NotificacionIdParamSchema.safeParse(uuid);
      expect(result.success).toBe(true);
    });

    it("debe rechazar cadenas que no sean UUID", () => {
      expect(NotificacionIdParamSchema.safeParse("12345").success).toBe(false);
      expect(NotificacionIdParamSchema.safeParse("not-a-uuid").success).toBe(false);
      expect(NotificacionIdParamSchema.safeParse("").success).toBe(false);
    });
  });

  describe("ActualizarEstadoNotificacionInputSchema", () => {
    it("debe aceptar 'RECIBIDA' y 'LEIDA'", () => {
      expect(ActualizarEstadoNotificacionInputSchema.safeParse({ estado: "RECIBIDA" }).success).toBe(true);
      expect(ActualizarEstadoNotificacionInputSchema.safeParse({ estado: "LEIDA" }).success).toBe(true);
    });

    it("debe rechazar 'PENDIENTE_ENVIO' o 'ENVIADA' como entrada de cliente", () => {
      expect(ActualizarEstadoNotificacionInputSchema.safeParse({ estado: "PENDIENTE_ENVIO" }).success).toBe(false);
      expect(ActualizarEstadoNotificacionInputSchema.safeParse({ estado: "ENVIADA" }).success).toBe(false);
    });

    it("debe rechazar cuerpo vacío o estados inválidos con mensaje descriptivo", () => {
      const result = ActualizarEstadoNotificacionInputSchema.safeParse({});
      expect(result.success).toBe(false);

      const resultInvalido = ActualizarEstadoNotificacionInputSchema.safeParse({ estado: "VISTA" });
      expect(resultInvalido.success).toBe(false);
      if (!resultInvalido.success) {
        expect(resultInvalido.error.issues[0].message).toContain(
          "El estado a actualizar debe ser 'RECIBIDA' o 'LEIDA'."
        );
      }
    });
  });

  describe("NotificacionMisionDetalleSchema", () => {
    it("debe validar la estructura completa de detalle de notificación", () => {
      const payload = {
        id: "70000000-0000-4000-8000-000000000001",
        misionId: "60000000-0000-4000-8000-000000000001",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
        estado: "RECIBIDA",
        intentosEnvio: 1,
        creadaAt: "2026-11-09T17:00:00.000Z",
        enviadaAt: "2026-11-09T17:00:01.000Z",
        recibidaAt: "2026-11-09T17:00:03.000Z",
        leidaAt: null,
      };

      const result = NotificacionMisionDetalleSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("MisionPendienteTerrenoSchema", () => {
    it("debe validar los datos mínimos requeridos por la PWA para desplegar alertas offline", () => {
      const payload = {
        notificacionId: "70000000-0000-4000-8000-000000000001",
        misionId: "60000000-0000-4000-8000-000000000001",
        codigoMision: "MIS-2026-0001",
        titulo: "Verificación de anegamiento",
        descripcion: "Evaluar calzada",
        tipoMision: "VERIFICACION",
        prioridad: "ALTA",
        estadoMision: "DESPACHADA",
        estadoNotificacion: "PENDIENTE_ENVIO",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
        incidenteId: "50000000-0000-4000-8000-000000000001",
        incidenteCodigo: "INC-2026-8869",
        incidenteFolio: "FOL-8869",
        tipoAfectacion: "Inundación",
        direccion: "Av. Ramón Picarte 1500",
        latitud: -39.819,
        longitud: -73.245,
        creadaAt: "2026-11-09T17:00:00.000Z",
        enviadaAt: null,
      };

      const result = MisionPendienteTerrenoSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });
});

