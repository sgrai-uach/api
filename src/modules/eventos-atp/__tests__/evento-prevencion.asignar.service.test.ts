/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AsignarRecursosPrevencionInputSchema,
  EventoPrevencionIdParamSchema,
  type AsignarRecursosPrevencionInput,
} from "../evento-prevencion.schema";
import {
  asignarRecursosPrevencionService,
  obtenerDetalleEventoPrevencionService,
  PatrullaNoDisponibleError,
  StockInsuficienteError,
  RecursoNoDisponibleError,
  BadRequestError,
  ConflictoEstadoError,
  NotFoundError,
} from "../evento-prevencion.service";
import * as repo from "../evento-prevencion.repository";
import type { Trx } from "../evento-prevencion.repository";
import * as notificacionRepo from "@/modules/misiones/notificacion-mision.repository";
import { db } from "@/lib/db";
import * as socketModule from "@/lib/socket";

describe("Módulo Eventos ATP - Asignación de Recursos a Prevención (HU-33)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Validación de Esquemas Zod", () => {
    const payloadValido: AsignarRecursosPrevencionInput = {
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

    it("debe validar un payload correcto de asignación preventiva", () => {
      const parsed = AsignarRecursosPrevencionInputSchema.safeParse(payloadValido);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.patrullaId).toBe("50000000-0000-4000-8000-000000000001");
        expect(parsed.data.recursos).toHaveLength(2);
      }
    });

    it("debe rechazar un patrullaId que no sea UUID válido", () => {
      const parsed = AsignarRecursosPrevencionInputSchema.safeParse({
        ...payloadValido,
        patrullaId: "patrulla-invalida",
      });
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar si el arreglo recursos está vacío", () => {
      const parsed = AsignarRecursosPrevencionInputSchema.safeParse({
        ...payloadValido,
        recursos: [],
      });
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar cantidades de recursos menores a 1", () => {
      const parsed = AsignarRecursosPrevencionInputSchema.safeParse({
        ...payloadValido,
        recursos: [
          {
            recursoId: "80000000-0000-4000-8000-000000000001",
            cantidad: 0,
          },
        ],
      });
      expect(parsed.success).toBe(false);
    });

    it("debe validar correctamente el esquema de parámetro UUID de evento", () => {
      expect(
        EventoPrevencionIdParamSchema.safeParse({
          id: "80000000-0000-4000-8000-000000000001",
        }).success
      ).toBe(true);
      expect(EventoPrevencionIdParamSchema.safeParse({ id: "no-uuid" }).success).toBe(false);
    });
  });

  describe("2. Servicio asignarRecursosPrevencionService", () => {
    const eventoId = "80000000-0000-4000-8000-000000000010";
    const usuarioId = "00000000-0000-4000-8000-000000000003";
    const recursoGranelId = "80000000-0000-4000-8000-000000000001";
    const recursoIndividualId = "80000000-0000-4000-8000-000000000002";

    const inputValido: AsignarRecursosPrevencionInput = {
      patrullaId: "50000000-0000-4000-8000-000000000001",
      recursos: [
        { recursoId: recursoGranelId, cantidad: 10 },
        { recursoId: recursoIndividualId, cantidad: 1 },
      ],
    };

    const mockEvento = {
      id: eventoId,
      codigo: "PREV-2026-0001",
      nombre: "Limpieza preventiva de colectores en Angachilla",
      descripcion: "Despeje preventivo y sacos de arena en punto crítico",
      prioridad: "ALTA" as const,
      estado: "PLANIFICADA",
      sector: "Humedal Angachilla",
      direccion_texto: "Pasaje Los Robles s/n",
      punto_critico_id: "40000000-0000-4000-8000-000000000001",
      delegacion_id: "30000000-0000-4000-8000-000000000002",
      latitud: -39.8456,
      longitud: -73.2389,
      fecha_estimada_fin: null,
      activo: true,
      eliminado_en: null,
      creado_por_id: usuarioId,
      actualizado_por_id: null,
      creado_en: new Date("2026-11-19T10:00:00Z"),
      actualizado_en: new Date("2026-11-19T10:00:00Z"),
    };

    const mockPatrulla = {
      id: "50000000-0000-4000-8000-000000000001",
      nombre: "Patrulla Sur 1",
      estado: "DISPONIBLE" as const,
      delegacion_id: "30000000-0000-4000-8000-000000000002",
      usuario_lider_id: "00000000-0000-4000-8000-000000000004",
    };

    const mockRecursosBloqueados = [
      {
        id: recursoGranelId,
        nombre: "Sacos de Arena 25kg",
        cantidad_inventario: 50,
        cantidad_en_uso: 5,
        cantidad_minima: 10,
        estado: "DISPONIBLE" as const,
        es_individual: false,
        eliminado_en: null,
      },
      {
        id: recursoIndividualId,
        nombre: "Motobomba 4 pulgadas",
        cantidad_inventario: 1,
        cantidad_en_uso: 0,
        cantidad_minima: 0,
        estado: "DISPONIBLE" as const,
        es_individual: true,
        eliminado_en: null,
      },
    ];

    it("debe asignar patrulla y recursos, crear misión PREVENCION, actualizar stock en uso y emitir WebSockets", async () => {
      const mockTrx = {} as unknown as Trx;
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb(mockTrx)),
      } as any);

      const spyBuscarEvento = vi
        .spyOn(repo, "buscarEventoPrevencionParaEdicion")
        .mockResolvedValueOnce(mockEvento as any);
      const spyBuscarPatrulla = vi
        .spyOn(repo, "buscarPatrullaParaBloqueo")
        .mockResolvedValueOnce(mockPatrulla);
      const spyBloquearRecursos = vi
        .spyOn(repo, "obtenerRecursosParaBloqueo")
        .mockResolvedValueOnce(mockRecursosBloqueados as any);
      vi.spyOn(repo, "generarSiguienteCodigoMision").mockResolvedValueOnce("MIS-2026-0099");

      const spyInsertarMision = vi
        .spyOn(repo, "insertarMisionPrevencion")
        .mockResolvedValueOnce({
          id: "60000000-0000-4000-8000-000000000099",
          codigo: "MIS-2026-0099",
          titulo: `Despacho preventivo: ${mockEvento.nombre}`,
          estado: "DESPACHADA",
          tipo_mision: "PREVENCION",
        });

      const spyInsertarRecursosConMision = vi
        .spyOn(repo, "insertarRecursosPrevencionConMision")
        .mockResolvedValueOnce(undefined as any);

      vi.spyOn(repo, "actualizarRecursoGranelUso").mockResolvedValueOnce({
        id: recursoGranelId,
        nombre: "Sacos de Arena 25kg",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 50,
        cantidad_en_uso: 15,
        cantidad_minima: 10,
      });

      vi.spyOn(repo, "actualizarRecursoIndividualAsignado").mockResolvedValueOnce({
        id: recursoIndividualId,
        nombre: "Motobomba 4 pulgadas",
        es_individual: true,
        estado: "ASIGNADO",
        cantidad_inventario: 1,
        cantidad_en_uso: 1,
        cantidad_minima: 0,
      });

      const spyActualizarPatrulla = vi
        .spyOn(repo, "actualizarEstadoPatrulla")
        .mockResolvedValueOnce([] as any);
      const spyActualizarLider = vi
        .spyOn(repo, "actualizarEstadoPersonalLider")
        .mockResolvedValueOnce(undefined);
      const spyActualizarEventoEnCurso = vi
        .spyOn(repo, "actualizarEstadoEventoPrevencionEnCurso")
        .mockResolvedValueOnce([] as any);
      vi.spyOn(repo, "marcarActualizacionEventoPrevencion").mockResolvedValueOnce([] as any);
      vi.spyOn(repo, "insertarHitoDespachoMisionPrevencion").mockResolvedValueOnce([] as any);
      vi.spyOn(notificacionRepo, "crearNotificacionMisionRepo").mockResolvedValueOnce({} as any);

      const spyEmitirPrevencion = vi
        .spyOn(socketModule, "emitirEventoPrevencionActualizado")
        .mockImplementation(() => {});
      const spyEmitirRecurso = vi
        .spyOn(socketModule, "emitirRecursoActualizado")
        .mockImplementation(() => {});
      const spyEmitirPatrulla = vi
        .spyOn(socketModule, "notificarPatrullaActualizada")
        .mockImplementation(() => {});

      const resultado = await asignarRecursosPrevencionService(eventoId, inputValido, usuarioId);

      expect(spyBuscarEvento).toHaveBeenCalledWith(mockTrx, eventoId);
      expect(spyBuscarPatrulla).toHaveBeenCalledWith(mockTrx, inputValido.patrullaId);
      expect(spyBloquearRecursos).toHaveBeenCalledWith(mockTrx, [
        recursoGranelId,
        recursoIndividualId,
      ]);

      expect(spyInsertarMision).toHaveBeenCalledWith(mockTrx, {
        codigo: "MIS-2026-0099",
        titulo: `Despacho preventivo: ${mockEvento.nombre}`,
        descripcion: mockEvento.descripcion,
        prioridad: "ALTA",
        eventoPrevencionId: eventoId,
        puntoCriticoId: mockEvento.punto_critico_id,
        patrullaId: mockPatrulla.id,
        encargadoId: usuarioId,
        creadoPorId: usuarioId,
      });

      expect(spyInsertarRecursosConMision).toHaveBeenCalledWith(mockTrx, [
        {
          eventoPrevencionId: eventoId,
          recursoId: recursoGranelId,
          misionId: "60000000-0000-4000-8000-000000000099",
          cantidad: 10,
        },
        {
          eventoPrevencionId: eventoId,
          recursoId: recursoIndividualId,
          misionId: "60000000-0000-4000-8000-000000000099",
          cantidad: 1,
        },
      ]);

      expect(spyActualizarPatrulla).toHaveBeenCalledWith(
        mockTrx,
        mockPatrulla.id,
        "EN_PREVENCION"
      );
      expect(spyActualizarLider).toHaveBeenCalledWith(
        mockTrx,
        mockPatrulla.usuario_lider_id,
        "en_mision"
      );
      expect(spyActualizarEventoEnCurso).toHaveBeenCalledWith(mockTrx, eventoId, usuarioId);

      expect(resultado.evento.id).toBe(eventoId);
      expect(resultado.mision.tipoMision).toBe("PREVENCION");
      expect(resultado.patrulla.estado).toBe("EN_PREVENCION");
      expect(resultado.recursos).toHaveLength(2);
      expect(resultado.recursos[0].cantidadEnUso).toBe(15);
      expect(resultado.recursos[1].estadoRecurso).toBe("ASIGNADO");

      expect(spyEmitirPrevencion).toHaveBeenCalledWith(
        expect.objectContaining({
          id: eventoId,
          codigo: "PREV-2026-0001",
          patrulla: expect.objectContaining({ estado: "EN_PREVENCION" }),
        })
      );
      expect(spyEmitirRecurso).toHaveBeenCalledTimes(2);
      expect(spyEmitirPatrulla).toHaveBeenCalledWith(
        expect.objectContaining({
          patrullaId: mockPatrulla.id,
          estado: "EN_PREVENCION",
          misionActivaId: "60000000-0000-4000-8000-000000000099",
        })
      );
    });

    it("debe consolidar recursos duplicados en el payload y rechazar si el acumulado supera el stock disponible", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce(mockEvento as any);
      vi.spyOn(repo, "buscarPatrullaParaBloqueo").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          ...mockRecursosBloqueados[0],
          cantidad_inventario: 15,
          cantidad_en_uso: 5, // disponible: 10
        },
      ] as any);

      await expect(
        asignarRecursosPrevencionService(
          eventoId,
          {
            patrullaId: mockPatrulla.id,
            recursos: [
              { recursoId: recursoGranelId, cantidad: 6 },
              { recursoId: recursoGranelId, cantidad: 6 }, // acumulado: 12 > 10
            ],
          },
          usuarioId
        )
      ).rejects.toThrow(StockInsuficienteError);
    });

    it("debe lanzar NotFoundError si el evento de prevención no existe o fue eliminado", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce(undefined);

      await expect(
        asignarRecursosPrevencionService(eventoId, inputValido, usuarioId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar ConflictoEstadoError si el evento está inactivo, COMPLETADA o CANCELADA", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce({
        ...mockEvento,
        estado: "COMPLETADA",
      } as any);

      await expect(
        asignarRecursosPrevencionService(eventoId, inputValido, usuarioId)
      ).rejects.toThrow(ConflictoEstadoError);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce({
        ...mockEvento,
        activo: false,
      } as any);

      await expect(
        asignarRecursosPrevencionService(eventoId, inputValido, usuarioId)
      ).rejects.toThrow(ConflictoEstadoError);
    });

    it("debe lanzar NotFoundError si la patrulla verificadora no existe", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce(mockEvento as any);
      vi.spyOn(repo, "buscarPatrullaParaBloqueo").mockResolvedValueOnce(undefined);

      await expect(
        asignarRecursosPrevencionService(eventoId, inputValido, usuarioId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar PatrullaNoDisponibleError si la patrulla no está DISPONIBLE", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce(mockEvento as any);
      vi.spyOn(repo, "buscarPatrullaParaBloqueo").mockResolvedValueOnce({
        ...mockPatrulla,
        estado: "EN_VERIFICACION",
      });

      await expect(
        asignarRecursosPrevencionService(eventoId, inputValido, usuarioId)
      ).rejects.toThrow(PatrullaNoDisponibleError);
    });

    it("debe lanzar NotFoundError si alguno de los recursos solicitados no existe", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce(mockEvento as any);
      vi.spyOn(repo, "buscarPatrullaParaBloqueo").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        mockRecursosBloqueados[0] as any,
      ]);

      await expect(
        asignarRecursosPrevencionService(eventoId, inputValido, usuarioId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar BadRequestError si se solicita cantidad distinta de 1 para un activo individual (§3.6)", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce(mockEvento as any);
      vi.spyOn(repo, "buscarPatrullaParaBloqueo").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        mockRecursosBloqueados[1] as any,
      ]);

      await expect(
        asignarRecursosPrevencionService(
          eventoId,
          {
            patrullaId: mockPatrulla.id,
            recursos: [{ recursoId: recursoIndividualId, cantidad: 2 }],
          },
          usuarioId
        )
      ).rejects.toThrow(BadRequestError);
    });

    it("debe lanzar RecursoNoDisponibleError si un activo individual está en EN_MANTENCION, ASIGNADO o NO_DISPONIBLE (§3.6)", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      for (const estadoInvalido of ["EN_MANTENCION", "ASIGNADO", "NO_DISPONIBLE"] as const) {
        vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce(
          mockEvento as any
        );
        vi.spyOn(repo, "buscarPatrullaParaBloqueo").mockResolvedValueOnce(mockPatrulla);
        vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
          {
            ...mockRecursosBloqueados[1],
            estado: estadoInvalido,
          } as any,
        ]);

        await expect(
          asignarRecursosPrevencionService(
            eventoId,
            {
              patrullaId: mockPatrulla.id,
              recursos: [{ recursoId: recursoIndividualId, cantidad: 1 }],
            },
            usuarioId
          )
        ).rejects.toThrow(RecursoNoDisponibleError);
      }
    });

    it("debe lanzar RecursoNoDisponibleError si un recurso a granel está EN_MANTENCION", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce(mockEvento as any);
      vi.spyOn(repo, "buscarPatrullaParaBloqueo").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          ...mockRecursosBloqueados[0],
          estado: "EN_MANTENCION",
        } as any,
      ]);

      await expect(
        asignarRecursosPrevencionService(
          eventoId,
          {
            patrullaId: mockPatrulla.id,
            recursos: [{ recursoId: recursoGranelId, cantidad: 2 }],
          },
          usuarioId
        )
      ).rejects.toThrow(RecursoNoDisponibleError);
    });

    it("debe lanzar StockInsuficienteError cuando cantidad_inventario - cantidad_en_uso < cantidad_solicitada", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (cb) => cb({} as Trx)),
      } as any);

      vi.spyOn(repo, "buscarEventoPrevencionParaEdicion").mockResolvedValueOnce(mockEvento as any);
      vi.spyOn(repo, "buscarPatrullaParaBloqueo").mockResolvedValueOnce(mockPatrulla);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          ...mockRecursosBloqueados[0],
          cantidad_inventario: 10,
          cantidad_en_uso: 8, // disponible: 2
        } as any,
      ]);

      await expect(
        asignarRecursosPrevencionService(
          eventoId,
          {
            patrullaId: mockPatrulla.id,
            recursos: [{ recursoId: recursoGranelId, cantidad: 5 }],
          },
          usuarioId
        )
      ).rejects.toThrow(StockInsuficienteError);
    });
  });

  describe("3. Servicio obtenerDetalleEventoPrevencionService", () => {
    const eventoId = "80000000-0000-4000-8000-000000000010";

    it("debe retornar el detalle integral del evento de prevención con misiones y recursos", async () => {
      const fecha = new Date("2026-11-19T12:00:00Z");

      vi.spyOn(repo, "buscarEventoPrevencionDetallePorId").mockResolvedValueOnce({
        ep_id: eventoId,
        ep_codigo: "PREV-2026-0001",
        ep_nombre: "Limpieza preventiva en Angachilla",
        ep_descripcion: "Despeje de colectores",
        ep_sector: "Humedal Angachilla",
        ep_direccion_texto: "Pasaje Los Robles s/n",
        ep_prioridad: "ALTA",
        ep_estado: "PLANIFICADA",
        ep_latitud: "-39.8456",
        ep_longitud: "-73.2389",
        ep_ubicacion_geojson: { type: "Point", coordinates: [-73.2389, -39.8456] },
        ep_fecha_estimada_fin: null,
        ep_creado_por_id: "00000000-0000-4000-8000-000000000003",
        ep_actualizado_por_id: null,
        ep_creado_en: fecha,
        ep_actualizado_en: fecha,
        del_id: "30000000-0000-4000-8000-000000000002",
        del_codigo: "DEL_SUR",
        del_nombre: "Delegación Municipal Sur",
        pc_id: "40000000-0000-4000-8000-000000000001",
        pc_codigo: "PC-SUR-001",
        pc_nombre: "Colector Angachilla",
        pc_descripcion: "Sector vulnerable",
        pc_tipo_riesgo: "Inundación",
        pc_prioridad: "ALTA",
        pc_latitud: -39.8456,
        pc_longitud: -73.2389,
        pc_ubicacion_geojson: { type: "Point", coordinates: [-73.2389, -39.8456] },
      } as any);

      vi.spyOn(repo, "buscarMisionesPorEventoPrevencionId").mockResolvedValueOnce([
        {
          m_id: "60000000-0000-4000-8000-000000000099",
          m_codigo: "MIS-2026-0099",
          m_titulo: "Despacho preventivo: Limpieza preventiva en Angachilla",
          m_estado: "DESPACHADA",
          m_tipo_mision: "PREVENCION",
          m_fecha_inicio: fecha,
          m_fecha_cierre: null,
          m_creado_en: fecha,
          pv_id: "50000000-0000-4000-8000-000000000001",
          pv_nombre: "Patrulla Sur 1",
          pv_estado: "EN_PREVENCION",
          c_id: null,
          c_nombre: null,
          c_estado: null,
        },
      ] as any);

      vi.spyOn(repo, "buscarRecursosAsignadosDetallePorEventoPrevencionId").mockResolvedValueOnce([
        {
          id: "90000000-0000-4000-8000-000000000001",
          recurso_id: "80000000-0000-4000-8000-000000000001",
          cantidad_asignada: 10,
          mision_id: "60000000-0000-4000-8000-000000000099",
          creado_en: fecha,
          recurso_nombre: "Sacos de Arena 25kg",
          recurso_es_individual: false,
        },
      ] as any);

      const detalle = await obtenerDetalleEventoPrevencionService(eventoId);

      expect(detalle.codigo).toBe("PREV-2026-0001");
      expect(detalle.puntoCritico?.codigo).toBe("PC-SUR-001");
      expect(detalle.misiones).toHaveLength(1);
      expect(detalle.misiones[0].patrulla?.estado).toBe("EN_PREVENCION");
      expect(detalle.recursosAsignados).toHaveLength(1);
      expect(detalle.recursosAsignados[0].misionId).toBe("60000000-0000-4000-8000-000000000099");
    });

    it("debe lanzar NotFoundError si el evento de prevención no existe", async () => {
      vi.spyOn(repo, "buscarEventoPrevencionDetallePorId").mockResolvedValueOnce(undefined);

      await expect(obtenerDetalleEventoPrevencionService(eventoId)).rejects.toThrow(NotFoundError);
    });
  });

  describe("4. Emisiones WebSocket a salas encargado y mapa y transición de stock", () => {
    it("debe emitir prevencion:actualizada y recurso:actualizado hacia salas encargado, sala:encargados y mapa", () => {
      const emittedByRoom: Array<{ room: string; event: string; payload: unknown }> = [];
      const fakeIo = {
        to: (room: string) => ({
          emit: (event: string, payload: unknown) => {
            emittedByRoom.push({ room, event, payload });
          },
        }),
        emit: () => {},
      };

      socketModule.setSocketServer(fakeIo as any);
      try {
        socketModule.emitirEventoPrevencionActualizado({
          id: "80000000-0000-4000-8000-000000000010",
          codigo: "PREV-2026-0001",
          nombre: "Operativo preventivo",
          patrulla: {
            id: "50000000-0000-4000-8000-000000000001",
            nombre: "Patrulla Sur 1",
            estado: "EN_PREVENCION",
          },
        });

        socketModule.emitirRecursoActualizado({
          id: "80000000-0000-4000-8000-000000000001",
          nombre: "Sacos de Arena 25kg",
          cantidad_en_uso: 15,
        });

        const roomsPrevencion = emittedByRoom
          .filter((e) => e.event === "prevencion:actualizada")
          .map((e) => e.room);
        expect(roomsPrevencion).toEqual(
          expect.arrayContaining([
            "encargado",
            "sala:encargados",
            "mapa",
            "patrulla:50000000-0000-4000-8000-000000000001",
          ])
        );

        const roomsRecurso = emittedByRoom
          .filter((e) => e.event === "recurso:actualizado")
          .map((e) => e.room);
        expect(roomsRecurso).toEqual(
          expect.arrayContaining(["encargado", "sala:encargados", "supervisor", "mapa"])
        );
      } finally {
        socketModule.setSocketServer(null as any);
      }
    });

    it("debe recalcular estado a BAJO_STOCK y NO_DISPONIBLE al incrementar cantidad_en_uso en actualizarRecursoGranelUso", async () => {
      const setPayloads: Array<Record<string, unknown>> = [];
      const mockTrx = {
        selectFrom: () => ({
          select: () => ({
            where: () => ({
              executeTakeFirstOrThrow: async () => ({
                id: "r1",
                nombre: "Sacos",
                cantidad_inventario: 10,
                cantidad_en_uso: 5,
                cantidad_minima: 3,
                es_individual: false,
              }),
            }),
          }),
        }),
        updateTable: () => ({
          set: (values: Record<string, unknown>) => {
            setPayloads.push(values);
            return {
              where: () => ({
                returning: () => ({
                  executeTakeFirstOrThrow: async () => ({
                    id: "r1",
                    nombre: "Sacos",
                    es_individual: false,
                    estado: values.estado,
                    cantidad_inventario: 10,
                    cantidad_en_uso: values.cantidad_en_uso,
                    cantidad_minima: 3,
                  }),
                }),
              }),
            };
          },
        }),
      } as unknown as Trx;

      const resBajoStock = await repo.actualizarRecursoGranelUso(mockTrx, "r1", 3);
      expect(resBajoStock.cantidad_en_uso).toBe(8);
      expect(resBajoStock.estado).toBe("BAJO_STOCK");

      const resAgotado = await repo.actualizarRecursoGranelUso(mockTrx, "r1", 5);
      expect(resAgotado.cantidad_en_uso).toBe(10);
      expect(resAgotado.estado).toBe("NO_DISPONIBLE");
      expect(setPayloads).toHaveLength(2);
    });
  });
});
