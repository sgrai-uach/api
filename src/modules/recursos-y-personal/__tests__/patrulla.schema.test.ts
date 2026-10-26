import { describe, it, expect } from "vitest";
import {
  EstadoPatrullaEnum,
  ListarPatrullasQuerySchema,
  ActualizarEstadoPatrullaInputSchema,
  PatrullaIdParamSchema,
  PatrullaItemResponseSchema,
  CrearPatrullaInputSchema,
  CrearPatrullaResponseSchema,
  DesactivarPatrullaResponseSchema,
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

  describe("CrearPatrullaInputSchema (Alta de Patrulla - HU-83)", () => {
    const payloadValido = {
      codigo: "PV-NORTE-01",
      nombre: "Patrulla Rápida Norte 1",
      delegacionId: "30000000-0000-4000-8000-000000000001",
      vehiculoId: "e1000000-0000-4000-8000-000000000002",
      personalIds: ["b1000000-0000-4000-8000-000000000001"],
      usuarioLiderId: "c1000000-0000-4000-8000-000000000001",
    };

    it("debe validar exitosamente un payload completo y válido", () => {
      const resultado = CrearPatrullaInputSchema.safeParse(payloadValido);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.codigo).toBe("PV-NORTE-01");
        expect(resultado.data.personalIds).toHaveLength(1);
      }
    });

    it("debe aceptar payload válido sin vehiculoId ni usuarioLiderId opcionales", () => {
      const payloadMinimo = {
        codigo: "PV-SUR-02",
        delegacionId: "30000000-0000-4000-8000-000000000002",
        personalIds: ["b1000000-0000-4000-8000-000000000002"],
      };
      const resultado = CrearPatrullaInputSchema.safeParse(payloadMinimo);
      expect(resultado.success).toBe(true);
    });

    it("debe rechazar código vacío o menor a 3 caracteres", () => {
      const resultado = CrearPatrullaInputSchema.safeParse({
        ...payloadValido,
        codigo: "PV",
      });
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar código con caracteres inválidos (ej. espacios o símbolos raros)", () => {
      const resultado = CrearPatrullaInputSchema.safeParse({
        ...payloadValido,
        codigo: "PV NORTE #01",
      });
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar si personalIds está vacío", () => {
      const resultado = CrearPatrullaInputSchema.safeParse({
        ...payloadValido,
        personalIds: [],
      });
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar delegacionId con formato UUID inválido", () => {
      const resultado = CrearPatrullaInputSchema.safeParse({
        ...payloadValido,
        delegacionId: "invalido-no-uuid",
      });
      expect(resultado.success).toBe(false);
    });

    it("debe validar CrearPatrullaResponseSchema correctamente", () => {
      const dummyRes = {
        message: "Patrulla registrada exitosamente.",
        data: {
          id: "f1000000-0000-4000-8000-000000000001",
          codigo: "PV-NORTE-01",
          nombre: "Patrulla Norte",
          estado: "DISPONIBLE",
          latitud: null,
          longitud: null,
          ultimaActualizacionUbicacion: null,
          delegacion: null,
          vehiculo: null,
          lider: null,
          integrantes: [],
          misionActiva: null,
          creadoEn: "2026-10-24T18:00:00.000Z",
          actualizadoEn: "2026-10-24T18:00:00.000Z",
        },
      };
      const res = CrearPatrullaResponseSchema.safeParse(dummyRes);
      expect(res.success).toBe(true);
    });
  });

  describe("DesactivarPatrullaResponseSchema (HU-85)", () => {
    it("debe validar correctamente la estructura de respuesta tras la baja lógica", () => {
      const payloadBaja = {
        message: "Patrulla verificadora desactivada exitosamente.",
        data: {
          id: "f1000000-0000-4000-8000-000000000001",
          codigo: "PV-COSTA-01",
          nombre: "Patrulla Costa 01",
          estado: "NO_DISPONIBLE",
          activo: false,
          eliminadoEn: "2026-10-26T15:00:00.000Z",
          eliminadoPorId: "00000000-0000-4000-8000-000000000001",
          vehiculoLiberadoId: "e1000000-0000-4000-8000-000000000002",
          personalLiberadoIds: [
            "b1000000-0000-4000-8000-000000000001",
            "b1000000-0000-4000-8000-000000000002",
          ],
        },
      };

      const res = DesactivarPatrullaResponseSchema.safeParse(payloadBaja);
      expect(res.success).toBe(true);
    });

    it("debe rechazar si falta el campo activo o no es booleano", () => {
      const payloadInvalido = {
        message: "Patrulla verificadora desactivada exitosamente.",
        data: {
          id: "f1000000-0000-4000-8000-000000000001",
          nombre: "Patrulla Costa 01",
          estado: "NO_DISPONIBLE",
          eliminadoEn: "2026-10-26T15:00:00.000Z",
          personalLiberadoIds: [],
        },
      };

      const res = DesactivarPatrullaResponseSchema.safeParse(payloadInvalido);
      expect(res.success).toBe(false);
    });
  });
});
