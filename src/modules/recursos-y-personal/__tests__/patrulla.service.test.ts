import { describe, it, expect, vi, beforeEach } from "vitest";
import * as authService from "@/modules/seguridad/auth.service";
import * as socketModule from "@/lib/socket";
import * as patrullaRepo from "../patrulla.repository";
import {
  listarPatrullasService,
  obtenerDetallePatrullaService,
  actualizarEstadoPatrullaService,
  crearPatrullaService,
  desactivarPatrullaService,
} from "../patrulla.service";
import { seguridadService } from "@/modules/seguridad/service";
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
      rut: "11111111-1",
      email: "admin@valdivia.cl",
      nombre: "Administrador",
      rolId: "rol-admin",
      rolNombre: "Administrador",
      activo: true,
    };

    it("debe registrar exitosamente una patrulla verificadora en estado DISPONIBLE y emitir WebSocket", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

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
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador o permiso recursos:crear.")
      );

      await expect(crearPatrullaService(inputCrear, "user-sin-permiso")).rejects.toThrow(
        ForbiddenError
      );
    });

    it("debe rechazar con ConflictError si el código ya existe en una patrulla activa", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce({
        id: "otra-patrulla-id",
        codigo: "PV-NORTE-01",
        nombre: "Otra Patrulla",
        estado: "DISPONIBLE",
      });

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(ConflictError);
    });

    it("debe rechazar con NotFoundError si la delegación base no existe", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "buscarPatrullaPorCodigoRepo").mockResolvedValueOnce(undefined);
      vi.spyOn(patrullaRepo, "obtenerDelegacionPorIdRepo").mockResolvedValueOnce(undefined);

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(NotFoundError);
    });

    it("debe rechazar con BadRequestError si el vehículo no es individual", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

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

    it("debe rechazar con ConflictError si el vehículo está ocupado o ASIGNADO", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

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

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(ConflictError);
    });

    it("debe rechazar con BadRequestError si algún funcionario no tiene rol PATRULLA_VERIFICADORA", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

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
          rol_codigo: "BRIGADISTA", // no es PATRULLA_VERIFICADORA
        },
      ]);

      await expect(crearPatrullaService(inputCrear, adminUserId)).rejects.toThrow(BadRequestError);
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
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      await expect(
        desactivarPatrullaService(patrullaId, "usuario-sin-permisos")
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe lanzar NotFoundError si la patrulla no existe o ya fue dada de baja", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce(null);

      await expect(
        desactivarPatrullaService(patrullaId, adminUserId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe rechazar con ConflictError si la patrulla se encuentra en estado EN_VERIFICACION", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

      vi.spyOn(patrullaRepo, "obtenerPatrullaPorIdRepo").mockResolvedValueOnce({
        fila: {
          ...mockFila,
          patrulla_estado: "EN_VERIFICACION",
        },
        integrantes: [mockIntegrante],
      });

      await expect(
        desactivarPatrullaService(patrullaId, adminUserId)
      ).rejects.toThrow(ConflictError);
    });

    it("debe rechazar con ConflictError si la patrulla cuenta con misiones tácticas activas", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

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
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce(mockAdminUsuario);

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

