import { describe, it, expect } from "vitest";
import {
  MisionIdParamSchema,
  MisionDetalleResponseSchema,
  MisionDetalleCompletoSchema,
  ReporteTerrenoDetalleSchema,
  CrearMisionVerificacionSchema,
} from "../mision.schema";

describe("Mision Schemas (HU-17)", () => {
  describe("MisionIdParamSchema", () => {
    it("debe validar correctamente un UUID válido", () => {
      const uuidValido = "60000000-0000-4000-8000-000000000001";
      const resultado = MisionIdParamSchema.safeParse(uuidValido);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data).toBe(uuidValido);
      }
    });

    it("debe fallar ante un UUID inválido", () => {
      const resultado = MisionIdParamSchema.safeParse("uuid-invalido-123");
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("debe ser un UUID válido");
      }
    });
  });

  describe("ReporteTerrenoDetalleSchema", () => {
    it("debe validar un reporte de terreno individual con adjuntos", () => {
      const reporte = {
        id: "e0000000-0000-4000-8000-000000000001",
        misionId: "60000000-0000-4000-8000-000000000001",
        evaluador: {
          id: "d0000000-0000-4000-8000-000000000001",
          nombre: "Juan Pérez",
          email: "juan.perez@valdivia.cl",
          rut: "12345678-9",
        },
        resumenTecnico: "Inspección técnica finalizada",
        accionesRealizadas: "Evaluación visual y despeje",
        requiereApoyoAdicional: false,
        danosEstimados: null,
        observaciones: "Sin novedad",
        personasAfectadas: 0,
        estadoTerreno: "FINALIZADO",
        adjuntos: [],
        creadoEn: "2026-10-02T10:00:00.000Z",
        actualizadoEn: "2026-10-02T10:00:00.000Z",
      };

      const resultado = ReporteTerrenoDetalleSchema.safeParse(reporte);
      expect(resultado.success).toBe(true);
    });
  });

  describe("MisionDetalleCompletoSchema", () => {
    it("debe validar un detalle completo con cuadrilla, incidente y reportes con adjuntos", () => {
      const payloadValido = {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-001",
        titulo: "Despeje de vía por caída de árbol",
        descripcion: "Retirar ramas y asegurar tendido eléctrico en Picarte",
        tipoMision: "ATENCION_CUADRILLA",
        estado: "EN_CURSO",
        prioridad: "ALTA",
        justificacionRechazo: null,
        fechaInicio: "2026-10-02T10:00:00.000Z",
        fechaCierre: null,
        creadoEn: "2026-10-02T09:30:00.000Z",
        actualizadoEn: "2026-10-02T10:00:00.000Z",
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
        incidente: {
          id: "a0000000-0000-4000-8000-000000000001",
          codigo: "INC-2026-001",
          codigoSeguimiento: "12345678",
          tipoAfectacion: "Caída de Árbol",
          descripcion: "Árbol bloqueando pista derecha",
          direccion: "Av. Ramón Picarte 1500, Valdivia",
          latitud: -39.825,
          longitud: -73.238,
          estado: "EN_ATENCION",
          prioridad: "ALTA",
          requiereAsistenciaSocial: false,
          delegacionNombre: "Sur",
        },
        prevencion: null,
        cuadrilla: {
          id: "50000000-0000-4000-8000-000000000001",
          nombre: "Cuadrilla Árboles y Vías 1",
          estado: "EN_MISION",
          delegacionNombre: "Sur",
          delegado: {
            id: "d0000000-0000-4000-8000-000000000001",
            nombre: "Juan Pérez",
            email: "juan.perez@valdivia.cl",
          },
          recursos: [
            {
              id: "b0000000-0000-4000-8000-000000000001",
              nombre: "Motosierra Stihl MS 382",
              tipo: "INDIVIDUAL",
              cantidadAsignada: 2,
            },
          ],
        },
        patrulla: null,
        bitacoraTiempos: [
          {
            hito: "CREACION",
            fecha: "2026-10-02",
            hora: "09:30:00",
            timestamp: "2026-10-02T09:30:00.000Z",
            descripcion: "Misión registrada",
          },
        ],
        reportesTerreno: [
          {
            id: "e0000000-0000-4000-8000-000000000001",
            misionId: "60000000-0000-4000-8000-000000000001",
            evaluador: {
              id: "d0000000-0000-4000-8000-000000000001",
              nombre: "Juan Pérez",
              email: "juan.perez@valdivia.cl",
              rut: "12345678-9",
            },
            resumenTecnico: "Se trozó tronco principal y se liberó una pista",
            accionesRealizadas: "Corte con motosierra y despeje manual",
            requiereApoyoAdicional: false,
            danosEstimados: "Sin daños a tendido de baja tensión",
            observaciones: "Calzada resbaladiza por lluvia",
            personasAfectadas: 0,
            estadoTerreno: "EN_PROCESO",
            adjuntos: [
              {
                id: "f0000000-0000-4000-8000-000000000001",
                nombreArchivo: "evidencia_corte_1.jpg",
                url: "/uploads/evidencia/evidencia_corte_1.jpg",
                tipoMime: "image/jpeg",
                tamanoBytes: 1542000,
                creadoEn: "2026-10-02T10:15:00.000Z",
              },
            ],
            creadoEn: "2026-10-02T10:20:00.000Z",
            actualizadoEn: "2026-10-02T10:20:00.000Z",
          },
        ],
      };

      const resultado = MisionDetalleCompletoSchema.safeParse(payloadValido);
      if (!resultado.success) {
        console.error("Errores validación:", resultado.error.issues);
      }
      expect(resultado.success).toBe(true);
    });

    it("debe validar correctamente el caso de estado vacío (sin reportes ni adjuntos)", () => {
      const payloadVacio = {
        id: "60000000-0000-4000-8000-000000000002",
        codigo: "MIS-2026-002",
        titulo: "Verificación de anegamiento",
        descripcion: null,
        tipoMision: "VERIFICACION",
        estado: "PLANIFICADA",
        prioridad: "MEDIA",
        justificacionRechazo: null,
        fechaInicio: null,
        fechaCierre: null,
        creadoEn: "2026-10-02T11:00:00.000Z",
        actualizadoEn: "2026-10-02T11:00:00.000Z",
        creadoPor: null,
        encargado: null,
        incidente: null,
        prevencion: {
          id: "c0000000-0000-4000-8000-000000000001",
          codigo: "PREV-01",
          nombre: "Humedal Angachilla - Punto Crítico",
          descripcion: "Monitoreo de compuertas y nivel de cota",
          latitud: -39.84,
          longitud: -73.22,
          delegacionNombre: "Sur",
        },
        cuadrilla: null,
        patrulla: {
          id: "c0000000-0000-4000-8000-000000000002",
          nombre: "Patrulla Costa-1",
          estado: "DISPONIBLE",
          delegacionNombre: "Costa",
          lider: null,
        },
        bitacoraTiempos: [],
        reportesTerreno: [],
      };

      const resultado = MisionDetalleCompletoSchema.safeParse(payloadVacio);
      if (!resultado.success) {
        console.error("Errores validación vacío:", resultado.error.issues);
      }
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.reportesTerreno).toHaveLength(0);
        expect(resultado.data.incidente).toBeNull();
        expect(resultado.data.prevencion?.codigo).toBe("PREV-01");
      }
    });

    it("debe validar la respuesta HTTP con MisionDetalleResponseSchema", () => {
      const respuesta = {
        message: "Detalle de misión obtenido exitosamente.",
        data: {
          id: "60000000-0000-4000-8000-000000000003",
          codigo: "MIS-2026-003",
          titulo: "Evaluación Social FIBE",
          descripcion: null,
          tipoMision: "ASISTENCIA_SOCIAL",
          estado: "COMPLETADA",
          prioridad: "CRITICA",
          justificacionRechazo: null,
          fechaInicio: "2026-10-02T08:00:00.000Z",
          fechaCierre: "2026-10-02T12:00:00.000Z",
          creadoEn: "2026-10-02T07:45:00.000Z",
          actualizadoEn: "2026-10-02T12:00:00.000Z",
          creadoPor: null,
          encargado: null,
          incidente: null,
          prevencion: null,
          cuadrilla: null,
          patrulla: null,
          bitacoraTiempos: [],
          reportesTerreno: [],
        },
      };

      const resultado = MisionDetalleResponseSchema.safeParse(respuesta);
      expect(resultado.success).toBe(true);
    });
  });

  describe("CrearMisionVerificacionSchema (HU-20)", () => {
    it("debe validar un payload correcto de despacho de patrulla", () => {
      const payload = {
        incidenteId: "50000000-0000-4000-8000-000000000001",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
        titulo: "Verificación de anegamiento en Las Ánimas",
        descripcion: "Evaluar anegamiento en patio de vivienda y riesgo eléctrico.",
        prioridad: "ALTA",
      };

      const resultado = CrearMisionVerificacionSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.tipoMision).toBe("VERIFICACION");
        expect(resultado.data.prioridad).toBe("ALTA");
      }
    });

    it("debe asignar tipoMision VERIFICACION por defecto si se omite", () => {
      const payloadMinimo = {
        incidenteId: "50000000-0000-4000-8000-000000000001",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
      };

      const resultado = CrearMisionVerificacionSchema.safeParse(payloadMinimo);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.tipoMision).toBe("VERIFICACION");
      }
    });

    it("debe fallar si incidenteId no es un UUID válido", () => {
      const payload = {
        incidenteId: "invalido",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
      };

      const resultado = CrearMisionVerificacionSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("identificador del incidente debe ser un UUID válido");
      }
    });

    it("debe fallar si patrullaId no es un UUID válido", () => {
      const payload = {
        incidenteId: "50000000-0000-4000-8000-000000000001",
        patrullaId: "patrulla-123",
      };

      const resultado = CrearMisionVerificacionSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("identificador de la patrulla verificadora debe ser un UUID válido");
      }
    });

    it("debe fallar si el título tiene menos de 3 caracteres", () => {
      const payload = {
        incidenteId: "50000000-0000-4000-8000-000000000001",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
        titulo: "Ok",
      };

      const resultado = CrearMisionVerificacionSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues[0].message).toContain("al menos 3 caracteres");
      }
    });
  });
});

