import { describe, it, expect } from "vitest";
import { determinarEstadoRecurso } from "../recurso.utils";
import {
  CrearRecursoInputSchema,
  DetallesRecursoSchema,
} from "../recurso.schema";
import { crearRecurso } from "../recurso.service";
import { UnauthorizedError } from "@/modules/seguridad/auth.errors";

describe("Módulo Recursos y Personal - Pruebas Unitarias", () => {
  describe("1. Reglas de Cálculo de Estado (determinarEstadoRecurso)", () => {
    it("debe retornar NO_DISPONIBLE si la cantidad en inventario es 0", () => {
      expect(determinarEstadoRecurso(0, 10)).toBe("NO_DISPONIBLE");
      expect(determinarEstadoRecurso(0, 0)).toBe("NO_DISPONIBLE");
    });

    it("debe retornar NO_DISPONIBLE si la cantidad en inventario es negativa", () => {
      expect(determinarEstadoRecurso(-5, 10)).toBe("NO_DISPONIBLE");
    });

    it("debe retornar BAJO_STOCK si la cantidad en inventario es menor o igual al umbral mínimo", () => {
      expect(determinarEstadoRecurso(5, 10)).toBe("BAJO_STOCK");
      expect(determinarEstadoRecurso(10, 10)).toBe("BAJO_STOCK");
      expect(determinarEstadoRecurso(1, 20)).toBe("BAJO_STOCK");
    });

    it("debe retornar DISPONIBLE si la cantidad en inventario supera el umbral mínimo", () => {
      expect(determinarEstadoRecurso(11, 10)).toBe("DISPONIBLE");
      expect(determinarEstadoRecurso(50, 20)).toBe("DISPONIBLE");
    });

    it("debe retornar DISPONIBLE cuando el umbral mínimo es 0 y hay stock disponible (alerta desactivada)", () => {
      expect(determinarEstadoRecurso(1, 0)).toBe("DISPONIBLE");
      expect(determinarEstadoRecurso(500, 0)).toBe("DISPONIBLE");
    });
  });

  describe("2. Validación de Esquema Zod (CrearRecursoInputSchema)", () => {
    it("debe aceptar un recurso a granel válido (ej. Sacos de arena)", () => {
      const payload = {
        nombre: "Sacos de Arena",
        esIndividual: false,
        cantidadInventario: 500,
        cantidadMinima: 100,
        latitud: -39.8142,
        longitud: -73.2459,
        descripcion: "Sacos de contención para crecida de ríos",
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.nombre).toBe("Sacos de Arena");
        expect(resultado.data.esIndividual).toBe(false);
      }
    });

    it("debe aceptar una Camioneta con atributos específicos (patente, kilometraje, combustible)", () => {
      const payload = {
        nombre: "Camioneta Operaciones 4x4",
        esIndividual: true,
        cantidadInventario: 1,
        cantidadMinima: 0,
        latitud: -39.817,
        longitud: -73.242,
        detalles: {
          patente: "ABCD-12",
          marca: "Toyota",
          modelo: "Hilux",
          anio: 2023,
          kilometraje: 45000,
          tipoCombustible: "DIESEL",
          capacidadPasajeros: 5,
        },
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.detalles.kilometraje).toBe(45000);
        expect(resultado.data.detalles.patente).toBe("ABCD-12");
      }
    });

    it("debe aceptar una Grúa con capacidad de carga, alcance y horómetro", () => {
      const payload = {
        nombre: "Grúa Pluma 50T",
        esIndividual: true,
        cantidadInventario: 1,
        cantidadMinima: 0,
        latitud: -39.82,
        longitud: -73.25,
        detalles: {
          marca: "Liebherr",
          modelo: "LTM 1050",
          capacidadCargaKg: 50000,
          alcanceMaximoMetros: 38,
          tipoGrua: "Pluma",
          horometro: 1200,
        },
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.detalles.capacidadCargaKg).toBe(50000);
        expect(resultado.data.detalles.alcanceMaximoMetros).toBe(38);
        expect(resultado.data.detalles.horometro).toBe(1200);
      }
    });

    it("debe aceptar una Motobomba con caudal en LPM, diámetro y potencia HP", () => {
      const payload = {
        nombre: "Motobomba de Achique 3 Pulgadas",
        esIndividual: true,
        cantidadInventario: 1,
        cantidadMinima: 0,
        latitud: -39.815,
        longitud: -73.243,
        detalles: {
          marca: "Honda",
          modelo: "WT30X",
          caudalMaximoLpm: 1200,
          diametroPulgadas: 3,
          potenciaHp: 8.5,
          horometro: 45,
        },
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.detalles.caudalMaximoLpm).toBe(1200);
        expect(resultado.data.detalles.diametroPulgadas).toBe(3);
        expect(resultado.data.detalles.potenciaHp).toBe(8.5);
      }
    });

    it("debe rechazar nombres demasiado cortos (< 3 caracteres)", () => {
      const payload = {
        nombre: "AB",
        cantidadInventario: 1,
        latitud: -39.8142,
        longitud: -73.2459,
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar cantidades de inventario negativas", () => {
      const payload = {
        nombre: "Generador Eléctrico",
        cantidadInventario: -1,
        latitud: -39.8142,
        longitud: -73.2459,
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar coordenadas geográficas fuera de rango", () => {
      const payloadLatInvalida = {
        nombre: "Generador Eléctrico",
        cantidadInventario: 1,
        latitud: 95, // Max 90
        longitud: -73.2459,
      };
      expect(CrearRecursoInputSchema.safeParse(payloadLatInvalida).success).toBe(false);

      const payloadLngInvalida = {
        nombre: "Generador Eléctrico",
        cantidadInventario: 1,
        latitud: -39.8142,
        longitud: -185, // Min -180
      };
      expect(CrearRecursoInputSchema.safeParse(payloadLngInvalida).success).toBe(false);
    });

    it("debe rechazar valores numéricos técnicos negativos en detalles", () => {
      expect(DetallesRecursoSchema.safeParse({ kilometraje: -100 }).success).toBe(false);
      expect(DetallesRecursoSchema.safeParse({ capacidadCargaKg: -5 }).success).toBe(false);
      expect(DetallesRecursoSchema.safeParse({ caudalMaximoLpm: 0 }).success).toBe(false);
      expect(DetallesRecursoSchema.safeParse({ diametroPulgadas: -1 }).success).toBe(false);
      expect(DetallesRecursoSchema.safeParse({ horometro: -1 }).success).toBe(false);
    });
  });

  describe("3. Autorización y Servicio de Creación (crearRecurso)", () => {
    it("debe arrojar UnauthorizedError si la cabecera X-User-Id está ausente", async () => {
      const input = {
        nombre: "Generador 5kVA",
        esIndividual: true,
        cantidadInventario: 1,
        cantidadMinima: 0,
        latitud: -39.8142,
        longitud: -73.2459,
        detalles: {},
      };

      await expect(crearRecurso(input, null)).rejects.toThrow(UnauthorizedError);
      await expect(crearRecurso(input, "")).rejects.toThrow(UnauthorizedError);
    });
  });
});
