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

      expect(resultado.paginacion.totalPaginas).toBe(1);
      expect(resultado.paginacion.tieneSiguiente).toBe(false);
      expect(resultado.paginacion.tieneAnterior).toBe(false);
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
  });
});
