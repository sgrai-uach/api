import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CrearEventoRecuperacionInputSchema,
  CrearEventoRecuperacionInput,
  EditarEventoRecuperacionInputSchema,
  ListarRecuperacionesQuerySchema,
  OperativoRecuperacionItem,
  RecuperacionDetalleResponse,
} from "../recuperacion.schema";
import {
  crearEventoRecuperacionService,
  editarEventoRecuperacionService,
  obtenerEventoRecuperacionPorIdService,
  listarRecuperacionesService,
  obtenerDetalleRecuperacionService,
  PatrullaNoDisponibleError,
  StockInsuficienteError,
  NotFoundError,
  RecuperacionNoEditableError,
  FechaEstimadaInvalidaError,
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
        fecha_estimada_fin: null,
        evento_atp_id: null,
        creado_por_id: usuarioId,
        actualizado_por_id: null,
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
      const spyDescontarStock = vi.spyOn(repo, "descontarStockRecurso").mockResolvedValueOnce({
        id: "80000000-0000-4000-8000-000000000001",
        nombre: "Frazadas Térmicas",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 35,
        cantidad_en_uso: 5,
        cantidad_minima: 10,
      });
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
      const spyEmitirSocket = vi.spyOn(socketModule, "emitirRecuperacionCreada").mockImplementation(() => { });

      const resultado = await crearEventoRecuperacionService(inputValido, usuarioId);

      expect(resultado.codigo).toBe("REC-2026-0001");
      expect(resultado.mision?.codigo).toBe("MIS-2026-0001");
      expect(resultado.patrulla?.estado).toBe("EN_RECUPERACION");
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

  describe("5. Edición de Planificación de Operativos de Recuperación (HU-74)", () => {
    const recuperacionId = "70000000-0000-4000-8000-000000000001";
    const usuarioId = "00000000-0000-4000-8000-000000000003";
    const recurso1Id = "80000000-0000-4000-8000-000000000001";
    const recurso2Id = "80000000-0000-4000-8000-000000000002";

    const mockRecuperacionBase = {
      id: recuperacionId,
      codigo: "REC-2026-0001",
      nombre: "Operativo Collico",
      descripcion: "Descripción inicial",
      sector: "Collico",
      direccion_texto: "Balmaceda 1245",
      prioridad: "ALTA" as const,
      contacto_nombre: "Juan Pérez",
      contacto_telefono: "+56912345678",
      latitud: -39.8142,
      longitud: -73.2459,
      ubicacion: null,
      estado: "EN_EJECUCION" as const,
      familias_afectadas: 4,
      delegacion_id: null,
      fecha_estimada_fin: null,
      evento_atp_id: null,
      fecha_cierre: null,
      observaciones_cierre: null,
      eliminado_en: null,
      creado_por_id: usuarioId,
      actualizado_por_id: null,
      creado_en: new Date("2026-11-10T10:00:00.000Z"),
      actualizado_en: new Date("2026-11-10T10:00:00.000Z"),
    };

    const mockTx = (mockTrx: KyselyTrx) => {
      vi.spyOn(db, "transaction").mockImplementation(
        () =>
          ({
            execute: async <T>(cb: (trx: KyselyTrx) => Promise<T>) => cb(mockTrx),
          }) as unknown as ReturnType<typeof db.transaction>
      );
    };

    it("debe rechazar un payload de edición completamente vacío en Zod", () => {
      const parsed = EditarEventoRecuperacionInputSchema.safeParse({});
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar con 404 (NotFoundError) si el operativo no existe", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(undefined);

      await expect(
        editarEventoRecuperacionService(
          recuperacionId,
          { descripcion: "Nueva descripción" },
          usuarioId
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("debe bloquear la edición con RecuperacionNoEditableError si el operativo está COMPLETADA", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce({
        ...mockRecuperacionBase,
        estado: "COMPLETADA",
      });

      await expect(
        editarEventoRecuperacionService(
          recuperacionId,
          { descripcion: "Intento de edición" },
          usuarioId
        )
      ).rejects.toThrow(RecuperacionNoEditableError);
    });

    it("debe bloquear la edición con RecuperacionNoEditableError si el operativo está CANCELADA", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce({
        ...mockRecuperacionBase,
        estado: "CANCELADA",
      });

      await expect(
        editarEventoRecuperacionService(
          recuperacionId,
          { descripcion: "Intento de edición" },
          usuarioId
        )
      ).rejects.toThrow(RecuperacionNoEditableError);
    });

    it("debe rechazar con FechaEstimadaInvalidaError si fechaEstimadaFin es anterior a creado_en", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockRecuperacionBase);

      await expect(
        editarEventoRecuperacionService(
          recuperacionId,
          { fechaEstimadaFin: "2026-11-01T10:00:00.000Z" },
          usuarioId
        )
      ).rejects.toThrow(FechaEstimadaInvalidaError);
    });

    it("debe editar descripción, fechaEstimadaFin, reasignar recursos con cálculo diferencial, sincronizar misión y emitir Socket.io", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockRecuperacionBase);
      vi.spyOn(repo, "buscarMisionPorRecuperacionId")
        .mockResolvedValueOnce({
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0042",
          titulo: "Operativo Collico",
          estado: "DESPACHADA",
          tipo_mision: "RECUPERACION",
          patrulla_id: "50000000-0000-4000-8000-000000000001",
        })
        .mockResolvedValueOnce({
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0042",
          titulo: "Operativo Collico",
          estado: "DESPACHADA",
          tipo_mision: "RECUPERACION",
          patrulla_id: "50000000-0000-4000-8000-000000000001",
        });
      vi.spyOn(repo, "listarRecursosAsignadosRecuperacion").mockResolvedValueOnce([
        {
          recursoId: recurso1Id,
          nombre: "Frazadas",
          esIndividual: false,
          cantidadAsignada: 10,
          misionId: "60000000-0000-4000-8000-000000000001",
        },
      ]);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          id: recurso1Id,
          nombre: "Frazadas",
          cantidad_inventario: 20,
          cantidad_en_uso: 0,
          cantidad_minima: 2,
          estado: "DISPONIBLE",
          es_individual: false,
        },
        {
          id: recurso2Id,
          nombre: "Kits Techumbre",
          cantidad_inventario: 15,
          cantidad_en_uso: 0,
          cantidad_minima: 2,
          estado: "DISPONIBLE",
          es_individual: false,
        },
      ]);

      const spyDevolver = vi.spyOn(repo, "devolverStockRecurso").mockResolvedValue({
        id: recurso1Id,
        nombre: "Frazadas",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 24,
        cantidad_en_uso: 0,
        cantidad_minima: 2,
      });
      const spyDescontar = vi.spyOn(repo, "descontarStockRecurso").mockResolvedValue({
        id: recurso2Id,
        nombre: "Kits Techumbre",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 10,
        cantidad_en_uso: 0,
        cantidad_minima: 2,
      });
      const spyEliminarRecs = vi
        .spyOn(repo, "eliminarRecursosRecuperacion")
        .mockResolvedValue(undefined);
      const spyInsertarRecs = vi
        .spyOn(repo, "insertarRecursosRecuperacion")
        .mockResolvedValue(undefined);

      const fechaNueva = "2026-11-20T18:00:00.000Z";
      const spyActualizar = vi.spyOn(repo, "actualizarRecuperacion").mockResolvedValueOnce({
        ...mockRecuperacionBase,
        descripcion: "Planificación ajustada",
        fecha_estimada_fin: new Date(fechaNueva),
        actualizado_por_id: usuarioId,
        actualizado_en: new Date("2026-11-18T12:00:00.000Z"),
      });
      const spySyncMision = vi
        .spyOn(repo, "sincronizarDescripcionMisionRecuperacion")
        .mockResolvedValueOnce(undefined);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce({
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Alfa",
        estado: "EN_RECUPERACION",
        delegacion_id: null,
        usuario_lider_id: null,
      });

      const spySocket = vi
        .spyOn(socketModule, "emitirRecuperacionActualizada")
        .mockImplementation(() => { });
      const spySocketRecurso = vi
        .spyOn(socketModule, "emitirRecursoActualizado")
        .mockImplementation(() => { });

      const resultado = await editarEventoRecuperacionService(
        recuperacionId,
        {
          descripcion: "Planificación ajustada",
          fechaEstimadaFin: fechaNueva,
          recursos: [
            { recursoId: recurso1Id, cantidad: 6 },
            { recursoId: recurso2Id, cantidad: 5 },
          ],
        },
        usuarioId
      );

      expect(spyDevolver).toHaveBeenCalledWith(mockTrx, recurso1Id, 4);
      expect(spyDescontar).toHaveBeenCalledWith(mockTrx, recurso2Id, 5);
      expect(spyEliminarRecs).toHaveBeenCalledWith(mockTrx, recuperacionId);
      expect(spyInsertarRecs).toHaveBeenCalledTimes(1);
      expect(spyActualizar).toHaveBeenCalledWith(
        mockTrx,
        recuperacionId,
        expect.objectContaining({
          descripcion: "Planificación ajustada",
          actualizadoPorId: usuarioId,
        })
      );
      expect(spySyncMision).toHaveBeenCalledWith(
        mockTrx,
        recuperacionId,
        "Planificación ajustada"
      );
      expect(resultado.actualizadoPorId).toBe(usuarioId);
      expect(resultado.fechaEstimadaFin).toBe(fechaNueva);
      expect(resultado.recursos).toHaveLength(2);
      expect(spySocket).toHaveBeenCalledTimes(1);
      expect(spySocketRecurso).toHaveBeenCalledTimes(2);
    });

    it("debe rechazar con StockInsuficienteError si el incremento de recurso supera el stock disponible", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockRecuperacionBase);
      vi.spyOn(repo, "buscarMisionPorRecuperacionId")
        .mockResolvedValueOnce({
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0042",
          titulo: "Operativo Collico",
          estado: "DESPACHADA",
          tipo_mision: "RECUPERACION",
          patrulla_id: "50000000-0000-4000-8000-000000000001",
        })
        .mockResolvedValueOnce({
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0042",
          titulo: "Operativo Collico",
          estado: "DESPACHADA",
          tipo_mision: "RECUPERACION",
          patrulla_id: "50000000-0000-4000-8000-000000000001",
        });
      vi.spyOn(repo, "listarRecursosAsignadosRecuperacion").mockResolvedValueOnce([
        {
          recursoId: recurso1Id,
          nombre: "Frazadas",
          esIndividual: false,
          cantidadAsignada: 10,
          misionId: "60000000-0000-4000-8000-000000000001",
        },
      ]);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          id: recurso1Id,
          nombre: "Frazadas",
          cantidad_inventario: 3,
          cantidad_en_uso: 0,
          cantidad_minima: 1,
          estado: "DISPONIBLE",
          es_individual: false,
        },
      ]);

      await expect(
        editarEventoRecuperacionService(
          recuperacionId,
          { recursos: [{ recursoId: recurso1Id, cantidad: 15 }] },
          usuarioId
        )
      ).rejects.toThrow(StockInsuficienteError);
    });

    it("debe rechazar con StockInsuficienteError (409) si se intenta asignar un recurso en estado EN_MANTENCION", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockRecuperacionBase);
      vi.spyOn(repo, "buscarMisionPorRecuperacionId").mockResolvedValueOnce(undefined);
      vi.spyOn(repo, "listarRecursosAsignadosRecuperacion").mockResolvedValueOnce([]);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          id: recurso1Id,
          nombre: "Generador Eléctrico",
          cantidad_inventario: 1,
          cantidad_en_uso: 0,
          cantidad_minima: 0,
          estado: "EN_MANTENCION",
          es_individual: true,
        },
      ]);

      await expect(
        editarEventoRecuperacionService(
          recuperacionId,
          { recursos: [{ recursoId: recurso1Id, cantidad: 1 }] },
          usuarioId
        )
      ).rejects.toThrow(StockInsuficienteError);
    });

    it("debe reasignar patrulla verificadora liberando la anterior, registrar hito y emitir Socket.io", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      const patrullaAnteriorId = "50000000-0000-4000-8000-000000000001";
      const patrullaNuevaId = "50000000-0000-4000-8000-000000000002";
      const liderAnteriorId = "00000000-0000-4000-8000-000000000010";
      const liderNuevoId = "00000000-0000-4000-8000-000000000011";
      const misionId = "60000000-0000-4000-8000-000000000001";

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockRecuperacionBase);
      vi.spyOn(repo, "listarRecursosAsignadosRecuperacion").mockResolvedValueOnce([]);
      vi.spyOn(repo, "buscarMisionPorRecuperacionId")
        .mockResolvedValueOnce({
          id: misionId,
          codigo: "MIS-2026-0042",
          titulo: "Operativo Collico",
          estado: "EN_CURSO",
          tipo_mision: "RECUPERACION",
          patrulla_id: patrullaAnteriorId,
        })
        .mockResolvedValueOnce({
          id: misionId,
          codigo: "MIS-2026-0042",
          titulo: "Operativo Collico",
          estado: "DESPACHADA",
          tipo_mision: "RECUPERACION",
          patrulla_id: patrullaNuevaId,
        });

      vi.spyOn(repo, "buscarPatrullaPorId")
        .mockResolvedValueOnce({
          id: patrullaNuevaId,
          nombre: "Patrulla Beta",
          estado: "DISPONIBLE",
          delegacion_id: null,
          usuario_lider_id: liderNuevoId,
        })
        .mockResolvedValueOnce({
          id: patrullaNuevaId,
          nombre: "Patrulla Beta",
          estado: "EN_RECUPERACION",
          delegacion_id: null,
          usuario_lider_id: liderNuevoId,
        });

      vi.spyOn(repo, "contarOtrasMisionesActivasPatrulla").mockResolvedValueOnce(0);
      vi.spyOn(repo, "contarOtrasAsignacionesActivasUsuario").mockResolvedValueOnce(0);
      vi.spyOn(repo, "listarIntegrantesPatrullaIds").mockResolvedValue([]);
      const spyEstadoPatrulla = vi
        .spyOn(repo, "actualizarEstadoPatrulla")
        .mockResolvedValueOnce({
          id: patrullaNuevaId,
          nombre: "Patrulla Beta",
          estado: "EN_RECUPERACION",
          delegacion_id: null,
          usuario_lider_id: liderNuevoId,
        });
      const spyLiberarPatrulla = vi
        .spyOn(repo, "liberarPatrullaOperativo")
        .mockResolvedValueOnce({
          id: patrullaAnteriorId,
          nombre: "Patrulla Alfa",
          estado: "DISPONIBLE",
          delegacion_id: null,
          usuario_lider_id: liderAnteriorId,
        });
      const spyEstadoLider = vi
        .spyOn(repo, "actualizarEstadoPersonalLider")
        .mockResolvedValue(undefined);
      const spyReasignarMision = vi
        .spyOn(repo, "reasignarPatrullaMision")
        .mockResolvedValueOnce({
          id: misionId,
          codigo: "MIS-2026-0042",
          titulo: "Operativo Collico",
          estado: "DESPACHADA",
          tipo_mision: "RECUPERACION",
          patrulla_id: patrullaNuevaId,
        } as unknown as Awaited<ReturnType<typeof repo.reasignarPatrullaMision>>);
      const spyHito = vi
        .spyOn(repo, "registrarHitoReasignacionMision")
        .mockResolvedValueOnce(undefined);
      const spyNotif = vi
        .spyOn(repo, "insertarNotificacionMisionRecuperacion")
        .mockResolvedValueOnce({ id: "notif-1" });
      vi.spyOn(repo, "actualizarRecuperacion").mockResolvedValueOnce({
        ...mockRecuperacionBase,
        actualizado_por_id: usuarioId,
        actualizado_en: new Date("2026-11-18T12:00:00.000Z"),
      });

      const spySocketRec = vi
        .spyOn(socketModule, "emitirRecuperacionActualizada")
        .mockImplementation(() => { });
      const spySocketPatrulla = vi
        .spyOn(socketModule, "emitirPatrullaActualizada")
        .mockImplementation(() => { });
      const spySocketAsignada = vi
        .spyOn(socketModule, "notificarMisionAsignada")
        .mockImplementation(() => { });
      const spySocketLiberada = vi
        .spyOn(socketModule, "emitirPatrullaLiberadaDeOperativo")
        .mockImplementation(() => { });

      const resultado = await editarEventoRecuperacionService(
        recuperacionId,
        { patrullaId: patrullaNuevaId },
        usuarioId
      );

      expect(spyLiberarPatrulla).toHaveBeenCalledWith(mockTrx, patrullaAnteriorId);
      expect(spyEstadoLider).toHaveBeenCalledWith(mockTrx, liderAnteriorId, "disponible");
      expect(spyReasignarMision).toHaveBeenCalledWith(mockTrx, misionId, patrullaNuevaId);
      expect(spyHito).toHaveBeenCalledTimes(1);
      expect(spyNotif).toHaveBeenCalledWith(mockTrx, misionId, patrullaNuevaId);
      expect(spyEstadoPatrulla).toHaveBeenCalledWith(mockTrx, patrullaNuevaId, "EN_RECUPERACION");
      expect(spyEstadoLider).toHaveBeenCalledWith(mockTrx, liderNuevoId, "en_mision");
      expect(resultado.patrulla?.id).toBe(patrullaNuevaId);
      expect(spySocketRec).toHaveBeenCalledTimes(1);
      expect(spySocketPatrulla).toHaveBeenCalledTimes(2);
      expect(spySocketAsignada).toHaveBeenCalledWith(
        expect.objectContaining({ misionId, patrullaId: patrullaNuevaId, notificacionId: "notif-1" })
      );
      expect(spySocketLiberada).toHaveBeenCalledWith(
        expect.objectContaining({ patrullaAnteriorId, patrullaNuevaId })
      );
    });

    it("debe crear misión táctica si se asigna patrulla a un operativo sin misión previa (BUG-H74-API-02)", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      const patrullaNuevaId = "50000000-0000-4000-8000-000000000002";
      const misionCreadaId = "60000000-0000-4000-8000-000000000099";

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce({
        ...mockRecuperacionBase,
        estado: "PLANIFICADA",
      });
      vi.spyOn(repo, "buscarMisionPorRecuperacionId")
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: misionCreadaId,
          codigo: "MIS-2026-0099",
          titulo: "Operativo Collico",
          estado: "DESPACHADA",
          tipo_mision: "RECUPERACION",
          patrulla_id: patrullaNuevaId,
        });
      vi.spyOn(repo, "listarRecursosAsignadosRecuperacion").mockResolvedValueOnce([]);
      vi.spyOn(repo, "buscarPatrullaPorId")
        .mockResolvedValueOnce({
          id: patrullaNuevaId,
          nombre: "Patrulla Beta",
          estado: "DISPONIBLE",
          delegacion_id: null,
          usuario_lider_id: null,
        })
        .mockResolvedValueOnce({
          id: patrullaNuevaId,
          nombre: "Patrulla Beta",
          estado: "EN_RECUPERACION",
          delegacion_id: null,
          usuario_lider_id: null,
        });
      vi.spyOn(repo, "actualizarEstadoPatrulla").mockResolvedValueOnce({
        id: patrullaNuevaId,
        nombre: "Patrulla Beta",
        estado: "EN_RECUPERACION",
        delegacion_id: null,
        usuario_lider_id: null,
      });
      vi.spyOn(repo, "generarSiguienteCodigoMision").mockResolvedValueOnce("MIS-2026-0099");
      const spyInsertarMision = vi
        .spyOn(repo, "insertarMisionRecuperacion")
        .mockResolvedValueOnce({
          id: misionCreadaId,
          codigo: "MIS-2026-0099",
          titulo: "Operativo Collico",
          estado: "DESPACHADA",
          tipo_mision: "RECUPERACION",
        } as unknown as Awaited<ReturnType<typeof repo.insertarMisionRecuperacion>>);
      const spyHitoInicial = vi
        .spyOn(repo, "registrarHitoMisionInicial")
        .mockResolvedValueOnce({} as Awaited<ReturnType<typeof repo.registrarHitoMisionInicial>>);
      vi.spyOn(repo, "listarIntegrantesPatrullaIds").mockResolvedValueOnce([]);
      vi.spyOn(repo, "insertarNotificacionMisionRecuperacion").mockResolvedValueOnce({ id: "n-99" });
      vi.spyOn(repo, "actualizarRecuperacion").mockResolvedValueOnce(mockRecuperacionBase);

      vi.spyOn(socketModule, "emitirRecuperacionActualizada").mockImplementation(() => { });
      vi.spyOn(socketModule, "emitirPatrullaActualizada").mockImplementation(() => { });
      vi.spyOn(socketModule, "notificarMisionAsignada").mockImplementation(() => { });

      const resultado = await editarEventoRecuperacionService(
        recuperacionId,
        { patrullaId: patrullaNuevaId },
        usuarioId
      );

      expect(spyInsertarMision).toHaveBeenCalledTimes(1);
      expect(spyHitoInicial).toHaveBeenCalledTimes(1);
      expect(resultado.mision?.id).toBe(misionCreadaId);
      expect(resultado.patrulla?.id).toBe(patrullaNuevaId);
    });

    it("debe rechazar con PatrullaNoDisponibleError (409) si la nueva patrulla no está DISPONIBLE", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      const patrullaOcupadaId = "50000000-0000-4000-8000-000000000009";
      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockRecuperacionBase);
      vi.spyOn(repo, "listarRecursosAsignadosRecuperacion").mockResolvedValueOnce([]);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce({
        id: patrullaOcupadaId,
        nombre: "Patrulla Ocupada",
        estado: "EN_VERIFICACION",
        delegacion_id: null,
        usuario_lider_id: null,
      });
      vi.spyOn(repo, "buscarMisionPorRecuperacionId").mockResolvedValueOnce({
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0042",
        titulo: "Operativo Collico",
        estado: "DESPACHADA",
        tipo_mision: "RECUPERACION",
        patrulla_id: "50000000-0000-4000-8000-000000000001",
      });

      await expect(
        editarEventoRecuperacionService(
          recuperacionId,
          { patrullaId: patrullaOcupadaId },
          usuarioId
        )
      ).rejects.toThrow(PatrullaNoDisponibleError);
    });

    it("debe rechazar con NotFoundError (404) si la nueva patrulla indicada no existe", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockRecuperacionBase);
      vi.spyOn(repo, "buscarMisionPorRecuperacionId").mockResolvedValueOnce(undefined);
      vi.spyOn(repo, "listarRecursosAsignadosRecuperacion").mockResolvedValueOnce([]);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce(undefined);

      await expect(
        editarEventoRecuperacionService(
          recuperacionId,
          { patrullaId: "50000000-0000-4000-8000-000000000099" },
          usuarioId
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("debe obtener el detalle completo del operativo vía obtenerEventoRecuperacionPorIdService", async () => {
      const mockTrx = {} as KyselyTrx;
      mockTx(mockTrx);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce({
        ...mockRecuperacionBase,
        fecha_estimada_fin: new Date("2026-11-22T18:00:00.000Z"),
      });
      vi.spyOn(repo, "listarRecursosAsignadosRecuperacion").mockResolvedValueOnce([
        {
          recursoId: recurso1Id,
          nombre: "Frazadas",
          esIndividual: false,
          cantidadAsignada: 5,
          misionId: null,
        },
      ]);
      vi.spyOn(repo, "buscarMisionPorRecuperacionId").mockResolvedValueOnce({
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0042",
        titulo: "Operativo Collico",
        estado: "DESPACHADA",
        tipo_mision: "RECUPERACION",
        patrulla_id: "50000000-0000-4000-8000-000000000001",
      });
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce({
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Alfa",
        estado: "EN_RECUPERACION",
        delegacion_id: null,
        usuario_lider_id: null,
      });

      const detalle = await obtenerEventoRecuperacionPorIdService(recuperacionId);
      expect(detalle.id).toBe(recuperacionId);
      expect(detalle.fechaEstimadaFin).toBe("2026-11-22T18:00:00.000Z");
      expect(detalle.patrulla?.nombre).toBe("Patrulla Alfa");
      expect(detalle.recursos).toHaveLength(1);
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

      const respuesta = await listarRecuperacionesService({ page: 1, limit: 10 }, usuarioId);

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

      const respuesta = await listarRecuperacionesService({ page: 1, limit: 20 }, usuarioId);

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
        listarRecuperacionesService({ page: 1, limit: 10 }, usuarioId)
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

      const detalleMock: RecuperacionDetalleResponse = {
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
