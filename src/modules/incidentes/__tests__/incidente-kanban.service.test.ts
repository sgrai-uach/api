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
          trazabilidad_notificacion: "RECIBIDA",
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
      expect(resultado.data[0].trazabilidadNotificacion).toBe("RECIBIDA");
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

    it("debe mapear correctamente tieneMisionDespachada tanto en true como en false", async () => {
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
          tiene_mision_despachada: true,
          creado_en: new Date("2026-09-22T10:00:00Z"),
          actualizado_en: new Date("2026-09-22T10:00:00Z"),
        },
        {
          id: "a0000000-0000-4000-8000-000000000002",
          codigo: "INC-87654321",
          codigo_seguimiento: "87654321",
          tipo_afectacion: "Deslizamiento",
          descripcion: "Derrumbe de tierra",
          direccion_texto: "Calle Costanera 200",
          latitud: -39.82,
          longitud: -73.25,
          estado: "REPORTADO",
          prioridad: "ALTA",
          requiere_asistencia_social: false,
          fuente_origen: "LLAMADA_TELEFONICA",
          informante_nombre: "María Lopez",
          delegacion_nombre: "Sur",
          total_misiones: 0,
          tiene_mision_despachada: false,
          creado_en: new Date("2026-09-22T11:00:00Z"),
          actualizado_en: new Date("2026-09-22T11:00:00Z"),
        },
      ];

      vi.mocked(repo.listarIncidentesPaginadosRepo).mockResolvedValueOnce({
        filas: mockFilas,
        total: 2,
      });

      const resultado = await listarIncidentesKanbanService({
        page: 1,
        limit: 10,
      });

      expect(resultado.data).toHaveLength(2);
      expect(resultado.data[0].tieneMisionDespachada).toBe(true);
      expect(resultado.data[1].tieneMisionDespachada).toBe(false);
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
            trazabilidad_notificacion: "LEIDA",
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
      expect(detalle?.misiones[0].trazabilidadNotificacion).toBe("LEIDA");
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
            trazabilidad_notificacion: null,
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

    it("debe mapear faenasCuadrillaCompletadas, estadoTerrenoFinal y horasHombreRegistradas en Kanban y detalle (HU-68)", async () => {
      const mockFilaCierre: repo.FilaIncidenteResumen = {
        id: "a1000000-0000-4000-8000-000000000004",
        codigo: "INC-2026-0004",
        codigo_seguimiento: "10000004",
        tipo_afectacion: "Anegamiento de calzada",
        descripcion: "Sumideros tapados",
        direccion_texto: "Av. Alemania 780",
        latitud: -39.817,
        longitud: -73.242,
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiere_asistencia_social: false,
        fuente_origen: "CHATBOT",
        informante_nombre: "Ana",
        delegacion_nombre: "Norte",
        total_misiones: 1,
        total_reportes_terreno: 1,
        faenas_cuadrilla_completadas: true,
        estado_terreno_final: "CRITICO",
        horas_hombre_registradas: "4.00",
        dictamen_terreno: null,
        verificado: false,
        creado_en: new Date("2026-11-18T22:49:41Z"),
        actualizado_en: new Date("2026-11-19T20:52:58Z"),
      };

      vi.mocked(repo.listarIncidentesPaginadosRepo).mockResolvedValueOnce({
        filas: [mockFilaCierre],
        total: 1,
      });

      const lista = await listarIncidentesKanbanService({ page: 1, limit: 20, estado: "EN_ATENCION" });
      expect(lista.data[0].totalReportesTerreno).toBe(1);
      expect(lista.data[0].faenasCuadrillaCompletadas).toBe(true);
      expect(lista.data[0].estadoTerrenoFinal).toBe("CRITICO");
      expect(lista.data[0].horasHombreRegistradas).toBe(4);

      vi.mocked(repo.obtenerIncidenteDetallePorIdRepo).mockResolvedValueOnce({
        incidente: {
          id: "a1000000-0000-4000-8000-000000000004",
          codigo: "INC-2026-0004",
          codigo_seguimiento: "10000004",
          tipo_afectacion: "Anegamiento de calzada",
          descripcion: "Sumideros tapados",
          direccion_texto: "Av. Alemania 780",
          latitud: -39.817,
          longitud: -73.242,
          estado: "EN_ATENCION",
          prioridad: "ALTA",
          requiere_asistencia_social: false,
          fuente_origen: "CHATBOT",
          asterisk_call_id: null,
          asterisk_caller_phone: null,
          creado_en: new Date("2026-11-18T22:49:41Z"),
          actualizado_en: new Date("2026-11-19T20:52:58Z"),
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
            id: "d1000000-0000-4000-8000-000000000002",
            codigo: "MIS-2026-0002",
            titulo: "Desagüe en Av. Alemania",
            descripcion: null,
            tipo_mision: "ATENCION_CUADRILLA",
            estado: "COMPLETADA",
            prioridad: "ALTA",
            justificacion_rechazo: null,
            fecha_inicio: new Date("2026-11-18T23:35:16Z"),
            fecha_cierre: new Date("2026-11-19T20:52:58Z"),
            creado_en: new Date("2026-11-18T22:49:41Z"),
            patrulla_id: null,
            patrulla_nombre: null,
            patrulla_estado: null,
            cuadrilla_id: "c1000000-0000-4000-8000-000000000001",
            cuadrilla_nombre: "Cuadrilla Aguas Lluvias Alfa",
            cuadrilla_estado: "DISPONIBLE",
            trazabilidad_notificacion: null,
          },
        ],
        recursosAsociados: [],
        reportesEvaluacionTerreno: [
          {
            id: "rep-cuad-004",
            mision_id: "d1000000-0000-4000-8000-000000000002",
            evaluador_id: "u-1",
            tipo_reporte: "REPORTE_CUADRILLA",
            dictamen: null,
            motivo_no_abordable: null,
            requiere_asistencia_social: false,
            estado_terreno: "CRITICO",
            version_reporte: 1,
            es_rectificacion: false,
            prioridad_sugerida: "ALTA",
            prioridad_asignada: "ALTA",
            justificacion_prioridad: null,
            resumen_tecnico: "Extracción de agua y limpieza de colector completada.",
            acciones_realizadas: "Extracción de agua",
            danos_estimados: null,
            observaciones: "Observación secundaria",
            personas_afectadas: 0,
            requiere_apoyo_adicional: true,
            horas_hombre: "4.00",
            materiales_consumidos: [],
            evaluador_nombre: "Carlos Delegado",
            evaluador_email: "delegado@valdivia.cl",
            evaluador_rut: null,
            creado_en: new Date("2026-11-19T20:52:58Z"),
          },
        ],
        justificacionReclasificacion: null,
      });

      const detalle = await obtenerDetalleIncidenteService("a1000000-0000-4000-8000-000000000004");
      expect(detalle?.faenasCuadrillaCompletadas).toBe(true);
      expect(detalle?.estadoTerrenoFinal).toBe("CRITICO");
      expect(detalle?.horasHombreRegistradas).toBe(4);
      expect(detalle?.ultimoReporte).toMatchObject({
        reporteId: "rep-cuad-004",
        tipoReporte: "REPORTE_CUADRILLA",
        estadoTerreno: "CRITICO",
        horasHombre: 4,
        requiereApoyoAdicional: true,
        resumen: "Extracción de agua y limpieza de colector completada.",
      });
    });

    it("debe omitir horasHombre y materialesConsumidos en reportes EVALUACION_PRIORIDAD y VERIFICACION_CIERRE aunque PostgreSQL devuelva DEFAULT [] (INC-205870-613)", async () => {
      vi.mocked(repo.obtenerIncidenteDetallePorIdRepo).mockResolvedValueOnce({
        incidente: {
          id: "1d25bde1-7d69-4e24-9709-9e5e7f095f99",
          codigo: "INC-205870-613",
          codigo_seguimiento: "19744725",
          tipo_afectacion: "Anegamiento",
          descripcion: "Anegamiento en acceso",
          direccion_texto: "Ismael Valdés 500, Villa Coltauco",
          latitud: -39.814279,
          longitud: -73.24252,
          estado: "VERIFICANDO",
          prioridad: "CRITICA",
          prioridad_sugerida: "CRITICA",
          justificacion_prioridad:
            "Prioridad ratificada en terreno conforme a la sugerencia técnica del sistema.",
          requiere_asistencia_social: false,
          fuente_origen: "LLAMADA_TELEFONICA",
          asterisk_call_id: null,
          asterisk_caller_phone: null,
          creado_en: new Date("2026-11-22T16:16:45Z"),
          actualizado_en: new Date("2026-11-22T16:17:56Z"),
          informante_id: null,
          informante_rut: null,
          informante_nombre: "Juan Carlos Veas",
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
            id: "20562043-a1e7-49c0-935b-64494156353e",
            codigo: "MIS-2026-0004",
            titulo: "Verificación: Anegamiento - INC-205870-613",
            descripcion: null,
            tipo_mision: "VERIFICACION",
            estado: "EN_CURSO",
            prioridad: "CRITICA",
            justificacion_rechazo: null,
            fecha_inicio: new Date("2026-11-22T16:17:31Z"),
            fecha_cierre: null,
            creado_en: new Date("2026-11-22T16:16:55Z"),
            patrulla_id: "4c553e9b-0591-4a53-bbd0-5eadef6a026e",
            patrulla_nombre: "Patrulla Sur",
            patrulla_estado: "EN_VERIFICACION",
            cuadrilla_id: null,
            cuadrilla_nombre: null,
            cuadrilla_estado: null,
            trazabilidad_notificacion: "LEIDA",
          },
        ],
        recursosAsociados: [],
        reportesEvaluacionTerreno: [
          {
            id: "e77dd7b1-c44c-4271-90a8-0a5bd2d224b9",
            mision_id: "20562043-a1e7-49c0-935b-64494156353e",
            evaluador_id: "cc105be3-e899-4ae8-b7c7-5ecc953952bd",
            tipo_reporte: "EVALUACION_PRIORIDAD",
            dictamen: null,
            motivo_no_abordable: null,
            requiere_asistencia_social: false,
            estado_terreno: "EN_VERIFICACION",
            version_reporte: 1,
            es_rectificacion: false,
            prioridad_sugerida: "CRITICA",
            prioridad_asignada: "CRITICA",
            justificacion_prioridad:
              "Prioridad ratificada en terreno conforme a la sugerencia técnica del sistema.",
            resumen_tecnico:
              "Evaluación en Terreno #1 (Inicial) — Núcleo familiar afectado: 5 persona(s).",
            acciones_realizadas: null,
            danos_estimados: null,
            observaciones: null,
            personas_afectadas: 5,
            requiere_apoyo_adicional: false,
            horas_hombre: null,
            materiales_consumidos: [],
            evaluador_nombre: "Cristóbal Veas",
            evaluador_email: "patrulla@valdivia.cl",
            evaluador_rut: "21707611-0",
            creado_en: new Date("2026-11-22T16:17:56Z"),
          },
        ],
        justificacionReclasificacion: null,
      });

      const detalle = await obtenerDetalleIncidenteService(
        "1d25bde1-7d69-4e24-9709-9e5e7f095f99"
      );

      expect(detalle?.faenasCuadrillaCompletadas).toBe(false);
      expect(detalle?.reportesEvaluacionTerreno?.[0]).not.toHaveProperty("materialesConsumidos");
      expect(detalle?.reportesEvaluacionTerreno?.[0]).not.toHaveProperty("horasHombre");
      expect(detalle?.ultimoReporte).not.toHaveProperty("materialesConsumidos");
      expect(detalle?.ultimoReporte).not.toHaveProperty("horasHombre");
      expect(detalle?.ultimoReporte?.tipoReporte).toBe("EVALUACION_PRIORIDAD");

      // También debe omitir campos de faena en informes VERIFICACION_CIERRE
      vi.mocked(repo.obtenerIncidenteDetallePorIdRepo).mockResolvedValueOnce({
        incidente: {
          id: "1d25bde1-7d69-4e24-9709-9e5e7f095f99",
          codigo: "INC-205870-613",
          codigo_seguimiento: "19744725",
          tipo_afectacion: "Anegamiento",
          descripcion: "Anegamiento en acceso",
          direccion_texto: "Ismael Valdés 500, Villa Coltauco",
          latitud: -39.814279,
          longitud: -73.24252,
          estado: "VERIFICANDO",
          prioridad: "CRITICA",
          requiere_asistencia_social: false,
          fuente_origen: "LLAMADA_TELEFONICA",
          asterisk_call_id: null,
          asterisk_caller_phone: null,
          creado_en: new Date("2026-11-22T16:16:45Z"),
          actualizado_en: new Date("2026-11-22T16:19:00Z"),
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
        misiones: [],
        recursosAsociados: [],
        reportesEvaluacionTerreno: [
          {
            id: "rep-cierre-verif-1",
            mision_id: "20562043-a1e7-49c0-935b-64494156353e",
            evaluador_id: "cc105be3-e899-4ae8-b7c7-5ecc953952bd",
            tipo_reporte: "VERIFICACION_CIERRE",
            dictamen: "REQUIERE_CUADRILLA",
            motivo_no_abordable: null,
            requiere_asistencia_social: false,
            estado_terreno: "FINALIZADO",
            version_reporte: 2,
            es_rectificacion: false,
            prioridad_sugerida: "CRITICA",
            prioridad_asignada: "CRITICA",
            justificacion_prioridad: null,
            resumen_tecnico: "Se verifica anegamiento mayor y se solicita cuadrilla.",
            acciones_realizadas: null,
            danos_estimados: null,
            observaciones: null,
            personas_afectadas: 5,
            requiere_apoyo_adicional: true,
            horas_hombre: null,
            materiales_consumidos: [],
            evaluador_nombre: "Cristóbal Veas",
            evaluador_email: "patrulla@valdivia.cl",
            evaluador_rut: "21707611-0",
            creado_en: new Date("2026-11-22T16:19:00Z"),
          },
        ],
        justificacionReclasificacion: null,
      });

      const detalleCierre = await obtenerDetalleIncidenteService(
        "1d25bde1-7d69-4e24-9709-9e5e7f095f99"
      );
      expect(detalleCierre?.reportesEvaluacionTerreno?.[0]).not.toHaveProperty("materialesConsumidos");
      expect(detalleCierre?.reportesEvaluacionTerreno?.[0]).not.toHaveProperty("horasHombre");
      expect(detalleCierre?.ultimoReporte).not.toHaveProperty("materialesConsumidos");
      expect(detalleCierre?.ultimoReporte).not.toHaveProperty("horasHombre");
      expect(detalleCierre?.ultimoReporte?.tipoReporte).toBe("VERIFICACION_CIERRE");
    });

    it("debe exponer apoyoSolicitado y detalleApoyoRequerido en listado Kanban y detalle de incidente (HU-44)", async () => {
      vi.mocked(repo.listarIncidentesPaginadosRepo).mockResolvedValueOnce({
        filas: [
          {
            id: "a0000000-0000-4000-8000-000000000099",
            codigo: "INC-2026-0099",
            codigo_seguimiento: "99999999",
            tipo_afectacion: "Inundación",
            descripcion: "Calle anegada",
            direccion_texto: "Av. Picarte 2500",
            latitud: -39.82,
            longitud: -73.23,
            estado: "EN_ATENCION",
            prioridad: "ALTA",
            requiere_asistencia_social: false,
            fuente_origen: "FUNCIONARIO_TERRENO",
            informante_nombre: null,
            delegacion_nombre: "Sur",
            total_misiones: 1,
            apoyo_solicitado: true,
            detalle_apoyo_requerido:
              "Se solicita motoniveladora y cuadrilla adicional de despeje",
            creado_en: new Date("2026-11-23T20:00:00Z"),
            actualizado_en: new Date("2026-11-23T20:30:00Z"),
          },
        ],
        total: 1,
      });

      const listado = await listarIncidentesKanbanService({ page: 1, limit: 20 });
      expect(listado.data[0].apoyoSolicitado).toBe(true);
      expect(listado.data[0].detalleApoyoRequerido).toBe(
        "Se solicita motoniveladora y cuadrilla adicional de despeje"
      );

      vi.mocked(repo.obtenerIncidenteDetallePorIdRepo).mockResolvedValueOnce({
        incidente: {
          id: "a0000000-0000-4000-8000-000000000099",
          codigo: "INC-2026-0099",
          codigo_seguimiento: "99999999",
          tipo_afectacion: "Inundación",
          descripcion: "Calle anegada",
          direccion_texto: "Av. Picarte 2500",
          latitud: -39.82,
          longitud: -73.23,
          estado: "EN_ATENCION",
          prioridad: "ALTA",
          requiere_asistencia_social: false,
          fuente_origen: "FUNCIONARIO_TERRENO",
          asterisk_call_id: null,
          asterisk_caller_phone: null,
          creado_en: new Date("2026-11-23T20:00:00Z"),
          actualizado_en: new Date("2026-11-23T20:30:00Z"),
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
        misiones: [],
        recursosAsociados: [],
        reportesEvaluacionTerreno: [
          {
            id: "rep-apoyo-1",
            mision_id: "60000000-0000-4000-8000-000000000001",
            evaluador_id: "00000000-0000-4000-8000-000000000005",
            tipo_reporte: "SOLICITUD_APOYO",
            estado_terreno: "EN_CURSO",
            version_reporte: 1,
            es_rectificacion: false,
            resumen_tecnico: "Solicitud de apoyo adicional en terreno",
            acciones_realizadas: null,
            danos_estimados: null,
            observaciones: null,
            personas_afectadas: 0,
            requiere_apoyo_adicional: true,
            detalle_apoyo_requerido:
              "Se solicita motoniveladora y cuadrilla adicional de despeje",
            evaluador_nombre: "Carlos Delegado",
            evaluador_email: "delegado@valdivia.cl",
            evaluador_rut: "15.111.222-3",
            creado_en: new Date("2026-11-23T20:30:00Z"),
          },
        ],
        justificacionReclasificacion: null,
      });

      const detalle = await obtenerDetalleIncidenteService(
        "a0000000-0000-4000-8000-000000000099"
      );
      expect(detalle?.apoyoSolicitado).toBe(true);
      expect(detalle?.detalleApoyoRequerido).toBe(
        "Se solicita motoniveladora y cuadrilla adicional de despeje"
      );
    });

    it("no debe marcar apoyoSolicitado cuando solo existen reportes VERIFICACION_CIERRE o EVALUACION_PRIORIDAD sin cuadrilla asignada", async () => {
      vi.mocked(repo.obtenerIncidenteDetallePorIdRepo).mockResolvedValueOnce({
        incidente: {
          id: "a0000000-0000-4000-8000-000000000100",
          codigo: "INC-466106-503",
          codigo_seguimiento: "46610650",
          tipo_afectacion: "Anegamiento",
          descripcion: "Anegamiento en vía pública",
          direccion_texto: "Vicente Pérez Rosales 774, Villa Coltauco",
          latitud: -39.82,
          longitud: -73.23,
          estado: "VERIFICANDO",
          prioridad: "ALTA",
          requiere_asistencia_social: false,
          fuente_origen: "FUNCIONARIO_TERRENO",
          asterisk_call_id: null,
          asterisk_caller_phone: null,
          creado_en: new Date("2026-11-23T20:00:00Z"),
          actualizado_en: new Date("2026-11-23T20:30:00Z"),
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
            id: "60000000-0000-4000-8000-000000000010",
            codigo: "MIS-2026-0010",
            titulo: "Verificación en terreno",
            descripcion: null,
            tipo_mision: "VERIFICACION",
            estado: "COMPLETADA",
            prioridad: "ALTA",
            justificacion_rechazo: null,
            trazabilidad_notificacion: null,
            fecha_inicio: new Date("2026-11-23T20:05:00Z"),
            fecha_cierre: new Date("2026-11-23T20:30:00Z"),
            creado_en: new Date("2026-11-23T20:00:00Z"),
            patrulla_id: "f1000000-0000-4000-8000-000000000001",
            patrulla_nombre: "Patrulla Costa 1",
            patrulla_estado: "DISPONIBLE",
            cuadrilla_id: null,
            cuadrilla_nombre: null,
            cuadrilla_estado: null,
          },
        ],
        recursosAsociados: [],
        reportesEvaluacionTerreno: [
          {
            id: "rep-eval-1",
            mision_id: "60000000-0000-4000-8000-000000000010",
            evaluador_id: "00000000-0000-4000-8000-000000000004",
            tipo_reporte: "EVALUACION_PRIORIDAD",
            estado_terreno: "EN_VERIFICACION",
            version_reporte: 1,
            es_rectificacion: false,
            resumen_tecnico: "Evaluación de prioridad inicial.",
            acciones_realizadas: null,
            danos_estimados: null,
            observaciones: null,
            personas_afectadas: 3,
            requiere_apoyo_adicional: true,
            evaluador_nombre: "Patrullero",
            evaluador_email: "patrulla@valdivia.cl",
            evaluador_rut: "11.111.111-1",
            creado_en: new Date("2026-11-23T20:15:00Z"),
          },
          {
            id: "rep-verif-1",
            mision_id: "60000000-0000-4000-8000-000000000010",
            evaluador_id: "00000000-0000-4000-8000-000000000004",
            tipo_reporte: "VERIFICACION_CIERRE",
            dictamen: "REQUIERE_CUADRILLA",
            estado_terreno: "FINALIZADO",
            version_reporte: 2,
            es_rectificacion: false,
            resumen_tecnico: "Se verifica anegamiento, se requiere despacho de cuadrilla.",
            acciones_realizadas: null,
            danos_estimados: null,
            observaciones: null,
            personas_afectadas: 3,
            requiere_apoyo_adicional: true,
            evaluador_nombre: "Patrullero",
            evaluador_email: "patrulla@valdivia.cl",
            evaluador_rut: "11.111.111-1",
            creado_en: new Date("2026-11-23T20:30:00Z"),
          },
        ],
        justificacionReclasificacion: null,
      });

      const detalle = await obtenerDetalleIncidenteService(
        "a0000000-0000-4000-8000-000000000100"
      );
      expect(detalle?.dictamenTerreno).toBe("REQUIERE_CUADRILLA");
      expect(detalle?.apoyoSolicitado).toBe(false);
      expect(detalle?.detalleApoyoRequerido).toBeNull();
    });
  });
});
