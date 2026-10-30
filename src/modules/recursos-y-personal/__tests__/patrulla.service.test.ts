import { describe, it, expect, vi, beforeEach } from "vitest";
import * as authService from "@/modules/seguridad/auth.service";
import * as socketModule from "@/lib/socket";
import * as patrullaRepo from "../patrulla.repository";
import {
  listarPatrullasService,
  obtenerDetallePatrullaService,
  actualizarEstadoPatrullaService,
} from "../patrulla.service";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/auth.errors";

describe("Módulo Recursos y Personal - Servicio de Patrullas Verificadoras", () => {
  const adminUserId = "00000000-0000-4000-8000-000000000001";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";

  const mockFila: patrullaRepo.FilaPatrullaConsulta = {
    patrulla_id: patrullaId,
    patrulla_nombre: "Patrulla Rápida Costa-1",
    patrulla_estado: "EN_VERIFICACION",
    patrulla_latitud: -39.86523,
    patrulla_longitud: -73.39841,
    patrulla_ultima_actualizacion_ubicacion: new Date("2026-10-20T22:00:00.000Z"),
    patrulla_creado_en: new Date("2026-10-20T10:00:00.000Z"),
    patrulla_actualizado_en: new Date("2026-10-20T22:30:00.000Z"),
    delegacion_id: "30000000-0000-4000-8000-000000000003",
    delegacion_nombre: "Delegación Municipal Costa",
    delegacion_codigo: "DEL_COSTA",
    lider_id: "00000000-0000-4000-8000-000000000003",
    lider_nombre: "Encargado de Operaciones",
    lider_email: "encargado@valdivia.cl",
    lider_telefono: "+56911112222",
    lider_rut: "33333333-3",
    mision_id: "d1000000-0000-4000-8000-000000000001",
    mision_codigo: "MIS-2026-0001",
    mision_titulo: "Evaluación preliminar de riesgo",
    mision_tipo: "VERIFICACION",
    mision_estado: "EN_CURSO",
    mision_prioridad: "CRITICA",
    incidente_id: "a1000000-0000-4000-8000-000000000003",
    incidente_codigo: "INC-2026-0003",
    incidente_folio: "FOL-2026-0003",
    incidente_tipo_afectacion: "Deslizamiento de Tierra",
    incidente_direccion: "Ruta T-350 km 12",
  };

  const mockIntegrante: patrullaRepo.FilaIntegranteConsulta = {
    patrulla_id: patrullaId,
    personal_id: "b1000000-0000-4000-8000-000000000001",
    usuario_id: "c1000000-0000-4000-8000-000000000001",
    nombre: "Juan Brigadista",
    email: "juan@valdivia.cl",
    telefono: "+56999998888",
    rut: "18111222-3",
    cargo: "Evaluador Rápido",
    especialidad: "Riesgos Geológicos",
    rol_en_patrulla: "OPERATIVO",
    estado_operativo: "en_patrulla",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("listarPatrullasService", () => {
    it("debe lanzar ForbiddenError si el usuario no tiene el permiso misiones:leer", async () => {
      vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
        new ForbiddenError("No cuenta con el permiso requerido: misiones:leer")
      );

      await expect(
        listarPatrullasService({ page: 1, limit: 20 }, "usuario-sin-permiso")
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe retornar listado estructurado con paginación estándar cuando está autorizado", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
        id: adminUserId,
        nombre: "Encargado de Operaciones",
        rol: "Encargado",
      });

      const integrantesMap = new Map();
      integrantesMap.set(patrullaId, [mockIntegrante]);

      vi.spyOn(patrullaRepo, "listarPatrullasRepo").mockResolvedValueOnce({
        total: 1,
        filas: [mockFila],
        integrantesMap,
      });

      const resultado = await listarPatrullasService(
        { page: 1, limit: 20 },
        adminUserId
      );

      expect(resultado.message).toContain("exitosamente");
      expect(resultado.data).toHaveLength(1);
      expect(resultado.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      const item = resultado.data[0];
      expect(item.id).toBe(patrullaId);
      expect(item.nombre).toBe("Patrulla Rápida Costa-1");
      expect(item.estado).toBe("EN_VERIFICACION");
      expect(item.latitud).toBe(-39.86523);
      expect(item.longitud).toBe(-73.39841);
      expect(item.lider?.nombre).toBe("Encargado de Operaciones");
      expect(item.delegacion?.codigo).toBe("DEL_COSTA");
      expect(item.integrantes).toHaveLength(1);
      expect(item.integrantes[0].nombre).toBe("Juan Brigadista");
      expect(item.misionActiva).not.toBeNull();
      expect(item.misionActiva?.codigo).toBe("MIS-2026-0001");
      expect(item.misionActiva?.incidenteCodigo).toBe("INC-2026-0003");
    });

    it("debe mapear misionActiva como null si la patrulla se encuentra DISPONIBLE", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
        id: adminUserId,
        nombre: "Encargado",
        rol: "Encargado",
      });

      const filaDisponible: patrullaRepo.FilaPatrullaConsulta = {
        ...mockFila,
        patrulla_estado: "DISPONIBLE",
        mision_id: null,
        mision_codigo: null,
        mision_titulo: null,
        mision_tipo: null,
        mision_estado: null,
        mision_prioridad: null,
        incidente_id: null,
        incidente_codigo: null,
        incidente_folio: null,
        incidente_tipo_afectacion: null,
        incidente_direccion: null,
      };

      vi.spyOn(patrullaRepo, "listarPatrullasRepo").mockResolvedValueOnce({
        total: 1,
        filas: [filaDisponible],
        integrantesMap: new Map(),
      });

      const resultado = await listarPatrullasService({ page: 1, limit: 10 }, adminUserId);

      expect(resultado.data[0].estado).toBe("DISPONIBLE");
      expect(resultado.data[0].misionActiva).toBeNull();
    });
  });

  describe("obtenerDetallePatrullaService", () => {
    it("debe retornar null si la patrulla no existe", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
        id: adminUserId,
        nombre: "Admin",
        rol: "Administrador",
      });

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce(null);

      const res = await obtenerDetallePatrullaService(patrullaId, adminUserId);
      expect(res).toBeNull();
    });

    it("debe retornar el detalle completo si la patrulla existe", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
        id: adminUserId,
        nombre: "Admin",
        rol: "Administrador",
      });

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: mockFila,
        integrantes: [mockIntegrante],
      });

      const res = await obtenerDetallePatrullaService(patrullaId, adminUserId);
      expect(res).not.toBeNull();
      expect(res?.data.id).toBe(patrullaId);
      expect(res?.data.integrantes).toHaveLength(1);
    });
  });

  describe("actualizarEstadoPatrullaService", () => {
    it("debe actualizar el estado y despachar el evento WebSocket patrulla:actualizada", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
        id: adminUserId,
        nombre: "Encargado",
        rol: "Encargado",
      });

      const filaActualizada: patrullaRepo.FilaPatrullaConsulta = {
        ...mockFila,
        patrulla_estado: "DISPONIBLE",
        mision_id: null,
      };

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo")
        .mockResolvedValueOnce({ fila: mockFila, integrantes: [] }) // existencia previa
        .mockResolvedValueOnce({ fila: filaActualizada, integrantes: [] }); // estado posterior

      vi.spyOn(patrullaRepo, "actualizarEstadoPatrullaRepo").mockResolvedValueOnce(true);
      const spySocket = vi.spyOn(socketModule, "notificarPatrullaActualizada").mockImplementation(() => {});

      const res = await actualizarEstadoPatrullaService(
        patrullaId,
        { estado: "DISPONIBLE", motivo: "Fin de misión" },
        adminUserId
      );

      expect(res).not.toBeNull();
      expect(res?.data.estado).toBe("DISPONIBLE");
      expect(spySocket).toHaveBeenCalledWith(
        expect.objectContaining({
          patrullaId,
          estado: "DISPONIBLE",
        })
      );
    });
  });
});
