import { describe, it, expect } from "vitest";
import {
  ListarIncidentesQuerySchema,
  IncidenteResumenSchema,
  IncidenteDetalleSchema,
} from "../incidente-kanban.schema";

describe("Esquemas de Tablero Kanban e Incidentes", () => {
  describe("ListarIncidentesQuerySchema", () => {
    it("debe aplicar valores por defecto de paginación (page=1, limit=20) ante un objeto vacío", () => {
      const resultado = ListarIncidentesQuerySchema.safeParse({});
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.page).toBe(1);
        expect(resultado.data.limit).toBe(20);
        expect(resultado.data.estado).toBeUndefined();
      }
    });

    it("debe transformar y aceptar cadenas numéricas para page y limit", () => {
      const resultado = ListarIncidentesQuerySchema.safeParse({
        page: "3",
        limit: "50",
        estado: "VERIFICANDO",
        prioridad: "ALTA",
        tipoAfectacion: "Deslizamiento de tierra",
        busqueda: "Picarte",
      });

      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.page).toBe(3);
        expect(resultado.data.limit).toBe(50);
        expect(resultado.data.estado).toBe("VERIFICANDO");
        expect(resultado.data.prioridad).toBe("ALTA");
        expect(resultado.data.tipoAfectacion).toBe("Deslizamiento de tierra");
        expect(resultado.data.busqueda).toBe("Picarte");
      }
    });

    it("debe rechazar page menor a 1", () => {
      const resultado = ListarIncidentesQuerySchema.safeParse({ page: 0 });
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar limit menor a 1 o mayor a 100", () => {
      const menor = ListarIncidentesQuerySchema.safeParse({ limit: 0 });
      expect(menor.success).toBe(false);

      const mayor = ListarIncidentesQuerySchema.safeParse({ limit: 101 });
      expect(mayor.success).toBe(false);
    });

    it("debe rechazar estados no válidos", () => {
      const resultado = ListarIncidentesQuerySchema.safeParse({ estado: "INEXISTENTE" });
      expect(resultado.success).toBe(false);
    });

    it("debe aceptar delegacionId UUID válido y fuenteOrigen enum válido", () => {
      const resultado = ListarIncidentesQuerySchema.safeParse({
        delegacionId: "30000000-0000-4000-8000-000000000001",
        fuenteOrigen: "LLAMADA_TELEFONICA",
      });
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.delegacionId).toBe("30000000-0000-4000-8000-000000000001");
        expect(resultado.data.fuenteOrigen).toBe("LLAMADA_TELEFONICA");
      }
    });

    it("debe rechazar delegacionId que no sea un UUID válido", () => {
      const resultado = ListarIncidentesQuerySchema.safeParse({
        delegacionId: "no-es-uuid",
      });
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar fuenteOrigen no permitida", () => {
      const resultado = ListarIncidentesQuerySchema.safeParse({
        fuenteOrigen: "INVALIDA",
      });
      expect(resultado.success).toBe(false);
    });
  });

  describe("IncidenteResumenSchema", () => {
    it("debe validar un resumen de incidente completo", () => {
      const valido = {
        id: "a0000000-0000-4000-8000-000000000001",
        codigo: "INC-58291045",
        codigoSeguimiento: "58291045",
        tipoAfectacion: "Inundación",
        descripcion: "Calle anegada",
        direccion: "Av. Ramón Picarte 1200",
        latitud: -39.8142,
        longitud: -73.2459,
        estado: "REPORTADO",
        prioridad: "MEDIA",
        requiereAsistenciaSocial: false,
        fuenteOrigen: "CHATBOT",
        informanteNombre: "Juan Pérez",
        delegacionNombre: "Sur",
        totalMisiones: 2,
        creadoEn: "2026-09-22T12:00:00.000Z",
        actualizadoEn: "2026-09-22T12:00:00.000Z",
      };

      const resultado = IncidenteResumenSchema.safeParse(valido);
      expect(resultado.success).toBe(true);
    });
  });

  describe("IncidenteDetalleSchema", () => {
    it("debe validar un detalle exhaustivo con misiones y recursos asociados", () => {
      const detalle = {
        id: "a0000000-0000-4000-8000-000000000001",
        codigo: "INC-58291045",
        codigoSeguimiento: "58291045",
        tipoAfectacion: "Inundación",
        descripcion: "Sótano inundado con riesgo de cortocircuito",
        direccion: "Av. España 450",
        latitud: -39.82,
        longitud: -73.23,
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiereAsistenciaSocial: true,
        fuenteOrigen: "LLAMADA_TELEFONICA",
        asteriskCallId: "CALL-12345",
        asteriskCallerPhone: "+56911223344",
        informante: {
          id: "b0000000-0000-4000-8000-000000000001",
          rut: "12.345.678-9",
          nombre: "María González",
          telefono: "+56911223344",
        },
        delegacion: {
          id: "30000000-0000-4000-8000-000000000001",
          nombre: "Norte",
          descripcion: "Sector Norte",
        },
        creadoPor: {
          id: "00000000-0000-4000-8000-000000000002",
          nombre: "Operador Call Center",
          email: "callcenter@valdivia.cl",
        },
        encargado: {
          id: "00000000-0000-4000-8000-000000000003",
          nombre: "Encargado de Operaciones",
          email: "encargado@valdivia.cl",
        },
        misiones: [
          {
            id: "c0000000-0000-4000-8000-000000000001",
            codigo: "MIS-2026-0001",
            titulo: "Desagüe y mitigación de anegamiento",
            descripcion: "Despliegue de motobomba y cuadrilla de sumideros",
            tipoMision: "ATENCION_CUADRILLA",
            estado: "EN_CURSO",
            prioridad: "ALTA",
            justificacionRechazo: null,
            patrulla: null,
            cuadrilla: {
              id: "d0000000-0000-4000-8000-000000000001",
              nombre: "Cuadrilla Alfa Aguas Lluvias",
              estado: "EN_MISION",
            },
            fechaInicio: "2026-09-22T13:00:00.000Z",
            fechaCierre: null,
            creadoEn: "2026-09-22T12:30:00.000Z",
          },
        ],
        recursosAsociados: [
          {
            recursoId: "e0000000-0000-4000-8000-000000000001",
            nombre: "Motobomba 4 pulgadas",
            esIndividual: true,
            cantidadAsignadaTotal: 1,
            estadoRecurso: "DISPONIBLE",
            cuadrillaNombre: "Cuadrilla Alfa Aguas Lluvias",
          },
        ],
        creadoEn: "2026-09-22T12:00:00.000Z",
        actualizadoEn: "2026-09-22T13:10:00.000Z",
      };

      const resultado = IncidenteDetalleSchema.safeParse(detalle);
      expect(resultado.success).toBe(true);
    });
  });
});
