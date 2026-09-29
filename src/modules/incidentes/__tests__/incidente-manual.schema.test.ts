import { describe, it, expect } from "vitest";
import {
  CrearIncidenteManualInputSchema,
  VerificarDuplicadoInputSchema,
  EstadoIncidenteEnum,
  PrioridadIncidenteEnum,
  OrigenReporteEnum,
} from "../aviso-incidente.schema";

describe("Módulo Incidentes - Esquemas de Ingreso Manual y Duplicados", () => {
  describe("1. Validaciones de CrearIncidenteManualInputSchema", () => {
    it("debe aceptar un reporte manual válido originado por Llamada Telefónica", () => {
      const payload = {
        origenReporte: "LLAMADA_TELEFONICA",
        tipoAfectacion: "Anegamiento",
        descripcion: "Agua ingresando a patio de vivienda",
        direccion: "Av. Alemania 550, Valdivia",
        informanteNombre: "Carlos Munita",
        informanteRut: "11111111-1",
        informanteTelefono: "+56998765432",
        asteriskCallId: "asterisk-uniqueid-12345",
        asteriskCallerPhone: "632223344",
        prioridad: "ALTA",
        requiereAsistenciaSocial: true,
      };

      const resultado = CrearIncidenteManualInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.origenReporte).toBe("LLAMADA_TELEFONICA");
        expect(resultado.data.prioridad).toBe("ALTA");
        expect(resultado.data.forzarCreacion).toBe(false);
      }
    });

    it("debe aceptar un reporte manual válido originado por Funcionario en Terreno sin coordenadas previas", () => {
      const payload = {
        origenReporte: "FUNCIONARIO_TERRENO",
        tipoAfectacion: "Caída de árbol",
        descripcion: "Gran rama bloqueando calzada poniente",
        direccion: "Calle Picarte 2500",
        informanteNombre: "Inspector Patricio Soto",
        informanteRut: "12.345.678-5",
      };

      const resultado = CrearIncidenteManualInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.prioridad).toBe("MEDIA");
        expect(resultado.data.latitud).toBeUndefined();
        expect(resultado.data.longitud).toBeUndefined();
      }
    });

    it("debe aceptar un reporte con coordenadas GPS manuales", () => {
      const payload = {
        origenReporte: "LLAMADA_TELEFONICA",
        tipoAfectacion: "Deslizamiento",
        descripcion: "Caída de tierra en ladera",
        direccion: "Camino a Niebla km 7",
        latitud: -39.8654,
        longitud: -73.3912,
        informanteNombre: "Vecino Niebla",
        informanteRut: "11111112-K",
      };

      const resultado = CrearIncidenteManualInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.latitud).toBe(-39.8654);
        expect(resultado.data.longitud).toBe(-73.3912);
      }
    });

    it("debe rechazar un origen de reporte no reconocido", () => {
      const payload = {
        origenReporte: "PALOMA_MENSAJERA",
        tipoAfectacion: "Anegamiento",
        descripcion: "Agua en calle",
        direccion: "Av. Simpson 120",
        informanteNombre: "Test",
        informanteRut: "11111111-1",
      };

      const resultado = CrearIncidenteManualInputSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar un reporte con RUT de informante inválido", () => {
      const payload = {
        origenReporte: "LLAMADA_TELEFONICA",
        tipoAfectacion: "Anegamiento",
        descripcion: "Agua en calle",
        direccion: "Av. Simpson 120",
        informanteNombre: "Test",
        informanteRut: "11111111-9", // DV erróneo
      };

      const resultado = CrearIncidenteManualInputSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("dígito verificador");
      }
    });

    it("debe rechazar reportes con descripción o dirección demasiado corta (< 5 caracteres)", () => {
      const payloadCorto = {
        origenReporte: "LLAMADA_TELEFONICA",
        tipoAfectacion: "Anegamiento",
        descripcion: "Ola",
        direccion: "Val",
        informanteNombre: "Ab",
        informanteRut: "11111111-1",
      };

      const resultado = CrearIncidenteManualInputSchema.safeParse(payloadCorto);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe("2. Validaciones de VerificarDuplicadoInputSchema", () => {
    it("debe validar correctamente los parámetros de verificación espacial", () => {
      const payload = {
        tipoAfectacion: "Caída de árbol",
        direccion: "Calle Errázuriz 1500",
        radioMetros: 500,
        horasVentana: 12,
      };

      const resultado = VerificarDuplicadoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.radioMetros).toBe(500);
        expect(resultado.data.horasVentana).toBe(12);
      }
    });

    it("debe aplicar los valores por defecto de radio (300m) y ventana (24h)", () => {
      const payload = {
        tipoAfectacion: "Deslizamiento",
        direccion: "Niebla Alto",
      };

      const resultado = VerificarDuplicadoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.radioMetros).toBe(300);
        expect(resultado.data.horasVentana).toBe(24);
      }
    });
  });

  describe("3. Enums del ciclo de vida", () => {
    it("debe incluir todos los estados definidos para el ciclo de vida", () => {
      expect(EstadoIncidenteEnum.options).toEqual([
        "REPORTADO",
        "VERIFICANDO",
        "EN_ATENCION",
        "NO_ABORDABLE",
        "RESUELTO",
      ]);
    });

    it("debe incluir todas las prioridades", () => {
      expect(PrioridadIncidenteEnum.options).toEqual(["BAJA", "MEDIA", "ALTA", "CRITICA"]);
    });

    it("debe incluir los orígenes manuales permitidos", () => {
      expect(OrigenReporteEnum.options).toEqual(["LLAMADA_TELEFONICA", "FUNCIONARIO_TERRENO"]);
    });
  });
});
