import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listarIncidentesKanbanService,
  obtenerDetalleIncidenteService,
} from "../incidente-kanban.service";
import * as repo from "../incidente-kanban.repository";

vi.mock("../incidente-kanban.repository", () => ({
  listarIncidentesPaginadosRepo: vi.fn(),
  obtenerIncidenteDetallePorIdRepo: vi.fn(),
}));

describe("Servicio de Tablero Kanban e Incidentes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listarIncidentesKanbanService", () => {
    it("debe calcular correctamente los metadatos de paginación y mapear las filas", async () => {
      const mockFilas: repo.FilaIncidenteResumen[] = [
        {
          id: "a0000000-0000-4000-8000-000000000001",
          codigo: "INC-12345678",
          codigo_seguimiento: "12345678",
          tipo_afectacion: "Inundación",
          descripcion: "Sumidero tapado",
          direccion_texto: "Calle Valdivia 100",
          latitud: -39.81,
          longitud: -73.24,
          estado: "REPORTADO",
          prioridad: "MEDIA",
          requiere_asistencia_social: false,
          fuente_origen: "CHATBOT",
          informante_nombre: "Pedro Soto",
          delegacion_nombre: "Norte",
          total_misiones: 1,
          creado_en: new Date("2026-09-22T10:00:00Z"),
          actualizado_en: new Date("2026-09-22T10:00:00Z"),
        },
      ];

      vi.mocked(repo.listarIncidentesPaginadosRepo).mockResolvedValueOnce({
        filas: mockFilas,
        total: 45,
      });

      const resultado = await listarIncidentesKanbanService({
        page: 2,
        limit: 10,
      });

      expect(resultado.message).toBe("Listado de incidentes obtenido exitosamente");
      expect(resultado.meta).toEqual({
        total: 45,
        page: 2,
        limit: 10,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });
      expect(resultado.paginacion).toEqual({
        total: 45,
        pagina: 2,
        limite: 10,
        totalPaginas: 5,
        tieneSiguiente: true,
        tieneAnterior: true,
      });
      expect(resultado.data).toHaveLength(1);
      expect(resultado.data[0].id).toBe("a0000000-0000-4000-8000-000000000001");
      expect(resultado.data[0].totalMisiones).toBe(1);
    });

    it("debe manejar correctamente página final sin siguiente", async () => {
      vi.mocked(repo.listarIncidentesPaginadosRepo).mockResolvedValueOnce({
        filas: [],
        total: 10,
      });

      const resultado = await listarIncidentesKanbanService({
        page: 1,
        limit: 10,
      });

      expect(resultado.meta.totalPages).toBe(1);
      expect(resultado.meta.hasNext).toBe(false);
      expect(resultado.meta.hasPrev).toBe(false);
      expect(resultado.paginacion?.totalPaginas).toBe(1);
      expect(resultado.paginacion?.tieneSiguiente).toBe(false);
      expect(resultado.paginacion?.tieneAnterior).toBe(false);
    });

    it("debe propagar filtros combinados AND (delegacionId, fuenteOrigen, estado, prioridad) al repositorio", async () => {
      vi.mocked(repo.listarIncidentesPaginadosRepo).mockResolvedValueOnce({
        filas: [],
        total: 0,
      });

      const filtros = {
        page: 1,
        limit: 20,
        delegacionId: "30000000-0000-4000-8000-000000000001",
        fuenteOrigen: "LLAMADA_TELEFONICA" as const,
        estado: "REPORTADO" as const,
        prioridad: "ALTA" as const,
        busqueda: "Centro",
      };

      await listarIncidentesKanbanService(filtros);

      expect(repo.listarIncidentesPaginadosRepo).toHaveBeenCalledWith(filtros);
    });
  });

  describe("obtenerDetalleIncidenteService", () => {
    it("debe retornar null si el incidente no existe", async () => {
      vi.mocked(repo.obtenerIncidenteDetallePorIdRepo).mockResolvedValueOnce(null);

      const resultado = await obtenerDetalleIncidenteService(
        "00000000-0000-0000-0000-000000000000"
      );
      expect(resultado).toBeNull();
    });

    it("debe retornar el detalle mapeado con misiones y recursos asociados", async () => {
      vi.mocked(repo.obtenerIncidenteDetallePorIdRepo).mockResolvedValueOnce({
        incidente: {
          id: "a0000000-0000-4000-8000-000000000001",
          codigo: "INC-58291045",
          codigo_seguimiento: "58291045",
          tipo_afectacion: "Caída de árbol",
          descripcion: "Árbol sobre cableado eléctrico",
          direccion_texto: "Los Robles 300",
          latitud: -39.81,
          longitud: -73.24,
          estado: "VERIFICANDO",
          prioridad: "CRITICA",
          requiere_asistencia_social: false,
          fuente_origen: "FUNCIONARIO_TERRENO",
          asterisk_call_id: null,
          asterisk_caller_phone: null,
          creado_en: new Date("2026-09-22T10:00:00Z"),
          actualizado_en: new Date("2026-09-22T10:30:00Z"),
          informante_id: "b0000000-0000-4000-8000-000000000001",
          informante_rut: "11.222.333-4",
          informante_nombre: "Vecino Isla Teja",
          informante_telefono: "+56998877665",
          delegacion_id: "30000000-0000-4000-8000-000000000003",
          delegacion_nombre: "Costa",
          delegacion_descripcion: "Sector costero",
          creador_id: "00000000-0000-4000-8000-000000000002",
          creador_nombre: "Patrulla Terreno 1",
          creador_email: "patrulla1@valdivia.cl",
          encargado_id: "00000000-0000-4000-8000-000000000003",
          encargado_nombre: "Encargado Operaciones",
          encargado_email: "encargado@valdivia.cl",
        },
        misiones: [
          {
            id: "c0000000-0000-4000-8000-000000000001",
            codigo: "MIS-001",
            titulo: "Verificación y evaluación de riesgos en cables",
            descripcion: "Despacho de patrulla rápida",
            tipo_mision: "VERIFICACION",
            estado: "COMPLETADA",
            prioridad: "CRITICA",
            justificacion_rechazo: null,
            fecha_inicio: new Date("2026-09-22T10:10:00Z"),
            fecha_cierre: new Date("2026-09-22T10:30:00Z"),
            creado_en: new Date("2026-09-22T10:05:00Z"),
            patrulla_id: "p0000000-0000-4000-8000-000000000001",
            patrulla_nombre: "Patrulla Teja-1",
            patrulla_estado: "DISPONIBLE",
            cuadrilla_id: null,
            cuadrilla_nombre: null,
            cuadrilla_estado: null,
          },
        ],
        recursosAsociados: [
          {
            recursoId: "r0000000-0000-4000-8000-000000000001",
            nombre: "Camioneta 4x4",
            esIndividual: true,
            cantidadAsignadaTotal: 1,
            estadoRecurso: "DISPONIBLE",
            cuadrillaNombre: "Cuadrilla Eléctrica",
          },
        ],
        justificacionReclasificacion: null,
      });

      const detalle = await obtenerDetalleIncidenteService(
        "a0000000-0000-4000-8000-000000000001"
      );

      expect(detalle).not.toBeNull();
      expect(detalle?.codigo).toBe("INC-58291045");
      expect(detalle?.informante?.nombre).toBe("Vecino Isla Teja");
      expect(detalle?.delegacion?.nombre).toBe("Costa");
      expect(detalle?.misiones).toHaveLength(1);
      expect(detalle?.misiones[0].patrulla?.nombre).toBe("Patrulla Teja-1");
      expect(detalle?.recursosAsociados).toHaveLength(1);
      expect(detalle?.recursosAsociados[0].nombre).toBe("Camioneta 4x4");
    });

    it("debe construir reclasificacionTipologia y ultimoReporte a partir de metadatos de hito", async () => {
      vi.mocked(repo.obtenerIncidenteDetallePorIdRepo).mockResolvedValueOnce({
        incidente: {
          id: "a0000000-0000-4000-8000-000000000099",
          codigo: "INC-592395-562",
          codigo_seguimiento: "59239556",
          tipo_afectacion: "Corte de agua potable",
          descripcion: "Rotura de matriz",
          direccion_texto: "Arauco 642",
          latitud: -39.82,
          longitud: -73.24,
          estado: "VERIFICANDO",
          prioridad: "MEDIA",
          requiere_asistencia_social: false,
          fuente_origen: "LLAMADA_TELEFONICA",
          asterisk_call_id: null,
          asterisk_caller_phone: null,
          creado_en: new Date("2026-11-10T01:00:00Z"),
          actualizado_en: new Date("2026-11-10T21:07:27Z"),
          informante_id: null,
          informante_rut: null,
          informante_nombre: null,
          informante_telefono: null,
          delegacion_id: null,
          delegacion_nombre: null,
          delegacion_descripcion: null,
          creador_id: null,
          creador_nombre: null,
          creador_email: null,
          encargado_id: null,
          encargado_nombre: null,
          encargado_email: null,
        },
        misiones: [
          {
            id: "03313618-6728-4158-bfd2-09c55feaf05a",
            codigo: "MIS-2026-7700",
            titulo: "Verificación: Anegamiento - INC-592395-562",
            descripcion: null,
            tipo_mision: "VERIFICACION",
            estado: "EN_CURSO",
            prioridad: "MEDIA",
            justificacion_rechazo: null,
            fecha_inicio: new Date("2026-11-10T05:08:54Z"),
            fecha_cierre: null,
            creado_en: new Date("2026-11-10T01:03:24Z"),
            patrulla_id: "p0000000-0000-4000-8000-000000000010",
            patrulla_nombre: "Patrulla Norte",
            patrulla_estado: "EN_VERIFICACION",
            cuadrilla_id: null,
            cuadrilla_nombre: null,
            cuadrilla_estado: null,
          },
        ],
        recursosAsociados: [],
        reportesEvaluacionTerreno: [],
        justificacionReclasificacion:
          "Tipología reclasificada en terreno a: Corte de agua potable. Justificación: Matriz rota",
        reclasificacionTipologiaRaw: {
          hito_id: "11111111-1111-4111-8111-111111111111",
          mision_id: "03313618-6728-4158-bfd2-09c55feaf05a",
          mision_codigo: "MIS-2026-7700",
          descripcion:
            "Tipología reclasificada en terreno a: Corte de agua potable. Justificación: Matriz rota",
          metadatos: {
            tipoAnterior: "Anegamiento",
            tipoNuevo: "Corte de agua potable",
            justificacion: "Matriz rota",
          },
          registrador_nombre: "Patrullero Jefe",
          creado_en: new Date("2026-11-10T21:07:27Z"),
        },
      });

      const detalle = await obtenerDetalleIncidenteService(
        "a0000000-0000-4000-8000-000000000099"
      );

      expect(detalle?.misiones[0].titulo).toBe(
        "Verificación: Corte de agua potable - INC-592395-562"
      );
      expect(detalle?.reclasificacionTipologia).toEqual({
        hitoId: "11111111-1111-4111-8111-111111111111",
        misionId: "03313618-6728-4158-bfd2-09c55feaf05a",
        misionCodigo: "MIS-2026-7700",
        tipoAnterior: "Anegamiento",
        tipoNuevo: "Corte de agua potable",
        justificacion: "Matriz rota",
        registradoPor: "Patrullero Jefe",
        creadoEn: "2026-11-10T21:07:27.000Z",
      });
      expect(detalle?.ultimoReporte).toMatchObject({
        origen: "RECLASIFICACION",
        reporteId: "reclasificacion-11111111-1111-4111-8111-111111111111",
        misionId: "03313618-6728-4158-bfd2-09c55feaf05a",
        misionCodigo: "MIS-2026-7700",
        evaluadorNombre: "Patrullero Jefe",
      });
    });
  });
});
