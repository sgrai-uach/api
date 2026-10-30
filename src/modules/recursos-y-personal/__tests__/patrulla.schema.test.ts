import { describe, it, expect } from "vitest";
import {
  EstadoPatrullaEnum,
  ListarPatrullasQuerySchema,
  ActualizarEstadoPatrullaInputSchema,
  PatrullaIdParamSchema,
  PatrullaItemResponseSchema,
} from "../patrulla.schema";

describe("Módulo Recursos y Personal - Patrullas Verificadoras Schemas", () => {
  describe("EstadoPatrullaEnum (Valores canónicos)", () => {
    it("debe aceptar exactamente los 6 estados canónicos en mayúsculas", () => {
      const estadosValidos = [
        "DISPONIBLE",
        "EN_VERIFICACION",
        "EN_PREVENCION",
        "EN_RECUPERACION",
        "EN_MISION",
        "NO_DISPONIBLE",
      ];

      for (const estado of estadosValidos) {
        const resultado = EstadoPatrullaEnum.safeParse(estado);
        expect(resultado.success).toBe(true);
      }
    });

    it("debe rechazar estados no canónicos o en minúsculas", () => {
      const estadosInvalidos = [
        "Ocupada",
        "disponible",
        "LIBRE",
        "EN_CAMINO",
        "ATENDIENDO",
        "En Misión",
      ];

      for (const estado of estadosInvalidos) {
        const resultado = EstadoPatrullaEnum.safeParse(estado);
        expect(resultado.success).toBe(false);
      }
    });
  });

  describe("ListarPatrullasQuerySchema", () => {
    it("debe asignar valores predeterminados a page=1 y limit=20", () => {
      const resultado = ListarPatrullasQuerySchema.safeParse({});
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.page).toBe(1);
        expect(resultado.data.limit).toBe(20);
      }
    });

    it("debe admitir filtros de delegacionId y estado canónico", () => {
      const query = {
        delegacionId: "30000000-0000-4000-8000-000000000001",
        estado: "DISPONIBLE",
        busqueda: "Costa",
        page: "2",
        limit: "15",
      };

      const resultado = ListarPatrullasQuerySchema.safeParse(query);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.delegacionId).toBe("30000000-0000-4000-8000-000000000001");
        expect(resultado.data.estado).toBe("DISPONIBLE");
        expect(resultado.data.busqueda).toBe("Costa");
        expect(resultado.data.page).toBe(2);
        expect(resultado.data.limit).toBe(15);
      }
    });

    it("debe rechazar delegacionId que no sea un UUID válido", () => {
      const resultado = ListarPatrullasQuerySchema.safeParse({
        delegacionId: "invalido-123",
      });
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar limit superior a 100", () => {
      const resultado = ListarPatrullasQuerySchema.safeParse({
        limit: "150",
      });
      expect(resultado.success).toBe(false);
    });
  });

  describe("PatrullaIdParamSchema", () => {
    it("debe validar correctamente un UUID v4", () => {
      const resultado = PatrullaIdParamSchema.safeParse(
        "f1000000-0000-4000-8000-000000000001"
      );
      expect(resultado.success).toBe(true);
    });

    it("debe fallar ante cadenas no UUID", () => {
      const resultado = PatrullaIdParamSchema.safeParse("patrulla-alfa-1");
      expect(resultado.success).toBe(false);
    });
  });

  describe("ActualizarEstadoPatrullaInputSchema", () => {
    it("debe validar un cambio de estado válido sin coordenadas", () => {
      const resultado = ActualizarEstadoPatrullaInputSchema.safeParse({
        estado: "EN_VERIFICACION",
        motivo: "Despacho a reporte de remoción en masa",
      });
      expect(resultado.success).toBe(true);
    });

    it("debe validar cambio de estado con coordenadas válidas de Valdivia", () => {
      const resultado = ActualizarEstadoPatrullaInputSchema.safeParse({
        estado: "DISPONIBLE",
        latitud: -39.819588,
        longitud: -73.245209,
      });
      expect(resultado.success).toBe(true);
    });

    it("debe rechazar coordenadas fuera de rango", () => {
      const resultado = ActualizarEstadoPatrullaInputSchema.safeParse({
        estado: "DISPONIBLE",
        latitud: 95.5,
        longitud: -73.245209,
      });
      expect(resultado.success).toBe(false);
    });
  });

  describe("PatrullaItemResponseSchema", () => {
    it("debe estructurar correctamente la respuesta con integrantes y misión activa", () => {
      const dummyPatrulla = {
        id: "f1000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Rápida Costa-1",
        estado: "EN_VERIFICACION",
        latitud: -39.86523,
        longitud: -73.39841,
        ultimaActualizacionUbicacion: "2026-10-20T22:00:00.000Z",
        delegacion: {
          id: "30000000-0000-4000-8000-000000000003",
          nombre: "Delegación Municipal Costa",
          codigo: "DEL_COSTA",
        },
        lider: {
          id: "00000000-0000-4000-8000-000000000003",
          nombre: "Encargado de Operaciones",
          email: "encargado@valdivia.cl",
          telefono: "+56911112222",
          rut: "33333333-3",
        },
        integrantes: [
          {
            id: "b1000000-0000-4000-8000-000000000001",
            usuarioId: "c1000000-0000-4000-8000-000000000001",
            nombre: "Juan Brigadista",
            email: "juan@valdivia.cl",
            telefono: "+56999998888",
            rut: "18111222-3",
            cargo: "Evaluador Rápido",
            especialidad: "Riesgos Geológicos",
            rolEnPatrulla: "OPERATIVO",
            estadoOperativo: "en_patrulla",
          },
        ],
        misionActiva: {
          id: "d1000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0001",
          titulo: "Evaluación preliminar de riesgo de derrumbe",
          tipoMision: "VERIFICACION",
          estado: "EN_CURSO",
          prioridad: "CRITICA",
          incidenteId: "a1000000-0000-4000-8000-000000000003",
          incidenteCodigo: "INC-2026-0003",
          incidenteFolio: "FOL-2026-0003",
          incidenteTipoAfectacion: "Deslizamiento de Tierra",
          incidenteDireccion: "Ruta T-350 km 12, Valdivia",
        },
        creadoEn: "2026-10-20T10:00:00.000Z",
        actualizadoEn: "2026-10-20T22:30:00.000Z",
      };

      const resultado = PatrullaItemResponseSchema.safeParse(dummyPatrulla);
      expect(resultado.success).toBe(true);
    });
  });
});
