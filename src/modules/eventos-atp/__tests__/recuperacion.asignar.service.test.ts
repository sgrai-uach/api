import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AsignarRecursosRecuperacionInputSchema,
  RecuperacionIdParamSchema,
  type AsignarRecursosRecuperacionInput,
} from "../recuperacion.schema";
import {
  asignarRecursosRecuperacionService,
  obtenerDetalleRecuperacionService,
  PatrullaNoDisponibleError,
  StockInsuficienteError,
  RecursoNoDisponibleError,
  BadRequestError,
  ConflictoEstadoError,
  NotFoundError,
} from "../recuperacion.service";
import * as repo from "../recuperacion.repository";
import type { KyselyTrx } from "../recuperacion.repository";
import { db } from "@/lib/db";
import * as socketModule from "@/lib/socket";

describe("Módulo Eventos ATP - Asignación de Recursos a Recuperación (HU-32)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Validación de Esquemas Zod", () => {
    const payloadValido: AsignarRecursosRecuperacionInput = {
      patrullaId: "50000000-0000-4000-8000-000000000001",
      recursos: [
        {
          recursoId: "80000000-0000-4000-8000-000000000001",
          cantidad: 10,
        },
        {
          recursoId: "80000000-0000-4000-8000-000000000002",
          cantidad: 1,
        },
      ],
    };

    it("debe validar un payload correcto de asignación", () => {
      const parsed = AsignarRecursosRecuperacionInputSchema.safeParse(payloadValido);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.patrullaId).toBe("50000000-0000-4000-8000-000000000001");
        expect(parsed.data.recursos).toHaveLength(2);
      }
    });

    it("debe rechazar un patrullaId que no sea UUID", () => {
      const invalido = { ...payloadValido, patrullaId: "id-invalido" };
      const parsed = AsignarRecursosRecuperacionInputSchema.safeParse(invalido);
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar si la lista de recursos está vacía", () => {
      const invalido = { ...payloadValido, recursos: [] };
      const parsed = AsignarRecursosRecuperacionInputSchema.safeParse(invalido);
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar recursos con cantidad menor a 1", () => {
      const invalido = {
        ...payloadValido,
        recursos: [{ recursoId: "80000000-0000-4000-8000-000000000001", cantidad: 0 }],
      };
      const parsed = AsignarRecursosRecuperacionInputSchema.safeParse(invalido);
      expect(parsed.success).toBe(false);
    });

    it("debe validar correctamente el esquema de parámetro UUID", () => {
      expect(
        RecuperacionIdParamSchema.safeParse({ id: "70000000-0000-4000-8000-000000000001" }).success
      ).toBe(true);
      expect(RecuperacionIdParamSchema.safeParse({ id: "no-es-uuid" }).success).toBe(false);
    });
  });

  describe("2. Servicio asignarRecursosRecuperacionService", () => {
    const recuperacionId = "70000000-0000-4000-8000-000000000001";
    const usuarioId = "00000000-0000-4000-8000-000000000002";
    const inputValido: AsignarRecursosRecuperacionInput = {
      patrullaId: "50000000-0000-4000-8000-000000000001",
      recursos: [
        {
          recursoId: "80000000-0000-4000-8000-000000000001", // A granel
          cantidad: 10,
        },
        {
          recursoId: "80000000-0000-4000-8000-000000000002", // Individual
          cantidad: 1,
        },
      ],
    };

    const mockEvento = {
      id: recuperacionId,
      codigo: "REC-2026-0001",
      nombre: "Entrega de frazadas en Collico",
      descripcion: "Afectados por temporal",
      sector: "Collico",
      direccion_texto: "Calle Uno 123",
      prioridad: "ALTA" as const,
      contacto_nombre: "Juan Perez",
      contacto_telefono: "+56912345678",
      latitud: -39.81,
      longitud: -73.24,
      estado: "PLANIFICADA" as const,
      familias_afectadas: 4,
      delegacion_id: "30000000-0000-4000-8000-000000000001",
      creado_por_id: usuarioId,
      creado_en: new Date("2026-10-04T12:00:00Z"),
      actualizado_en: new Date("2026-10-04T12:00:00Z"),
    };

    const mockPatrulla = {
      id: "50000000-0000-4000-8000-000000000001",
      nombre: "Patrulla Verificadora Alfa",
      estado: "DISPONIBLE" as const,
      delegacion_id: "30000000-0000-4000-8000-000000000001",
      usuario_lider_id: "00000000-0000-4000-8000-000000000004",
    };

    const mockRecursosBloqueados = [
      {
        id: "80000000-0000-4000-8000-000000000001",
        nombre: "Frazadas Térmicas",
        cantidad_inventario: 50,
        cantidad_en_uso: 5,
        cantidad_minima: 10,
        estado: "DISPONIBLE" as const,
        es_individual: false,
      },
      {
        id: "80000000-0000-4000-8000-000000000002",
        nombre: "Camioneta 4x4 Patrulla",
        cantidad_inventario: 1,
        cantidad_en_uso: 0,
        cantidad_minima: 0,
        estado: "DISPONIBLE" as const,
        es_individual: true,
      },
    ];

    it("debe asignar exitosamente recursos y patrulla, creando misión y emitiendo WebSockets", async () => {
      const mockTrx = {} as unknown as KyselyTrx;
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb(mockTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockEvento);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce(mockRecursosBloqueados);
      vi.spyOn(repo, "generarSiguienteCodigoMision").mockResolvedValueOnce("MIS-2026-0045");

      vi.spyOn(repo, "insertarMisionRecuperacion").mockResolvedValueOnce({
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0045",
        titulo: `Despacho operativo: ${mockEvento.nombre}`,
        descripcion: mockEvento.descripcion,
        tipo_mision: "RECUPERACION",
        estado: "DESPACHADA",
        prioridad: mockEvento.prioridad,
        justificacion_rechazo: null,
        incidente_id: null,
        prevencion_id: null,
        evento_prevencion_id: null,
        recuperacion_id: mockEvento.id,
        cuadrilla_id: null,
        patrulla_id: mockPatrulla.id,
        encargado_id: usuarioId,
        creado_por_id: usuarioId,
        fecha_inicio: new Date(),
        fecha_cierre: null,
        creado_en: new Date(),
        actualizado_en: new Date(),
      });

      const spyInsertarRecursosConMision = vi
        .spyOn(repo, "insertarRecursosRecuperacionConMision")
        .mockResolvedValueOnce();

      vi.spyOn(repo, "actualizarRecursoGranelUso").mockResolvedValueOnce({
        id: "80000000-0000-4000-8000-000000000001",
        nombre: "Frazadas Térmicas",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 50,
        cantidad_en_uso: 15,
        cantidad_minima: 10,
      });

      vi.spyOn(repo, "actualizarRecursoIndividualAsignado").mockResolvedValueOnce({
        id: "80000000-0000-4000-8000-000000000002",
        nombre: "Camioneta 4x4 Patrulla",
        es_individual: true,
        estado: "ASIGNADO",
        cantidad_inventario: 1,
        cantidad_en_uso: 1,
        cantidad_minima: 0,
      });

      const spyActualizarPatrulla = vi
        .spyOn(repo, "actualizarEstadoPatrulla")
        .mockResolvedValueOnce();
      const spyActualizarLider = vi
        .spyOn(repo, "actualizarEstadoPersonalLider")
        .mockResolvedValueOnce();

      const spyEmitirRecuperacion = vi
        .spyOn(socketModule, "emitirRecuperacionActualizada")
        .mockImplementation(() => {});
      const spyEmitirRecurso = vi
        .spyOn(socketModule, "emitirRecursoActualizado")
        .mockImplementation(() => {});
      const spyEmitirPatrulla = vi
        .spyOn(socketModule, "emitirPatrullaActualizada")
        .mockImplementation(() => {});

      const respuesta = await asignarRecursosRecuperacionService(
        recuperacionId,
        inputValido,
        usuarioId
      );

      expect(respuesta.evento.id).toBe(recuperacionId);
      expect(respuesta.mision.codigo).toBe("MIS-2026-0045");
      expect(respuesta.mision.tipoMision).toBe("RECUPERACION");
      expect(respuesta.patrulla.estado).toBe("EN_RECUPERACION");
      expect(respuesta.recursos).toHaveLength(2);
      expect(respuesta.recursos[0].cantidadEnUso).toBe(15);
      expect(respuesta.recursos[1].estadoRecurso).toBe("ASIGNADO");

      expect(spyInsertarRecursosConMision).toHaveBeenCalledWith(mockTrx, [
        {
          recuperacionId,
          recursoId: "80000000-0000-4000-8000-000000000001",
          misionId: "60000000-0000-4000-8000-000000000001",
          cantidad: 10,
        },
        {
          recuperacionId,
          recursoId: "80000000-0000-4000-8000-000000000002",
          misionId: "60000000-0000-4000-8000-000000000001",
          cantidad: 1,
        },
      ]);

      expect(spyActualizarPatrulla).toHaveBeenCalledWith(mockTrx, mockPatrulla.id, "EN_RECUPERACION");
      expect(spyActualizarLider).toHaveBeenCalledWith(mockTrx, mockPatrulla.usuario_lider_id, "en_mision");
      expect(spyEmitirRecuperacion).toHaveBeenCalled();
      expect(spyEmitirRecurso).toHaveBeenCalledTimes(2);
      expect(spyEmitirPatrulla).toHaveBeenCalled();
    });

    it("debe lanzar NotFoundError si el evento de recuperación no existe", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(undefined);

      await expect(
        asignarRecursosRecuperacionService(recuperacionId, inputValido, usuarioId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar ConflictoEstadoError si el evento ya está COMPLETADA o CANCELADA", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce({
        ...mockEvento,
        estado: "COMPLETADA",
      });

      await expect(
        asignarRecursosRecuperacionService(recuperacionId, inputValido, usuarioId)
      ).rejects.toThrow(ConflictoEstadoError);
    });

    it("debe lanzar PatrullaNoDisponibleError si la patrulla verificadora no está DISPONIBLE", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockEvento);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce({
        ...mockPatrulla,
        estado: "EN_VERIFICACION",
      });

      await expect(
        asignarRecursosRecuperacionService(recuperacionId, inputValido, usuarioId)
      ).rejects.toThrow(PatrullaNoDisponibleError);
    });

    it("debe lanzar NotFoundError si alguno de los recursos solicitados no existe", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockEvento);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce(mockPatrulla);
      // Retornar solo 1 recurso cuando se solicitaron 2
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([mockRecursosBloqueados[0]]);

      await expect(
        asignarRecursosRecuperacionService(recuperacionId, inputValido, usuarioId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar BadRequestError si se solicita cantidad > 1 para un activo individual", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockEvento);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([mockRecursosBloqueados[1]]);

      const inputCantidadExcesiva: AsignarRecursosRecuperacionInput = {
        patrullaId: mockPatrulla.id,
        recursos: [
          {
            recursoId: "80000000-0000-4000-8000-000000000002",
            cantidad: 2, // Invalido para recurso individual
          },
        ],
      };

      await expect(
        asignarRecursosRecuperacionService(recuperacionId, inputCantidadExcesiva, usuarioId)
      ).rejects.toThrow(BadRequestError);
    });

    it("debe lanzar RecursoNoDisponibleError si el activo individual está en EN_MANTENCION", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockEvento);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          ...mockRecursosBloqueados[1],
          estado: "EN_MANTENCION",
        },
      ]);

      const inputIndividual: AsignarRecursosRecuperacionInput = {
        patrullaId: mockPatrulla.id,
        recursos: [{ recursoId: "80000000-0000-4000-8000-000000000002", cantidad: 1 }],
      };

      await expect(
        asignarRecursosRecuperacionService(recuperacionId, inputIndividual, usuarioId)
      ).rejects.toThrow(RecursoNoDisponibleError);
    });

    it("debe lanzar RecursoNoDisponibleError si el activo individual ya está ASIGNADO", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockEvento);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          ...mockRecursosBloqueados[1],
          estado: "ASIGNADO",
        },
      ]);

      const inputIndividual: AsignarRecursosRecuperacionInput = {
        patrullaId: mockPatrulla.id,
        recursos: [{ recursoId: "80000000-0000-4000-8000-000000000002", cantidad: 1 }],
      };

      await expect(
        asignarRecursosRecuperacionService(recuperacionId, inputIndividual, usuarioId)
      ).rejects.toThrow(RecursoNoDisponibleError);
    });

    it("debe lanzar StockInsuficienteError si no hay stock suficiente para recurso a granel", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as unknown as KyselyTrx)),
      } as unknown as ReturnType<typeof db.transaction>);

      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(mockEvento);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          ...mockRecursosBloqueados[0],
          cantidad_inventario: 10,
          cantidad_en_uso: 8, // disponible: 2
        },
      ]);

      const inputSobregiro: AsignarRecursosRecuperacionInput = {
        patrullaId: mockPatrulla.id,
        recursos: [{ recursoId: "80000000-0000-4000-8000-000000000001", cantidad: 5 }],
      };

      await expect(
        asignarRecursosRecuperacionService(recuperacionId, inputSobregiro, usuarioId)
      ).rejects.toThrow(StockInsuficienteError);
    });
  });

  describe("3. Servicio obtenerDetalleRecuperacionService", () => {
    it("debe retornar el detalle estructurado del evento de recuperación", async () => {
      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce({
        id: "70000000-0000-4000-8000-000000000001",
        codigo: "REC-2026-0001",
        nombre: "Entrega de frazadas en Collico",
        descripcion: "Temporal de viento",
        sector: "Collico",
        direccion_texto: "Calle Uno 123",
        prioridad: "ALTA",
        contacto_nombre: "Don Pedro",
        contacto_telefono: "+56912345678",
        latitud: -39.8142,
        longitud: -73.2459,
        estado: "PLANIFICADA",
        familias_afectadas: 5,
        delegacion_id: "30000000-0000-4000-8000-000000000001",
        creado_por_id: "00000000-0000-4000-8000-000000000002",
        creado_en: new Date("2026-10-04T12:00:00Z"),
        actualizado_en: new Date("2026-10-04T12:00:00Z"),
      });

      vi.spyOn(repo, "buscarDelegacionPorId").mockResolvedValueOnce({
        id: "30000000-0000-4000-8000-000000000001",
        codigo: "DEL-SUR",
        codigo_delegacion: "DEL-SUR",
        nombre: "Delegación Sur",
        nombre_delegacion: "Delegación Sur",
      });

      vi.spyOn(repo, "buscarMisionesPorRecuperacionId").mockResolvedValueOnce([
        {
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0001",
          titulo: "Misión 1",
          estado: "DESPACHADA",
          tipo_mision: "RECUPERACION",
          creado_en: new Date("2026-10-04T12:30:00Z"),
          patrulla_id: "50000000-0000-4000-8000-000000000001",
          patrulla_nombre: "Patrulla Alfa",
          patrulla_estado: "EN_RECUPERACION",
        },
      ]);

      vi.spyOn(repo, "buscarRecursosAsignadosPorRecuperacionId").mockResolvedValueOnce([
        {
          id: "90000000-0000-4000-8000-000000000001",
          recurso_id: "80000000-0000-4000-8000-000000000001",
          cantidad_asignada: 10,
          mision_id: "60000000-0000-4000-8000-000000000001",
          creado_en: new Date("2026-10-04T12:30:00Z"),
          recurso_nombre: "Frazadas Térmicas",
          recurso_es_individual: false,
        },
      ]);

      const resultado = await obtenerDetalleRecuperacionService("70000000-0000-4000-8000-000000000001");
      expect(resultado.codigo).toBe("REC-2026-0001");
      expect(resultado.delegacion?.codigo).toBe("DEL-SUR");
      expect(resultado.misiones).toHaveLength(1);
      expect(resultado.recursosAsignados).toHaveLength(1);
      expect(resultado.recursosAsignados[0].misionId).toBe("60000000-0000-4000-8000-000000000001");
    });

    it("debe lanzar NotFoundError si el evento no existe", async () => {
      vi.spyOn(repo, "buscarRecuperacionPorId").mockResolvedValueOnce(undefined);
      await expect(
        obtenerDetalleRecuperacionService("70000000-0000-4000-8000-000000000001")
      ).rejects.toThrow(NotFoundError);
    });
  });
});
