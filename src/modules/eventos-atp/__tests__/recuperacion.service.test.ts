import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CrearEventoRecuperacionInputSchema,
  CrearEventoRecuperacionInput,
  ListarRecuperacionesQuerySchema,
  OperativoRecuperacionItem,
  RecuperacionDetalleResponseData,
} from "../recuperacion.schema";
import {
  crearEventoRecuperacionService,
  listarEventosRecuperacionService,
  obtenerDetalleRecuperacionService,
  PatrullaNoDisponibleError,
  StockInsuficienteError,
  NotFoundError,
} from "../recuperacion.service";
import * as repo from "../recuperacion.repository";
import type { KyselyTrx } from "../recuperacion.repository";
import { db } from "@/lib/db";
import * as socketModule from "@/lib/socket";
import * as authService from "@/modules/seguridad/auth.service";
import { ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Módulo Eventos ATP - Creación de Eventos de Recuperación (HU-29)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(repo, "registrarHitoMisionInicial").mockResolvedValue({} as any);
  });

  describe("1. Validación de Esquemas Zod", () => {
    const payloadValido: CrearEventoRecuperacionInput = {
      nombre: "Entrega de frazadas en Sector Collico",
      descripcion: "Familias afectadas por viento fuerte",
      sector: "Collico",
      direccionTexto: "Calle Los Robles 123",
      prioridad: "ALTA",
      contactoNombre: "Don Pedro",
      contactoTelefono: "+56999887766",
      latitud: -39.8142,
      longitud: -73.2459,
      delegacionId: "30000000-0000-4000-8000-000000000001",
      patrullaId: "50000000-0000-4000-8000-000000000001",
      familiasAfectadas: 5,
      recursos: [
        {
          recursoId: "00000000-0000-4000-8000-000000000001",
          cantidad: 10,
        },
      ],
    };

    it("debe validar correctamente un payload completo y válido", () => {
      const parsed = CrearEventoRecuperacionInputSchema.safeParse(payloadValido);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.nombre).toBe("Entrega de frazadas en Sector Collico");
        expect(parsed.data.recursos).toHaveLength(1);
        expect(parsed.data.recursos[0].cantidad).toBe(10);
      }
    });

    it("debe aplicar valores por defecto en prioridad y familias afectadas si se omiten", () => {
      const parcial = { ...payloadValido };
      delete (parcial as Partial<typeof payloadValido>).prioridad;
      delete (parcial as Partial<typeof payloadValido>).familiasAfectadas;

      const parsed = CrearEventoRecuperacionInputSchema.safeParse(parcial);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.prioridad).toBe("MEDIA");
        expect(parsed.data.familiasAfectadas).toBe(0);
      }
    });

    it("debe rechazar nombres demasiado cortos (< 3 caracteres)", () => {
      const invalid = { ...payloadValido, nombre: "ab" };
      const parsed = CrearEventoRecuperacionInputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar coordenadas fuera de rango", () => {
      const latInvalida = { ...payloadValido, latitud: 95 };
      expect(CrearEventoRecuperacionInputSchema.safeParse(latInvalida).success).toBe(false);

      const lngInvalida = { ...payloadValido, longitud: -190 };
      expect(CrearEventoRecuperacionInputSchema.safeParse(lngInvalida).success).toBe(false);
    });

    it("debe rechazar si la lista de recursos está vacía", () => {
      const sinRecursos = { ...payloadValido, recursos: [] };
      const parsed = CrearEventoRecuperacionInputSchema.safeParse(sinRecursos);
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar cantidades menores o iguales a cero en recursos", () => {
      const cantidadCero = {
        ...payloadValido,
        recursos: [{ recursoId: "00000000-0000-4000-8000-000000000001", cantidad: 0 }],
      };
      expect(CrearEventoRecuperacionInputSchema.safeParse(cantidadCero).success).toBe(false);

      const cantidadNegativa = {
        ...payloadValido,
        recursos: [{ recursoId: "00000000-0000-4000-8000-000000000001", cantidad: -5 }],
      };
      expect(CrearEventoRecuperacionInputSchema.safeParse(cantidadNegativa).success).toBe(false);
    });
  });

  describe("2. Reglas de Negocio en Servicio crearEventoRecuperacionService", () => {
    const usuarioId = "00000000-0000-4000-8000-000000000003"; // Encargado
    const inputValido: CrearEventoRecuperacionInput = {
      nombre: "Entrega de frazadas en Sector Collico",
      descripcion: "Familias damnificadas",
      sector: "Collico",
      direccionTexto: "Calle Los Robles 123",
      prioridad: "ALTA",
      contactoNombre: "Don Pedro",
      contactoTelefono: "+56999887766",
      latitud: -39.8142,
      longitud: -73.2459,
      delegacionId: "30000000-0000-4000-8000-000000000001",
      patrullaId: "50000000-0000-4000-8000-000000000001",
      familiasAfectadas: 3,
      recursos: [
        {
          recursoId: "80000000-0000-4000-8000-000000000001",
          cantidad: 15,
        },
      ],
    };

    it("debe crear el evento exitosamente, descontar inventario, cambiar estado de patrulla y emitir websocket", async () => {
      const mockTrx = {} as unknown as KyselyTrx;
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (callback) => callback(mockTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce({
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Verificadora Alfa",
        estado: "DISPONIBLE",
        delegacion_id: "30000000-0000-4000-8000-000000000001",
        usuario_lider_id: "00000000-0000-4000-8000-000000000004",
      });

      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          id: "80000000-0000-4000-8000-000000000001",
          nombre: "Frazadas Térmicas",
          cantidad_inventario: 50,
          cantidad_en_uso: 5,
          cantidad_minima: 10,
          estado: "DISPONIBLE",
          es_individual: false,
        },
      ]);

      vi.spyOn(repo, "generarSiguienteCodigoRecuperacion").mockResolvedValueOnce("REC-2026-0001");
      vi.spyOn(repo, "generarSiguienteCodigoMision").mockResolvedValueOnce("MIS-2026-0001");

      vi.spyOn(repo, "insertarRecuperacion").mockResolvedValueOnce({
        id: "70000000-0000-4000-8000-000000000001",
        codigo: "REC-2026-0001",
        nombre: inputValido.nombre,
        descripcion: inputValido.descripcion ?? null,
        sector: inputValido.sector,
        direccion_texto: inputValido.direccionTexto ?? null,
        prioridad: inputValido.prioridad,
        contacto_nombre: inputValido.contactoNombre ?? null,
        contacto_telefono: inputValido.contactoTelefono ?? null,
        latitud: inputValido.latitud,
        longitud: inputValido.longitud,
        ubicacion: null,
        estado: "PLANIFICADA",
        familias_afectadas: inputValido.familiasAfectadas,
        delegacion_id: inputValido.delegacionId ?? null,
        evento_atp_id: null,
        creado_por_id: usuarioId,
        fecha_cierre: null,
        observaciones_cierre: null,
        eliminado_en: null,
        creado_en: new Date("2026-10-04T12:00:00Z"),
        actualizado_en: new Date("2026-10-04T12:00:00Z"),
      });

      vi.spyOn(repo, "insertarMisionRecuperacion").mockResolvedValueOnce({
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0001",
        titulo: inputValido.nombre,
        descripcion: inputValido.descripcion ?? null,
        tipo_mision: "RECUPERACION",
        estado: "DESPACHADA",
        prioridad: inputValido.prioridad,
        justificacion_rechazo: null,
        incidente_id: null,
        prevencion_id: null,
        evento_prevencion_id: null,
        recuperacion_id: "70000000-0000-4000-8000-000000000001",
        cuadrilla_id: null,
        patrulla_id: inputValido.patrullaId,
        encargado_id: usuarioId,
        creado_por_id: usuarioId,
        fecha_inicio: new Date(),
        fecha_cierre: null,
        creado_en: new Date(),
        actualizado_en: new Date(),
      });

      const spyInsertarRecursos = vi.spyOn(repo, "insertarRecursosRecuperacion").mockResolvedValueOnce();
      const spyDescontarStock = vi.spyOn(repo, "descontarStockRecurso").mockResolvedValueOnce();
      const spyActualizarPatrulla = vi.spyOn(repo, "actualizarEstadoPatrulla").mockResolvedValueOnce({
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Norte",
        estado: "EN_RECUPERACION",
        delegacion_id: null,
        usuario_lider_id: null,
      });
      const spyActualizarLider = vi.spyOn(repo, "actualizarEstadoPersonalLider").mockResolvedValueOnce();
      const spyBuscarDelegacion = vi.spyOn(repo, "buscarDelegacionPorId").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        codigo: "DEL-SUR",
        codigo_delegacion: "DEL-SUR",
        nombre: "Delegación Sur",
        nombre_delegacion: "Delegación Sur",
      });
      const spyEmitirSocket = vi.spyOn(socketModule, "emitirRecuperacionCreada").mockImplementation(() => {});

      const resultado = await crearEventoRecuperacionService(inputValido, usuarioId);

      expect(resultado.codigo).toBe("REC-2026-0001");
      expect(resultado.mision.codigo).toBe("MIS-2026-0001");
      expect(resultado.patrulla.estado).toBe("EN_RECUPERACION");
      expect(resultado.recursos).toHaveLength(1);
      expect(resultado.recursos[0].cantidadAsignada).toBe(15);
      expect(resultado.delegacion?.codigo).toBe("DEL-SUR");

      expect(spyInsertarRecursos).toHaveBeenCalledWith(mockTrx, [
        {
          recuperacionId: "70000000-0000-4000-8000-000000000001",
          recursoId: "80000000-0000-4000-8000-000000000001",
          cantidad: 15,
        },
      ]);
      expect(spyDescontarStock).toHaveBeenCalledWith(mockTrx, "80000000-0000-4000-8000-000000000001", 15);
      expect(spyActualizarPatrulla).toHaveBeenCalledWith(mockTrx, inputValido.patrullaId, "EN_RECUPERACION");
      expect(spyActualizarLider).toHaveBeenCalledWith(mockTrx, "00000000-0000-4000-8000-000000000004", "en_mision");
      expect(spyBuscarDelegacion).toHaveBeenCalledWith(mockTrx, "30000000-0000-4000-8000-000000000001");
      expect(spyEmitirSocket).toHaveBeenCalledWith(resultado);
    });

    it("debe lanzar NotFoundError si la patrulla verificadora no existe", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce(undefined);

      await expect(crearEventoRecuperacionService(inputValido, usuarioId)).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar PatrullaNoDisponibleError si la patrulla se encuentra ocupada o en verificación", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce({
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Verificadora Alfa",
        estado: "EN_VERIFICACION",
        delegacion_id: null,
        usuario_lider_id: null,
      });

      await expect(crearEventoRecuperacionService(inputValido, usuarioId)).rejects.toThrow(
        PatrullaNoDisponibleError
      );
    });

    it("debe lanzar NotFoundError si algún recurso solicitado no existe en la base de datos", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce({
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Verificadora Alfa",
        estado: "DISPONIBLE",
        delegacion_id: null,
        usuario_lider_id: null,
      });

      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([]);

      await expect(crearEventoRecuperacionService(inputValido, usuarioId)).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar StockInsuficienteError si la cantidad solicitada supera el stock disponible (inventario - en_uso)", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce({
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Verificadora Alfa",
        estado: "DISPONIBLE",
        delegacion_id: null,
        usuario_lider_id: null,
      });

      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          id: "80000000-0000-4000-8000-000000000001",
          nombre: "Frazadas Térmicas",
          cantidad_inventario: 20,
          cantidad_en_uso: 10,
          cantidad_minima: 5,
          estado: "DISPONIBLE",
          es_individual: false,
        },
      ]);

      await expect(crearEventoRecuperacionService(inputValido, usuarioId)).rejects.toThrow(
        StockInsuficienteError
      );
    });

    it("debe sumarizar correctamente cuando el mismo recurso aparece múltiples veces en el payload", async () => {
      const mockTrx = {} as unknown as KyselyTrx;
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb(mockTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce({
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Verificadora Alfa",
        estado: "DISPONIBLE",
        delegacion_id: null,
        usuario_lider_id: null,
      });

      const inputConDuplicado: CrearEventoRecuperacionInput = {
        ...inputValido,
        recursos: [
          { recursoId: "80000000-0000-4000-8000-000000000001", cantidad: 6 },
          { recursoId: "80000000-0000-4000-8000-000000000001", cantidad: 6 },
        ],
      };

      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          id: "80000000-0000-4000-8000-000000000001",
          nombre: "Frazadas Térmicas",
          cantidad_inventario: 10,
          cantidad_en_uso: 0,
          cantidad_minima: 2,
          estado: "DISPONIBLE",
          es_individual: false,
        },
      ]);

      await expect(crearEventoRecuperacionService(inputConDuplicado, usuarioId)).rejects.toThrow(
        StockInsuficienteError
      );
    });
  });

  describe("3. Listado Paginado y Filtrable de Operativos (H73 - Zod y Servicio)", () => {
    const usuarioId = "00000000-0000-4000-8000-000000000003";

    it("debe aplicar valores de paginación por defecto en ListarRecuperacionesQuerySchema", () => {
      const parsed = ListarRecuperacionesQuerySchema.safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(1);
        expect(parsed.data.limit).toBe(20);
        expect(parsed.data.ordenarPor).toBe("creadoEn");
        expect(parsed.data.orden).toBe("desc");
      }
    });

    it("debe validar filtros multicriterio (delegación, estado, prioridad y búsqueda)", () => {
      const query = {
        page: "2",
        limit: "15",
        delegacionId: "30000000-0000-4000-8000-000000000001",
        estado: "EN_EJECUCION",
        prioridad: "CRITICA",
        busqueda: "Collico",
      };
      const parsed = ListarRecuperacionesQuerySchema.safeParse(query);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(2);
        expect(parsed.data.limit).toBe(15);
        expect(parsed.data.delegacionId).toBe("30000000-0000-4000-8000-000000000001");
        expect(parsed.data.estado).toBe("EN_EJECUCION");
        expect(parsed.data.prioridad).toBe("CRITICA");
        expect(parsed.data.busqueda).toBe("Collico");
      }
    });

    it("debe rechazar límites fuera de rango o UUIDs inválidos", () => {
      expect(ListarRecuperacionesQuerySchema.safeParse({ limit: 150 }).success).toBe(false);
      expect(ListarRecuperacionesQuerySchema.safeParse({ page: 0 }).success).toBe(false);
      expect(ListarRecuperacionesQuerySchema.safeParse({ delegacionId: "no-uuid" }).success).toBe(false);
    });

    it("debe listar operativos bajo estándar H34 e incluir desglose de insumos", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
        id: usuarioId,
        nombre: "Encargado de Operaciones",
        rol: "ENCARGADO",
      });

      const filasMock: OperativoRecuperacionItem[] = [
        {
          id: "70000000-0000-4000-8000-000000000001",
          codigo: "REC-2026-0001",
          nombre: "Entrega de frazadas en Collico",
          descripcion: "Temporal de viento",
          sector: "Collico",
          direccionTexto: "Calle Los Robles 123",
          prioridad: "ALTA",
          estado: "PLANIFICADA",
          familiasAfectadas: 4,
          delegacion: {
            id: "30000000-0000-4000-8000-000000000001",
            codigo: "DEL-SUR",
            nombre: "Delegación Municipal Sur",
          },
          cantidadInsumosAsignados: 15,
          totalTiposInsumos: 2,
          recursosResumen: [
            {
              recursoId: "80000000-0000-4000-8000-000000000001",
              nombre: "Frazadas Térmicas",
              cantidadAsignada: 10,
            },
            {
              recursoId: "80000000-0000-4000-8000-000000000002",
              nombre: "Sacos de Arena 25kg",
              cantidadAsignada: 5,
            },
          ],
          creadoEn: "2026-11-01T10:00:00.000Z",
          actualizadoEn: "2026-11-01T10:00:00.000Z",
          fechaCierre: null,
        },
      ];

      vi.spyOn(repo, "listarRecuperacionesPaginadoRepo").mockResolvedValueOnce({
        filas: filasMock,
        total: 1,
      });

      const respuesta = await listarEventosRecuperacionService({ page: 1, limit: 10 }, usuarioId);

      expect(respuesta.message).toContain("exitosamente");
      expect(respuesta.data).toHaveLength(1);
      expect(respuesta.data[0].codigo).toBe("REC-2026-0001");
      expect(respuesta.data[0].cantidadInsumosAsignados).toBe(15);
      expect(respuesta.data[0].totalTiposInsumos).toBe(2);
      expect(respuesta.data[0].recursosResumen).toHaveLength(2);
      expect(respuesta.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("debe retornar data vacía y total 0 si no hay operativos registrados", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
        id: usuarioId,
        nombre: "Encargado de Operaciones",
        rol: "ENCARGADO",
      });

      vi.spyOn(repo, "listarRecuperacionesPaginadoRepo").mockResolvedValueOnce({
        filas: [],
        total: 0,
      });

      const respuesta = await listarEventosRecuperacionService({ page: 1, limit: 20 }, usuarioId);

      expect(respuesta.data).toEqual([]);
      expect(respuesta.meta.total).toBe(0);
      expect(respuesta.meta.totalPages).toBe(0);
      expect(respuesta.meta.hasNext).toBe(false);
    });

    it("debe lanzar ForbiddenError si el usuario no tiene permiso recuperacion:leer", async () => {
      vi.spyOn(authService, "verificarPermiso").mockRejectedValue(
        new ForbiddenError("No cuenta con el permiso requerido: recuperacion:leer")
      );

      await expect(
        listarEventosRecuperacionService({ page: 1, limit: 10 }, usuarioId)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("4. Detalle de Operativo para Drawer (H73)", () => {
    const usuarioId = "00000000-0000-4000-8000-000000000003";
    const operativoId = "70000000-0000-4000-8000-000000000001";

    it("debe retornar el detalle exhaustivo con recursos e historial cronológico", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
        id: usuarioId,
        nombre: "Encargado de Operaciones",
        rol: "ENCARGADO",
      });

      const detalleMock: RecuperacionDetalleResponseData = {
        id: operativoId,
        codigo: "REC-2026-0001",
        nombre: "Entrega de frazadas en Collico",
        descripcion: "Damnificados por temporal",
        sector: "Collico",
        direccionTexto: "Calle Los Robles 123",
        prioridad: "ALTA",
        contactoNombre: "Don Pedro",
        contactoTelefono: "+56999887766",
        latitud: -39.8142,
        longitud: -73.2459,
        estado: "PLANIFICADA",
        familiasAfectadas: 4,
        delegacion: {
          id: "30000000-0000-4000-8000-000000000001",
          codigo: "DEL-SUR",
          nombre: "Delegación Municipal Sur",
        },
        creadoPor: {
          id: usuarioId,
          nombre: "Encargado de Operaciones",
        },
        mision: {
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0001",
          titulo: "Entrega de frazadas en Collico",
          estado: "DESPACHADA",
          tipoMision: "RECUPERACION",
        },
        patrulla: {
          id: "50000000-0000-4000-8000-000000000001",
          nombre: "Patrulla Verificadora Alfa",
          estado: "EN_RECUPERACION",
        },
        recursos: [
          {
            recursoId: "80000000-0000-4000-8000-000000000001",
            nombre: "Frazadas Térmicas",
            cantidadAsignada: 10,
          },
        ],
        recursosAsignados: [],
        misiones: [],
        cantidadInsumosAsignados: 10,
        totalTiposInsumos: 1,
        historial: [
          {
            id: `rec-creacion-${operativoId}`,
            tipo: "CREACION",
            titulo: "Operativo Planificado y Despachado",
            descripcion: "Damnificados por temporal",
            registradoPor: {
              id: usuarioId,
              nombre: "Encargado de Operaciones",
            },
            creadoEn: "2026-11-01T10:00:00.000Z",
          },
        ],
        creadoEn: "2026-11-01T10:00:00.000Z",
        actualizadoEn: "2026-11-01T10:00:00.000Z",
        fechaCierre: null,
        observacionesCierre: null,
      };

      vi.spyOn(repo, "obtenerRecuperacionDetallePorIdRepo").mockResolvedValueOnce(detalleMock);

      const detalle = await obtenerDetalleRecuperacionService(operativoId, usuarioId);

      expect(detalle.codigo).toBe("REC-2026-0001");
      expect(detalle.historial).toHaveLength(1);
      expect(detalle.historial[0].tipo).toBe("CREACION");
      expect(detalle.recursos).toHaveLength(1);
    });

    it("debe lanzar NotFoundError si el operativo no existe", async () => {
      vi.spyOn(authService, "verificarPermiso").mockResolvedValueOnce({
        id: usuarioId,
        nombre: "Encargado de Operaciones",
        rol: "ENCARGADO",
      });

      vi.spyOn(repo, "obtenerRecuperacionDetallePorIdRepo").mockResolvedValueOnce(null);

      await expect(obtenerDetalleRecuperacionService("70000000-0000-4000-8000-000000000099", usuarioId)).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
