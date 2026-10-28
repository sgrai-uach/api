import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  obtenerDetalleMisionService,
  asignarPatrullaVerificacionService,
} from "../mision.service";
import * as misionRepo from "../mision.repository";
import * as socketLib from "@/lib/socket";

vi.mock("../mision.repository", () => ({
  obtenerMisionDetallePorIdRepo: vi.fn(),
  crearMisionVerificacionRepo: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarMisionAsignada: vi.fn(),
  notificarIncidenteActualizado: vi.fn(),
  notificarPatrullaActualizada: vi.fn(),
}));

describe("Mision Service - obtenerDetalleMisionService (HU-17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar null si el repositorio no encuentra la misión", async () => {
    vi.mocked(misionRepo.obtenerMisionDetallePorIdRepo).mockResolvedValueOnce(null);

    const resultado = await obtenerDetalleMisionService("60000000-0000-4000-8000-000000000099");
    expect(resultado).toBeNull();
  });

  it("debe transformar y retornar el detalle completo con bitácora, cuadrilla y reportes", async () => {
    vi.mocked(misionRepo.obtenerMisionDetallePorIdRepo).mockResolvedValueOnce({
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-001",
        titulo: "Despeje de vía pública",
        descripcion: "Retirar árbol caído en calle Picarte",
        tipo_mision: "ATENCION_CUADRILLA",
        estado: "EN_CURSO",
        prioridad: "ALTA",
        justificacion_rechazo: null,
        incidente_id: "a0000000-0000-4000-8000-000000000001",
        prevencion_id: null,
        cuadrilla_id: "50000000-0000-4000-8000-000000000001",
        patrulla_id: null,
        encargado_id: "00000000-0000-4000-8000-000000000003",
        creado_por_id: "00000000-0000-4000-8000-000000000002",
        fecha_inicio: new Date("2026-10-02T10:00:00Z"),
        fecha_cierre: null,
        creado_en: new Date("2026-10-02T09:30:00Z"),
        actualizado_en: new Date("2026-10-02T10:05:00Z"),

        // Incidente
        incidente_codigo: "INC-2026-001",
        incidente_codigo_seguimiento: "12345678",
        incidente_tipo_afectacion: "Caída de Árbol",
        incidente_descripcion: "Árbol sobre tendido eléctrico",
        incidente_direccion: "Picarte 1200",
        incidente_latitud: "-39.82",
        incidente_longitud: "-73.24",
        incidente_estado: "EN_ATENCION",
        incidente_prioridad: "ALTA",
        incidente_requiere_asistencia_social: false,
        incidente_delegacion_nombre: "Sur",

        // Creador
        creador_id: "00000000-0000-4000-8000-000000000002",
        creador_nombre: "Operador Call Center",
        creador_email: "callcenter@valdivia.cl",

        // Encargado
        encargado_id_res: "00000000-0000-4000-8000-000000000003",
        encargado_nombre: "Encargado Operaciones",
        encargado_email: "encargado@valdivia.cl",

        // Cuadrilla
        cuadrilla_nombre: "Cuadrilla Vías 1",
        cuadrilla_estado: "EN_MISION",
        cuadrilla_delegacion_nombre: "Sur",
        delegado_id: "d0000000-0000-4000-8000-000000000001",
        delegado_nombre: "Carlos Gómez",
        delegado_email: "carlos.gomez@valdivia.cl",
      },
      recursosCuadrilla: [
        {
          id: "rec00000-0000-4000-8000-000000000001",
          nombre: "Motosierra",
          tipo: "INDIVIDUAL",
          cantidadAsignada: 2,
        },
      ],
      reportesTerreno: [
        {
          id: "rep00000-0000-4000-8000-000000000001",
          mision_id: "60000000-0000-4000-8000-000000000001",
          evaluador_id: "d0000000-0000-4000-8000-000000000001",
          resumen_tecnico: "Troceado completado sin incidentes",
          acciones_realizadas: "Uso de motosierra y acopio en berma",
          requiere_apoyo_adicional: false,
          danos_estimados: null,
          observaciones: "Tránsito normalizado",
          personas_afectadas: 0,
          estado_terreno: "FINALIZADO",
          creado_en: new Date("2026-10-02T10:45:00Z"),
          actualizado_en: new Date("2026-10-02T10:45:00Z"),
          evaluador_nombre: "Carlos Gómez",
          evaluador_email: "carlos.gomez@valdivia.cl",
          evaluador_rut: "12345678-9",
          adjuntos: [
            {
              id: "adj00000-0000-4000-8000-000000000001",
              nombre_archivo: "evidencia1.jpg",
              url: "uploads/evidencia1.jpg", // sin slash inicial para probar normalización
              tipo_mime: "image/jpeg",
              tamano_bytes: 2048000,
              creado_en: new Date("2026-10-02T10:40:00Z"),
            },
          ],
        },
      ],
    });

    const detalle = await obtenerDetalleMisionService("60000000-0000-4000-8000-000000000001");
    expect(detalle).not.toBeNull();
    expect(detalle?.codigo).toBe("MIS-2026-001");
    expect(detalle?.incidente?.codigo).toBe("INC-2026-001");
    expect(detalle?.cuadrilla?.nombre).toBe("Cuadrilla Vías 1");
    expect(detalle?.cuadrilla?.recursos).toHaveLength(1);

    // Bitácora de tiempos
    expect(detalle?.bitacoraTiempos.length).toBeGreaterThanOrEqual(2);
    expect(detalle?.bitacoraTiempos[0].hito).toBe("CREACION");
    expect(detalle?.bitacoraTiempos[1].hito).toBe("DESPLIEGUE_INICIO");

    // Reportes de terreno y normalización de URL
    expect(detalle?.reportesTerreno).toHaveLength(1);
    expect(detalle?.reportesTerreno[0].adjuntos).toHaveLength(1);
    expect(detalle?.reportesTerreno[0].adjuntos[0].url).toBe("/uploads/evidencia1.jpg");
  });

  it("debe retornar arrays vacíos en reportes cuando la misión aún no tiene levantamientos", async () => {
    vi.mocked(misionRepo.obtenerMisionDetallePorIdRepo).mockResolvedValueOnce({
      mision: {
        id: "60000000-0000-4000-8000-000000000002",
        codigo: "MIS-2026-002",
        titulo: "Monitoreo preventivo de cauce",
        descripcion: null,
        tipo_mision: "PREVENCION",
        estado: "PLANIFICADA",
        prioridad: "MEDIA",
        justificacion_rechazo: null,
        incidente_id: null,
        prevencion_id: "p0000000-0000-4000-8000-000000000001",
        cuadrilla_id: null,
        patrulla_id: "pat00000-0000-4000-8000-000000000001",
        encargado_id: null,
        creado_por_id: "00000000-0000-4000-8000-000000000001",
        fecha_inicio: null,
        fecha_cierre: null,
        creado_en: new Date("2026-10-02T11:00:00Z"),
        actualizado_en: new Date("2026-10-02T11:00:00Z"),

        // Prevención
        prevencion_codigo: "PREV-COSTA-01",
        prevencion_nombre: "Sector Niebla - Playa Grande",
        prevencion_descripcion: "Monitoreo de oleaje",
        prevencion_latitud: -39.86,
        prevencion_longitud: -73.39,
        prevencion_delegacion_nombre: "Costa",

        // Patrulla
        patrulla_nombre: "Patrulla Costa-1",
        patrulla_estado: "DISPONIBLE",
        patrulla_delegacion_nombre: "Costa",
      },
      recursosCuadrilla: [],
      reportesTerreno: [],
    });

    const detalle = await obtenerDetalleMisionService("60000000-0000-4000-8000-000000000002");
    expect(detalle).not.toBeNull();
    expect(detalle?.incidente).toBeNull();
    expect(detalle?.prevencion?.codigo).toBe("PREV-COSTA-01");
    expect(detalle?.patrulla?.nombre).toBe("Patrulla Costa-1");
    expect(detalle?.reportesTerreno).toEqual([]);
  });
});

describe("Mision Service - asignarPatrullaVerificacionService (HU-20)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe orquestar la transacción y emitir eventos socket a salas patrulla, encargado y mapa", async () => {
    const inputMock = {
      incidenteId: "50000000-0000-4000-8000-000000000001",
      patrullaId: "f1000000-0000-4000-8000-000000000001",
      titulo: "Verificación de Aniego",
      descripcion: "Evaluar anegamiento en calzada",
      prioridad: "ALTA" as const,
    };

    const operadorId = "00000000-0000-4000-8000-000000000003";

    vi.mocked(misionRepo.crearMisionVerificacionRepo).mockResolvedValueOnce({
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-1234",
        titulo: "Verificación de Aniego",
        descripcion: "Evaluar anegamiento en calzada",
        tipoMision: "VERIFICACION",
        estado: "DESPACHADA",
        prioridad: "ALTA",
        incidenteId: inputMock.incidenteId,
        patrullaId: inputMock.patrullaId,
        encargadoId: operadorId,
        fechaInicio: "2026-10-27T17:00:00.000Z",
        creadoEn: "2026-10-27T17:00:00.000Z",
      },
      incidente: {
        id: inputMock.incidenteId,
        codigo: "INC-2026-0001",
        estado: "VERIFICANDO",
        prioridad: "ALTA",
      },
      patrulla: {
        id: inputMock.patrullaId,
        nombre: "Patrulla Norte 1",
        estado: "EN_VERIFICACION",
        delegacionId: "30000000-0000-4000-8000-000000000001",
        usuarioLiderId: "00000000-0000-4000-8000-000000000010",
      },
      hitoInicial: {
        id: "70000000-0000-4000-8000-000000000001",
        hito: "DESPACHADA",
        descripcion: "Misión de verificación asignada y despachada a la patrulla Patrulla Norte 1.",
        creadoEn: "2026-10-27T17:00:00.000Z",
      },
    });

    const respuesta = await asignarPatrullaVerificacionService(inputMock, operadorId);

    expect(misionRepo.crearMisionVerificacionRepo).toHaveBeenCalledWith(inputMock, operadorId);
    expect(respuesta.data.mision.estado).toBe("DESPACHADA");
    expect(respuesta.data.incidente.estado).toBe("VERIFICANDO");
    expect(respuesta.data.patrulla.estado).toBe("EN_VERIFICACION");

    // Verificar emisión de eventos Socket.io
    expect(socketLib.notificarMisionAsignada).toHaveBeenCalledWith(
      expect.objectContaining({
        misionId: "60000000-0000-4000-8000-000000000001",
        patrullaId: inputMock.patrullaId,
        incidenteId: inputMock.incidenteId,
      })
    );

    expect(socketLib.notificarIncidenteActualizado).toHaveBeenCalledWith(
      expect.objectContaining({
        id: inputMock.incidenteId,
        nuevoEstado: "VERIFICANDO",
      })
    );

    expect(socketLib.notificarPatrullaActualizada).toHaveBeenCalledWith(
      expect.objectContaining({
        patrullaId: inputMock.patrullaId,
        estado: "EN_VERIFICACION",
      })
    );
  });
});

