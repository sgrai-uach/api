import { describe, it, expect, vi, beforeEach } from "vitest";
import * as repository from "../aviso-incidente.repository";
import * as geocoding from "@/modules/geolocalizacion/geocoding.service";
import * as socket from "@/lib/socket";
import {
  crearIncidenteManual,
  verificarDuplicadosManual,
  ConflictoDuplicadoError,
} from "../aviso-incidente.service";
import type { CrearIncidenteManualInput } from "../aviso-incidente.schema";

describe("Módulo Incidentes - Servicio de Ingreso Manual y Duplicados", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. verificarDuplicadosManual", () => {
    it("debe geocodificar la dirección y retornar duplicados si existen", async () => {
      vi.spyOn(geocoding, "geocodificarDireccion").mockResolvedValue({
        latitud: -39.8175,
        longitud: -73.2412,
      });

      const mockCoincidencias: repository.CoincidenciaEspacial[] = [
        {
          id: "c0000000-0000-0000-0000-000000000001",
          codigo: "INC-123456",
          tipoAfectacion: "Anegamiento",
          direccion: "Av. Alemania 540",
          estado: "SIN_ATENDER",
          distanciaMetros: 15.5,
          creadoEn: "2026-09-13T18:00:00Z",
          origen: "incidente",
        },
      ];

      vi.spyOn(repository, "buscarIncidentesYDuplicadosCercanos").mockResolvedValue(mockCoincidencias);

      const resultado = await verificarDuplicadosManual({
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 550",
        radioMetros: 300,
        horasVentana: 24,
      });

      expect(geocoding.geocodificarDireccion).toHaveBeenCalledWith("Av. Alemania 550");
      expect(resultado.hayDuplicados).toBe(true);
      expect(resultado.coincidencias).toHaveLength(1);
      expect(resultado.coincidencias[0].distanciaMetros).toBe(15.5);
    });

    it("debe retornar hayDuplicados: false cuando no hay reportes cercanos", async () => {
      vi.spyOn(repository, "buscarIncidentesYDuplicadosCercanos").mockResolvedValue([]);

      const resultado = await verificarDuplicadosManual({
        tipoAfectacion: "Deslizamiento",
        direccion: "Calle Errázuriz 200",
        latitud: -39.81,
        longitud: -73.24,
        radioMetros: 300,
        horasVentana: 24,
      });

      expect(resultado.hayDuplicados).toBe(false);
      expect(resultado.coincidencias).toHaveLength(0);
    });
  });

  describe("2. crearIncidenteManual", () => {
    const inputBase: CrearIncidenteManualInput = {
      origenReporte: "LLAMADA_TELEFONICA",
      tipoAfectacion: "Caída de árbol",
      descripcion: "Árbol derribado sobre automóvil",
      direccion: "Picarte 2000",
      informanteNombre: "Marta Gómez",
      informanteRut: "11.111.111-1",
      informanteTelefono: "+56912345678",
      asteriskCallId: "call-9988",
      prioridad: "ALTA",
      requiereAsistenciaSocial: false,
      forzarCreacion: false,
    };

    it("debe lanzar ConflictoDuplicadoError si detecta duplicado y forzarCreacion es false", async () => {
      vi.spyOn(geocoding, "geocodificarDireccion").mockResolvedValue({
        latitud: -39.8256,
        longitud: -73.2321,
      });

      vi.spyOn(repository, "buscarIncidentesYDuplicadosCercanos").mockResolvedValue([
        {
          id: "c0000000-0000-0000-0000-000000000001",
          codigo: "84920194",
          tipoAfectacion: "Caída de árbol",
          direccion: "Picarte 1990",
          estado: "PENDIENTE_VERIFICACION",
          distanciaMetros: 25,
          creadoEn: "2026-09-13T17:30:00Z",
          origen: "aviso",
        },
      ]);

      await expect(
        crearIncidenteManual(inputBase, "user-op-001")
      ).rejects.toThrow(ConflictoDuplicadoError);
    });

    it("debe persistir el incidente y aviso en estado SIN_ATENDER cuando no hay duplicados", async () => {
      vi.spyOn(geocoding, "geocodificarDireccion").mockResolvedValue({
        latitud: -39.8256,
        longitud: -73.2321,
      });

      vi.spyOn(repository, "buscarIncidentesYDuplicadosCercanos").mockResolvedValue([]);

      const mockTransaccional = {
        aviso: {
          id: "aviso-uuid-1",
          codigo_seguimiento: "84920194",
          tipo_afectacion: "Caída de árbol",
          direccion_texto: "Picarte 2000",
          latitud: -39.8256,
          longitud: -73.2321,
          descripcion: "Árbol derribado sobre automóvil",
          informante_nombre: "Marta Gómez",
          informante_rut: "11111111-1",
          informante_telefono: "+56912345678",
          origen_reporte: "LLAMADA_TELEFONICA" as const,
          asterisk_call_id: "call-9988",
          asterisk_caller_phone: null,
          operador_id: "user-op-001",
          estado: "EN_ATENCION" as const,
          es_duplicado: false,
          aviso_original_id: null,
          incidente_id: "incidente-uuid-1",
          creado_en: new Date("2026-09-13T18:30:00Z"),
          actualizado_en: new Date("2026-09-13T18:30:00Z"),
        },
        incidente: {
          id: "incidente-uuid-1",
          codigo: "INC-20260913-0001",
          tipo_afectacion: "Caída de árbol",
          descripcion: "Árbol derribado sobre automóvil",
          direccion_texto: "Picarte 2000",
          latitud: -39.8256,
          longitud: -73.2321,
          estado: "SIN_ATENDER" as const,
          prioridad: "ALTA" as const,
          requiere_asistencia_social: false,
          aviso_origen_id: "aviso-uuid-1",
          creado_por_id: "user-op-001",
          encargado_id: null,
          creado_en: new Date("2026-09-13T18:30:00Z"),
          actualizado_en: new Date("2026-09-13T18:30:00Z"),
        },
      };

      vi.spyOn(repository, "insertarIncidenteManualTransaccional").mockResolvedValue(
        mockTransaccional as unknown as Awaited<ReturnType<typeof repository.insertarIncidenteManualTransaccional>>
      );

      const spyNotificar = vi.spyOn(socket, "notificarIncidenteCreado").mockReturnValue(true);

      const respuesta = await crearIncidenteManual(inputBase, "user-op-001");

      expect(respuesta.incidente.estado).toBe("SIN_ATENDER");
      expect(respuesta.incidente.codigo).toBe("INC-20260913-0001");
      expect(respuesta.incidente.avisoOrigenId).toBe("aviso-uuid-1");
      expect(respuesta.aviso.codigoSeguimiento).toBe("84920194");
      expect(spyNotificar).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "incidente-uuid-1",
          estado: "SIN_ATENDER",
          prioridad: "ALTA",
        })
      );
    });

    it("debe persistir el incidente ignorando duplicados si forzarCreacion es true", async () => {
      vi.spyOn(geocoding, "geocodificarDireccion").mockResolvedValue({
        latitud: -39.8256,
        longitud: -73.2321,
      });

      const spyBuscarDuplicados = vi.spyOn(repository, "buscarIncidentesYDuplicadosCercanos");

      vi.spyOn(repository, "insertarIncidenteManualTransaccional").mockResolvedValue({
        aviso: {
          id: "aviso-uuid-2",
          codigo_seguimiento: "84920195",
          tipo_afectacion: "Caída de árbol",
          direccion_texto: "Picarte 2000",
          latitud: -39.8256,
          longitud: -73.2321,
          descripcion: "Árbol derribado",
          informante_nombre: "Marta Gómez",
          informante_rut: "11111111-1",
          informante_telefono: null,
          origen_reporte: "LLAMADA_TELEFONICA",
          asterisk_call_id: null,
          asterisk_caller_phone: null,
          operador_id: "user-op-001",
          estado: "EN_ATENCION",
          es_duplicado: true,
          aviso_original_id: null,
          incidente_id: "incidente-uuid-2",
          creado_en: new Date(),
          actualizado_en: new Date(),
        },
        incidente: {
          id: "incidente-uuid-2",
          codigo: "INC-20260913-0002",
          tipo_afectacion: "Caída de árbol",
          descripcion: "Árbol derribado",
          direccion_texto: "Picarte 2000",
          latitud: -39.8256,
          longitud: -73.2321,
          estado: "SIN_ATENDER",
          prioridad: "MEDIA",
          requiere_asistencia_social: false,
          aviso_origen_id: "aviso-uuid-2",
          creado_por_id: "user-op-001",
          encargado_id: null,
          creado_en: new Date(),
          actualizado_en: new Date(),
        },
      } as unknown as Awaited<ReturnType<typeof repository.insertarIncidenteManualTransaccional>>);

      vi.spyOn(socket, "notificarIncidenteCreado").mockReturnValue(true);

      const inputForzado = { ...inputBase, forzarCreacion: true };
      const respuesta = await crearIncidenteManual(inputForzado, "user-op-001");

      // No debió invocar la verificación restrictiva de duplicados
      expect(spyBuscarDuplicados).not.toHaveBeenCalled();
      expect(respuesta.incidente.id).toBe("incidente-uuid-2");
    });
  });
});
