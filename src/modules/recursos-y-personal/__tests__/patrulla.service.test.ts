import { describe, it, expect, vi, beforeEach } from "vitest";
import * as authService from "@/modules/seguridad/auth.service";
import { seguridadService } from "@/modules/seguridad/service";
import * as socketModule from "@/lib/socket";
import * as patrullaRepo from "../patrulla.repository";
import {
  listarPatrullasService,
  obtenerDetallePatrullaService,
  actualizarEstadoPatrullaService,
  crearPatrullaService,
  modificarPatrullaService,
  desactivarPatrullaService,
} from "../patrulla.service";
import {
  ForbiddenError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/modules/seguridad/errors";

describe("Módulo Recursos y Personal - Servicio de Patrullas Verificadoras", () => {
  const adminUserId = "00000000-0000-4000-8000-000000000001";
  const patrullaId = "f1000000-0000-4000-8000-000000000001";

  const mockAdminUsuario = {
    id: adminUserId,
    rut: "11111111-1",
    email: "admin@valdivia.cl",
    nombre: "Administrador",
    rolId: "20000000-0000-4000-8000-000000000001",
    rolNombre: "Administrador",
    rol: "ADMINISTRADOR",
    activo: true,
  };

  const mockFila: patrullaRepo.FilaPatrullaConsulta = {
    patrulla_id: patrullaId,
    patrulla_codigo: "PV-COSTA-01",
    patrulla_nombre: "Patrulla Rápida Costa-1",
    patrulla_estado: "EN_VERIFICACION",
    patrulla_latitud: -39.86523,
    patrulla_longitud: -73.39841,
    patrulla_ultima_actualizacion_ubicacion: new Date("2026-10-20T22:00:00.000Z"),
    patrulla_creado_en: new Date("2026-10-20T10:00:00.000Z"),
    patrulla_actualizado_en: new Date("2026-10-20T22:30:00.000Z"),
    patrulla_activo: true,
    patrulla_eliminado_en: null,
    patrulla_eliminado_por_id: null,
    delegacion_id: "30000000-0000-4000-8000-000000000003",
    delegacion_nombre: "Delegación Municipal Costa",
    delegacion_codigo: "DEL_COSTA",
    vehiculo_id: "e1000000-0000-4000-8000-000000000002",
    vehiculo_nombre: "Camioneta 4x4 Navara",
    vehiculo_detalles: { patente: "CD-FG-23" },
    vehiculo_estado: "ASIGNADO",
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

  describe("crearPatrullaService (Alta de Patrulla - HU-83)", () => {
    const inputCrear = {
      codigo: "PV-NORTE-01",
      nombre: "Patrulla Norte 1",
      delegacionId: "30000000-0000-4000-8000-000000000001",
      vehiculoId: "e1000000-0000-4000-8000-000000000002",
      personalIds: ["b1000000-0000-4000-8000-000000000001"],
      usuarioLiderId: "c1000000-0000-4000-8000-000000000001",
    };

    const mockPersonalValido = [
      {
        personal_id: "b1000000-0000-4000-8000-000000000001",
        usuario_id: "c1000000-0000-4000-8000-000000000001",
        nombre: "Juan Brigadista",
        email: "juan@valdivia.cl",
        activo: true,
        rol_codigo: "PATRULLA_VERIFICADORA",
        estado_operativo: "disponible" as const,
      },
    ];

    const mockVehiculoValido = {
      id: "e1000000-0000-4000-8000-000000000002",
      nombre: "Camioneta 4x4 Navara",
      es_individual: true,
      estado: "DISPONIBLE" as const,
      cantidad_inventario: 1,
      cantidad_en_uso: 0,
      latitud: -39.8142,
      longitud: -73.2459,
      detalles: { patente: "CD-FG-23" },
    };

    const mockAdminUsuario = {
      id: adminUserId,
      nombre: "Administrador",
      rol: "Administrador",
    };

    it("debe registrar exitosamente una patrulla verificadora en estado DISPONIBLE y emitir WebSocket", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        nombre: "Delegación Municipal Norte",
        codigo: "DEL_NORTE",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce(mockVehiculoValido);
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce(mockPersonalValido);
      vi.spyOn(patrullaRepo, "crearPatrullaTransaccionalRepo").mockResolvedValueOnce(patrullaId);

      const filaNueva: patrullaRepo.FilaPatrullaConsulta = {
        ...mockFila,
        patrulla_codigo: "PV-NORTE-01",
        patrulla_nombre: "Patrulla Norte 1",
        patrulla_estado: "DISPONIBLE",
        mision_id: null,
      };

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: filaNueva,
        integrantes: [mockIntegrante],
      });

      const spySocket = vi.spyOn(socketModule, "notificarPatrullaCreada").mockImplementation(() => {});

      const res = await crearPatrullaService(inputCrear, adminUserId);

      expect(res.message).toContain("exitosa");
      expect(res.data.id).toBe(patrullaId);
      expect(res.data.codigo).toBe("PV-NORTE-01");
      expect(res.data.estado).toBe("DISPONIBLE");
      expect(spySocket).toHaveBeenCalledWith(
        expect.objectContaining({
          patrullaId,
          codigo: "PV-NORTE-01",
          estado: "DISPONIBLE",
        })
      );
    });

    it("debe rechazar con ForbiddenError si no cuenta con permiso recursos:crear", async () => {
      vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
        new ForbiddenError("No cuenta con el permiso requerido: recursos:crear")
      );

      await expect(crearPatrullaService(inputCrear, "user-sin-permiso")).rejects.toThrow(
        ForbiddenError
      );
    });

    it("debe rechazar con ConflictError si el código ya existe en una patrulla activa", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce({
        id: "otra-patrulla-id",
        codigo: "PV-NORTE-01",
        nombre: "Otra Patrulla",
        estado: "DISPONIBLE",
      });

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(ConflictError);
    });

    it("debe rechazar con NotFoundError si la delegación base no existe", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce(undefined);

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(NotFoundError);
    });

    it("debe rechazar con BadRequestError si el vehículo no es individual", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        nombre: "Delegación Norte",
        codigo: "DEL_NORTE",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce({
        ...mockVehiculoValido,
        es_individual: false, // recurso a granel
      });

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(BadRequestError);
    });

    it("debe rechazar con ConflictError si el vehículo está en mantención o no disponible", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        nombre: "Delegación Norte",
        codigo: "DEL_NORTE",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce({
        ...mockVehiculoValido,
        estado: "EN_MANTENCION" as const,
        cantidad_en_uso: 0,
      });

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(ConflictError);
    });

    it("debe permitir asignar un vehículo que ya se encuentra ASIGNADO a otra patrulla", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        nombre: "Delegación Norte",
        codigo: "DEL_NORTE",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce({
        ...mockVehiculoValido,
        estado: "ASIGNADO" as const,
        cantidad_en_uso: 1,
      });
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce(mockPersonalValido);
      vi.spyOn(patrullaRepo, "crearPatrullaTransaccionalRepo").mockResolvedValueOnce("a1000000-0000-4000-8000-000000000002");
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: {
          patrulla_id: "a1000000-0000-4000-8000-000000000002",
          patrulla_codigo: "PV-NORTE-02",
          patrulla_nombre: "Patrulla Norte 2",
          patrulla_estado: "DISPONIBLE",
          patrulla_latitud: -39.8142,
          patrulla_longitud: -73.2459,
          patrulla_ultima_actualizacion_ubicacion: "2026-11-03T10:00:00.000Z",
          patrulla_creado_en: "2026-11-03T10:00:00.000Z",
          patrulla_actualizado_en: "2026-11-03T10:00:00.000Z",
          delegacion_id: "30000000-0000-4000-8000-000000000001",
          delegacion_nombre: "Delegación Norte",
          delegacion_codigo: "DEL_NORTE",
          vehiculo_id: mockVehiculoValido.id,
          vehiculo_nombre: mockVehiculoValido.nombre,
          vehiculo_detalles: mockVehiculoValido.detalles,
          vehiculo_estado: "ASIGNADO",
          lider_id: mockPersonalValido[0].usuario_id,
          lider_nombre: mockPersonalValido[0].nombre,
          lider_email: mockPersonalValido[0].email,
          lider_telefono: null,
          lider_rut: null,
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
        },
        integrantes: [
          {
            patrulla_id: "a1000000-0000-4000-8000-000000000002",
            personal_id: mockPersonalValido[0].personal_id,
            usuario_id: mockPersonalValido[0].usuario_id,
            nombre: mockPersonalValido[0].nombre,
            email: mockPersonalValido[0].email,
            telefono: null,
            rut: null,
            cargo: "Evaluador",
            especialidad: null,
            rol_en_patrulla: "LIDER",
            estado_operativo: "en_patrulla",
          },
        ],
      });

      const res = await crearPatrullaService(inputCrear, adminUserId);
      expect(res.data.id).toBe("a1000000-0000-4000-8000-000000000002");
    });

    it("debe rechazar con BadRequestError si algún funcionario no tiene rol PATRULLA_VERIFICADORA", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        nombre: "Delegación Norte",
        codigo: "DEL_NORTE",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce(mockVehiculoValido);
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce([
        {
          ...mockPersonalValido[0],
          rol_codigo: "BRIGADISTA",
        },
      ]);

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(BadRequestError);
    });

    it("debe permitir asignar un funcionario que ya se encuentra en_patrulla", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        nombre: "Delegación Norte",
        codigo: "DEL_NORTE",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce(mockVehiculoValido);
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce([
        {
          ...mockPersonalValido[0],
          estado_operativo: "en_patrulla",
        },
      ]);
      vi.spyOn(patrullaRepo, "crearPatrullaTransaccionalRepo").mockResolvedValueOnce("a1000000-0000-4000-8000-000000000003");
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: {
          patrulla_id: "a1000000-0000-4000-8000-000000000003",
          patrulla_codigo: "PV-NORTE-03",
          patrulla_nombre: "Patrulla Norte 3",
          patrulla_estado: "DISPONIBLE",
          patrulla_latitud: null,
          patrulla_longitud: null,
          patrulla_ultima_actualizacion_ubicacion: null,
          patrulla_creado_en: "2026-11-03T10:00:00.000Z",
          patrulla_actualizado_en: "2026-11-03T10:00:00.000Z",
          delegacion_id: "30000000-0000-4000-8000-000000000001",
          delegacion_nombre: "Delegación Norte",
          delegacion_codigo: "DEL_NORTE",
          vehiculo_id: null,
          vehiculo_nombre: null,
          vehiculo_detalles: null,
          vehiculo_estado: null,
          lider_id: mockPersonalValido[0].usuario_id,
          lider_nombre: mockPersonalValido[0].nombre,
          lider_email: mockPersonalValido[0].email,
          lider_telefono: null,
          lider_rut: null,
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
        },
        integrantes: [
          {
            patrulla_id: "a1000000-0000-4000-8000-000000000003",
            personal_id: mockPersonalValido[0].personal_id,
            usuario_id: mockPersonalValido[0].usuario_id,
            nombre: mockPersonalValido[0].nombre,
            email: mockPersonalValido[0].email,
            telefono: null,
            rut: null,
            cargo: "Evaluador",
            especialidad: null,
            rol_en_patrulla: "LIDER",
            estado_operativo: "en_patrulla",
          },
        ],
      });

      const res = await crearPatrullaService(inputCrear, adminUserId);
      expect(res.data.id).toBe("a1000000-0000-4000-8000-000000000003");
    });

    it("debe rechazar con ConflictError si algún funcionario se encuentra en licencia, descanso o inactivo", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        nombre: "Delegación Norte",
        codigo: "DEL_NORTE",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce(mockVehiculoValido);
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce([
        {
          ...mockPersonalValido[0],
          estado_operativo: "licencia",
        },
      ]);

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(ConflictError);
    });

    it("debe permitir designar como líder al segundo integrante y pasar personalFilas al repositorio", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        nombre: "Delegación Norte",
        codigo: "DEL_NORTE",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce(undefined);

      const personalDosIntegrantes = [
        {
          personal_id: "b1000000-0000-4000-8000-000000000001",
          usuario_id: "c1000000-0000-4000-8000-000000000001",
          nombre: "Integrante Uno",
          email: "uno@valdivia.cl",
          activo: true,
          rol_codigo: "PATRULLA_VERIFICADORA",
          estado_operativo: "disponible" as const,
        },
        {
          personal_id: "b1000000-0000-4000-8000-000000000002",
          usuario_id: "c1000000-0000-4000-8000-000000000002",
          nombre: "Líder Dos",
          email: "dos@valdivia.cl",
          activo: true,
          rol_codigo: "PATRULLA_VERIFICADORA",
          estado_operativo: "disponible" as const,
        },
      ];

      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce(personalDosIntegrantes);
      const spyCrearRepo = vi.spyOn(patrullaRepo, "crearPatrullaTransaccionalRepo").mockResolvedValueOnce(patrullaId);

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: {
          ...mockFila,
          patrulla_codigo: "PV-NORTE-02",
          lider_id: "c1000000-0000-4000-8000-000000000002",
        },
        integrantes: [
          { ...mockIntegrante, personal_id: "b1000000-0000-4000-8000-000000000001", rol_en_patrulla: "OPERATIVO" },
          { ...mockIntegrante, personal_id: "b1000000-0000-4000-8000-000000000002", usuario_id: "c1000000-0000-4000-8000-000000000002", rol_en_patrulla: "LIDER" },
        ],
      });
      vi.spyOn(socketModule, "notificarPatrullaCreada").mockImplementation(() => {});

      const res = await crearPatrullaService(
        {
          ...inputCrear,
          codigo: "PV-NORTE-02",
          vehiculoId: null,
          personalIds: [
            "b1000000-0000-4000-8000-000000000001",
            "b1000000-0000-4000-8000-000000000002",
          ],
          usuarioLiderId: "c1000000-0000-4000-8000-000000000002",
        },
        adminUserId
      );

      expect(res.data.codigo).toBe("PV-NORTE-02");
      expect(spyCrearRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioLiderId: "c1000000-0000-4000-8000-000000000002",
          personalFilas: [
            { personal_id: "b1000000-0000-4000-8000-000000000001", usuario_id: "c1000000-0000-4000-8000-000000000001" },
            { personal_id: "b1000000-0000-4000-8000-000000000002", usuario_id: "c1000000-0000-4000-8000-000000000002" },
          ],
        })
      );
    });
  });


  describe("modificarPatrullaService (Edición de Patrulla - HU-84)", () => {
    const inputModificar = {
      nombre: "Patrulla Costa Renovada",
      delegacionId: "30000000-0000-4000-8000-000000000003",
      vehiculoId: "e1000000-0000-4000-8000-000000000002",
      personalIds: ["b1000000-0000-4000-8000-000000000001"],
      usuarioLiderId: "c1000000-0000-4000-8000-000000000001",
    };

    const mockAdminUsuario = {
      id: adminUserId,
      rut: "11111111-1",
      email: "admin@valdivia.cl",
      nombre: "Administrador",
      rolId: "rol-admin",
      rolNombre: "Administrador",
      activo: true,
    };

    const mockFilaDisponible: patrullaRepo.FilaPatrullaConsulta = {
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

    const mockPersonalExistente = [
      {
        personal_id: "b1000000-0000-4000-8000-000000000001",
        usuario_id: "c1000000-0000-4000-8000-000000000001",
        nombre: "Juan Brigadista",
        email: "juan@valdivia.cl",
        activo: true,
        rol_codigo: "PATRULLA_VERIFICADORA",
        estado_operativo: "en_patrulla" as const,
      },
    ];

    const mockPersonalNuevoDisponible = {
      personal_id: "b2000000-0000-4000-8000-000000000002",
      usuario_id: "c2000000-0000-4000-8000-000000000002",
      nombre: "Pedro Nuevo",
      email: "pedro@valdivia.cl",
      activo: true,
      rol_codigo: "PATRULLA_VERIFICADORA",
      estado_operativo: "disponible" as const,
    };

    const mockVehiculoDisponible = {
      id: "e2000000-0000-4000-8000-000000000005",
      nombre: "Camioneta 4x4 Nueva",
      es_individual: true,
      estado: "DISPONIBLE" as const,
      cantidad_inventario: 1,
      cantidad_en_uso: 0,
      latitud: -39.8142,
      longitud: -73.2459,
      detalles: { patente: "ZZ-YY-99" },
    };

    it("debe rechazar con ForbiddenError si no cuenta con permiso recursos:editar", async () => {
      vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el permiso recursos:editar.")
      );

      await expect(
        modificarPatrullaService(patrullaId, inputModificar, "usuario-sin-permiso")
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe rechazar con NotFoundError si la patrulla verificadora no existe", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce(null);

      await expect(
        modificarPatrullaService("patrulla-inexistente", inputModificar, adminUserId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe rechazar con ConflictError si la patrulla está en estado EN_VERIFICACION", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: {
          ...mockFila,
          patrulla_estado: "EN_VERIFICACION",
          mision_id: null,
        },
        integrantes: [mockIntegrante],
      });

      await expect(
        modificarPatrullaService(patrullaId, inputModificar, adminUserId)
      ).rejects.toThrow(ConflictError);
    });

    it("debe rechazar con ConflictError si la patrulla tiene una misión táctica activa en terreno", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: {
          ...mockFila,
          patrulla_estado: "DISPONIBLE",
          mision_id: "mision-activa-uuid",
        },
        integrantes: [mockIntegrante],
      });

      await expect(
        modificarPatrullaService(patrullaId, inputModificar, adminUserId)
      ).rejects.toThrow(ConflictError);
    });

    it("debe rechazar con NotFoundError si la delegación base no existe", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: mockFilaDisponible,
        integrantes: [mockIntegrante],
      });
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce(undefined);

      await expect(
        modificarPatrullaService(patrullaId, inputModificar, adminUserId)
      ).rejects.toThrow(NotFoundError);
    });

    it("BUG-H84-API-02: debe preservar el vehículo actual y no desasignarlo si vehiculoId es undefined", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo")
        .mockResolvedValueOnce({
          fila: mockFilaDisponible, // vehiculo_id: "e1000000-0000-4000-8000-000000000002"
          integrantes: [mockIntegrante],
        })
        .mockResolvedValueOnce({
          fila: mockFilaDisponible,
          integrantes: [mockIntegrante],
        });
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000003",
        nombre: "Delegación Costa",
        codigo: "DEL_COSTA",
      });
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce(mockPersonalExistente);
      const spyRepo = vi.spyOn(patrullaRepo, "modificarPatrullaTransaccionalRepo").mockResolvedValueOnce();
      vi.spyOn(socketModule, "notificarPatrullaActualizada").mockImplementation(() => {});

      const inputSinVehiculo = {
        ...inputModificar,
        vehiculoId: undefined, // Campo omitido en la petición
      };

      await modificarPatrullaService(patrullaId, inputSinVehiculo, adminUserId);

      expect(spyRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          id: patrullaId,
          vehiculoId: mockFilaDisponible.vehiculo_id, // Preserva el vehículo previo
          latitud: undefined,
          longitud: undefined,
        })
      );
    });

    it("BUG-H84-API-02 y BUG-H84-API-04: debe pasar vehiculoId: null y coordenadas null si se solicita explícitamente null", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo")
        .mockResolvedValueOnce({
          fila: mockFilaDisponible,
          integrantes: [mockIntegrante],
        })
        .mockResolvedValueOnce({
          fila: {
            ...mockFilaDisponible,
            vehiculo_id: null,
            vehiculo_nombre: null,
            patrulla_latitud: null,
            patrulla_longitud: null,
          },
          integrantes: [mockIntegrante],
        });
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000003",
        nombre: "Delegación Costa",
        codigo: "DEL_COSTA",
      });
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce(mockPersonalExistente);
      const spyRepo = vi.spyOn(patrullaRepo, "modificarPatrullaTransaccionalRepo").mockResolvedValueOnce();
      vi.spyOn(socketModule, "notificarPatrullaActualizada").mockImplementation(() => {});

      const inputDesasignarVehiculo = {
        ...inputModificar,
        vehiculoId: null, // Desasignación explícita
      };

      await modificarPatrullaService(patrullaId, inputDesasignarVehiculo, adminUserId);

      expect(spyRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          id: patrullaId,
          vehiculoId: null,
          latitud: null,
          longitud: null,
        })
      );
    });

    it("debe rechazar con BadRequestError si el nuevo vehículo asignado no es individual", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: mockFilaDisponible,
        integrantes: [mockIntegrante],
      });
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000003",
        nombre: "Delegación Costa",
        codigo: "DEL_COSTA",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce({
        ...mockVehiculoDisponible,
        es_individual: false, // a granel
      });

      const inputNuevoVehiculo = {
        ...inputModificar,
        vehiculoId: mockVehiculoDisponible.id,
      };

      await expect(
        modificarPatrullaService(patrullaId, inputNuevoVehiculo, adminUserId)
      ).rejects.toThrow(BadRequestError);
    });

    it("debe rechazar con ConflictError si el nuevo vehículo asignado está en mantención o no disponible", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: mockFilaDisponible,
        integrantes: [mockIntegrante],
      });
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000003",
        nombre: "Delegación Costa",
        codigo: "DEL_COSTA",
      });
      vi.spyOn(patrullaRepo, "obtenerVehiculoPorIdRepo").mockResolvedValueOnce({
        ...mockVehiculoDisponible,
        estado: "EN_MANTENCION" as const,
        cantidad_en_uso: 0,
      });

      const inputNuevoVehiculo = {
        ...inputModificar,
        vehiculoId: mockVehiculoDisponible.id,
      };

      await expect(
        modificarPatrullaService(patrullaId, inputNuevoVehiculo, adminUserId)
      ).rejects.toThrow(ConflictError);
    });

    it("BUG-H84-API-03: debe rechazar con ConflictError si un NUEVO integrante se encuentra en licencia o descanso", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: mockFilaDisponible,
        integrantes: [mockIntegrante], // personal_id: "b1000000-..."
      });
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000003",
        nombre: "Delegación Costa",
        codigo: "DEL_COSTA",
      });
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce([
        mockPersonalExistente[0],
        {
          ...mockPersonalNuevoDisponible,
          estado_operativo: "licencia" as const, // ¡No operativo!
        },
      ]);

      const inputConNuevoIntegrante = {
        ...inputModificar,
        personalIds: [mockPersonalExistente[0].personal_id, mockPersonalNuevoDisponible.personal_id],
      };

      await expect(
        modificarPatrullaService(patrullaId, inputConNuevoIntegrante, adminUserId)
      ).rejects.toThrow(ConflictError);
    });

    it("BUG-H84-API-03: debe permitir conservar integrantes actuales aunque tengan estado operativo en_patrulla", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo")
        .mockResolvedValueOnce({
          fila: mockFilaDisponible,
          integrantes: [mockIntegrante], // personal_id: "b1000000-...", estado: "en_patrulla"
        })
        .mockResolvedValueOnce({
          fila: mockFilaDisponible,
          integrantes: [mockIntegrante],
        });
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000003",
        nombre: "Delegación Costa",
        codigo: "DEL_COSTA",
      });
      // El funcionario existente tiene estado_operativo "en_patrulla", y el nuevo "disponible"
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce([
        mockPersonalExistente[0],
        mockPersonalNuevoDisponible,
      ]);
      const spyRepo = vi.spyOn(patrullaRepo, "modificarPatrullaTransaccionalRepo").mockResolvedValueOnce();
      vi.spyOn(socketModule, "notificarPatrullaActualizada").mockImplementation(() => {});

      const inputConNuevoIntegrante = {
        ...inputModificar,
        personalIds: [mockPersonalExistente[0].personal_id, mockPersonalNuevoDisponible.personal_id],
      };

      await expect(
        modificarPatrullaService(patrullaId, inputConNuevoIntegrante, adminUserId)
      ).resolves.not.toThrow();
      expect(spyRepo).toHaveBeenCalled();
    });

    it("BUG-H84-API-01: debe enviar personalLiderId correspondiente al usuarioLiderId suministrado", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo")
        .mockResolvedValueOnce({
          fila: mockFilaDisponible,
          integrantes: [mockIntegrante],
        })
        .mockResolvedValueOnce({
          fila: mockFilaDisponible,
          integrantes: [mockIntegrante],
        });
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000003",
        nombre: "Delegación Costa",
        codigo: "DEL_COSTA",
      });
      // 2 integrantes: el segundo será el líder designado
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce([
        mockPersonalExistente[0],
        mockPersonalNuevoDisponible,
      ]);
      const spyRepo = vi.spyOn(patrullaRepo, "modificarPatrullaTransaccionalRepo").mockResolvedValueOnce();
      vi.spyOn(socketModule, "notificarPatrullaActualizada").mockImplementation(() => {});

      const inputConLiderEspecifico = {
        ...inputModificar,
        personalIds: [mockPersonalExistente[0].personal_id, mockPersonalNuevoDisponible.personal_id],
        usuarioLiderId: mockPersonalNuevoDisponible.usuario_id, // El líder es el 2do integrante
      };

      await modificarPatrullaService(patrullaId, inputConLiderEspecifico, adminUserId);

      expect(spyRepo).toHaveBeenCalledWith(
        expect.objectContaining({
          id: patrullaId,
          usuarioLiderId: mockPersonalNuevoDisponible.usuario_id,
          personalLiderId: mockPersonalNuevoDisponible.personal_id, // Pasa el personal_id del segundo integrante
        })
      );
    });

    it("debe modificar exitosamente la patrulla y emitir notificación WebSocket patrulla:actualizada", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      const filaModificada: patrullaRepo.FilaPatrullaConsulta = {
        ...mockFilaDisponible,
        patrulla_nombre: "Patrulla Costa Renovada",
      };

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo")
        .mockResolvedValueOnce({
          fila: mockFilaDisponible,
          integrantes: [mockIntegrante],
        })
        .mockResolvedValueOnce({
          fila: filaModificada,
          integrantes: [mockIntegrante],
        });
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000003",
        nombre: "Delegación Costa",
        codigo: "DEL_COSTA",
      });
      vi.spyOn(patrullaRepo, "obtenerPersonalParaPatrullaRepo").mockResolvedValueOnce(mockPersonalExistente);
      vi.spyOn(patrullaRepo, "modificarPatrullaTransaccionalRepo").mockResolvedValueOnce();
      const spySocket = vi.spyOn(socketModule, "notificarPatrullaActualizada").mockImplementation(() => {});

      const res = await modificarPatrullaService(patrullaId, inputModificar, adminUserId);

      expect(res.message).toContain("exitosa");
      expect(res.data.id).toBe(patrullaId);
      expect(res.data.nombre).toBe("Patrulla Costa Renovada");
      expect(spySocket).toHaveBeenCalledWith(
        expect.objectContaining({
          patrullaId,
          nombre: "Patrulla Costa Renovada",
          estado: filaModificada.patrulla_estado,
        })
      );
    });
  });

  describe("desactivarPatrullaService (HU-85)", () => {
    const mockPatrullaDisponible: {
      fila: patrullaRepo.FilaPatrullaConsulta;
      integrantes: patrullaRepo.FilaIntegranteConsulta[];
    } = {
      fila: {
        ...mockFila,
        patrulla_estado: "DISPONIBLE",
        mision_id: null,
      },
      integrantes: [mockIntegrante],
    };

    it("debe lanzar ForbiddenError si el usuario no tiene permiso de administrador o recursos:eliminar", async () => {
      vi.spyOn(authService, "verificarPermiso").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      await expect(
        desactivarPatrullaService(patrullaId, "usuario-sin-permisos")
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe lanzar NotFoundError si la patrulla no existe o ya fue dada de baja", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce(null);

      await expect(
        desactivarPatrullaService(patrullaId, adminUserId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe rechazar con ConflictError si la patrulla se encuentra en estados de terreno (EN_VERIFICACION, EN_PREVENCION, EN_RECUPERACION, EN_MISION) (BUG-H85-API-01)", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValue(mockAdminUsuario);

      for (const estadoTerreno of ["EN_VERIFICACION", "EN_PREVENCION", "EN_RECUPERACION", "EN_MISION"] as const) {
        vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
          fila: {
            ...mockFila,
            patrulla_estado: estadoTerreno,
          },
          integrantes: [mockIntegrante],
        });

        await expect(
          desactivarPatrullaService(patrullaId, adminUserId)
        ).rejects.toThrow(ConflictError);
      }
    });

    it("debe rechazar con NotFoundError si la patrulla ya fue desactivada por baja lógica (BUG-H85-API-04)", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: {
          ...mockFila,
          patrulla_activo: false,
          patrulla_eliminado_en: "2026-10-26T10:00:00.000Z",
        },
        integrantes: [mockIntegrante],
      });

      await expect(
        desactivarPatrullaService(patrullaId, adminUserId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe propagar ConflictError si la transacción atómica detecta colisión concurrente (BUG-H85-API-01)", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);
      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce(mockPatrullaDisponible);
      vi.spyOn(patrullaRepo, "verificarMisionesActivasPatrullaRepo").mockResolvedValueOnce([]);
      vi.spyOn(patrullaRepo, "desactivarPatrullaTransaccionalRepo").mockRejectedValueOnce(
        new Error("CONFLICT:No es posible desactivar la patrulla porque se encuentra actualmente en terreno.")
      );

      await expect(
        desactivarPatrullaService(patrullaId, adminUserId)
      ).rejects.toThrow(ConflictError);
    });

    it("debe rechazar con ConflictError si la patrulla cuenta con misiones tácticas activas", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: {
          ...mockFila,
          patrulla_estado: "DISPONIBLE",
          mision_id: "mision-activa-1",
        },
        integrantes: [mockIntegrante],
      });

      vi.spyOn(patrullaRepo, "verificarMisionesActivasPatrullaRepo").mockResolvedValueOnce([
        {
          id: "mision-activa-1",
          codigo: "MIS-2026-0001",
          titulo: "Verificación de desborde",
          estado: "EN_CURSO",
        },
      ]);

      await expect(
        desactivarPatrullaService(patrullaId, adminUserId)
      ).rejects.toThrow(ConflictError);
    });

    it("debe desactivar exitosamente la patrulla, liberar personal/vehículo y emitir eventos socket", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce(mockPatrullaDisponible);
      vi.spyOn(patrullaRepo, "verificarMisionesActivasPatrullaRepo").mockResolvedValueOnce([]);

      const mockResultadoRepo: patrullaRepo.ResultadoDesactivacionPatrullaRepo = {
        id: patrullaId,
        codigo: "PV-COSTA-01",
        nombre: "Patrulla Rápida Costa-1",
        estado: "NO_DISPONIBLE",
        activo: false,
        eliminadoEn: "2026-10-26T15:00:00.000Z",
        eliminadoPorId: adminUserId,
        vehiculoLiberadoId: "e1000000-0000-4000-8000-000000000002",
        personalLiberadoIds: ["b1000000-0000-4000-8000-000000000001"],
      };

      vi.spyOn(patrullaRepo, "desactivarPatrullaTransaccionalRepo").mockResolvedValueOnce(mockResultadoRepo);
      const spySocketDesactivada = vi.spyOn(socketModule, "notificarPatrullaDesactivada").mockImplementation(() => {});
      const spySocketActualizada = vi.spyOn(socketModule, "notificarPatrullaActualizada").mockImplementation(() => {});
      const spySocketRecurso = vi.spyOn(socketModule, "emitirRecursoActualizado").mockImplementation(() => {});

      const respuesta = await desactivarPatrullaService(patrullaId, adminUserId);

      expect(respuesta.message).toContain("desactivada exitosamente");
      expect(respuesta.data.activo).toBe(false);
      expect(respuesta.data.estado).toBe("NO_DISPONIBLE");
      expect(respuesta.data.vehiculoLiberadoId).toBe("e1000000-0000-4000-8000-000000000002");
      expect(respuesta.data.personalLiberadoIds).toHaveLength(1);

      expect(spySocketDesactivada).toHaveBeenCalledWith(
        expect.objectContaining({
          patrullaId,
          nombre: "Patrulla Rápida Costa-1",
          eliminadoPorId: adminUserId,
        })
      );
      expect(spySocketActualizada).toHaveBeenCalled();
      expect(spySocketRecurso).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "e1000000-0000-4000-8000-000000000002",
          estado: "DISPONIBLE",
          cantidadEnUso: 0,
        })
      );
    });
  });
});

