import { describe, it, expect, vi, beforeEach } from "vitest";
import { CerrarRecuperacionInputSchema } from "../recuperacion.schema";
import {
  calcularReintegroInventario,
  cerrarRecuperacionService,
  ConsumoInvalidoError,
  NotFoundError,
  RecuperacionNoCerrableError,
  type AsignacionPendienteCierre,
} from "../recuperacion.service";
import * as repo from "../recuperacion.repository";
import type { KyselyTrx } from "../recuperacion.repository";
import { db } from "@/lib/db";
import * as socketModule from "@/lib/socket";

describe("Módulo Eventos ATP - Cierre de Operativo de Recuperación (HU-75)", () => {
  const recuperacionId = "70000000-0000-4000-8000-000000000001";
  const usuarioId = "00000000-0000-4000-8000-000000000003";
  const recursoA = "00000000-0000-4000-8000-000000000001";
  const recursoB = "00000000-0000-4000-8000-000000000002";
  const recursoInd = "00000000-0000-4000-8000-000000000009";
  const misionId = "60000000-0000-4000-8000-000000000001";
  const patrullaId = "50000000-0000-4000-8000-000000000001";
  const liderId = "00000000-0000-4000-8000-000000000010";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Validación de Esquemas Zod", () => {
    it("debe aceptar un resumen válido con consumos opcionales", () => {
      const res = CerrarRecuperacionInputSchema.safeParse({
        resumenCierre: "Se entregaron 7 kits de emergencia y el sector quedó habilitado.",
        consumos: [{ recursoId: recursoA, cantidadConsumida: 7 }],
      });
      expect(res.success).toBe(true);
    });

    it("debe aceptar omitir consumos (default [])", () => {
      const res = CerrarRecuperacionInputSchema.safeParse({
        resumenCierre: "Operativo concluido sin excedentes para reintegrar.",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.consumos).toEqual([]);
      }
    });

    it("debe rechazar resumenCierre menor a 10 caracteres", () => {
      const res = CerrarRecuperacionInputSchema.safeParse({
        resumenCierre: "Listo",
      });
      expect(res.success).toBe(false);
    });

    it("debe rechazar recursoId duplicado en consumos", () => {
      const res = CerrarRecuperacionInputSchema.safeParse({
        resumenCierre: "Operativo concluido con detalle duplicado.",
        consumos: [
          { recursoId: recursoA, cantidadConsumida: 2 },
          { recursoId: recursoA, cantidadConsumida: 3 },
        ],
      });
      expect(res.success).toBe(false);
    });
  });

  describe("2. Cálculo puro de reintegro de inventario (calcularReintegroInventario)", () => {
    const asignacionesBase: AsignacionPendienteCierre[] = [
      {
        id: "fila-1",
        recursoId: recursoA,
        nombre: "Sacos de Arena",
        esIndividual: false,
        cantidadAsignada: 10,
      },
      {
        id: "fila-2",
        recursoId: recursoB,
        nombre: "Frazadas",
        esIndividual: false,
        cantidadAsignada: 5,
      },
    ];

    it("debe calcular remanente parcial, total y nulo correctamente", () => {
      const resultado = calcularReintegroInventario(asignacionesBase, [
        { recursoId: recursoA, cantidadConsumida: 6 },
        { recursoId: recursoB, cantidadConsumida: 0 },
      ]);

      expect(resultado).toHaveLength(2);
      expect(resultado[0]).toMatchObject({
        recursoId: recursoA,
        cantidadAsignada: 10,
        cantidadConsumida: 6,
        remanente: 4,
      });
      expect(resultado[1]).toMatchObject({
        recursoId: recursoB,
        cantidadAsignada: 5,
        cantidadConsumida: 0,
        remanente: 5,
      });
    });

    it("debe asumir consumido completo (remanente 0) cuando un recurso a granel se omite", () => {
      const resultado = calcularReintegroInventario(asignacionesBase, [
        { recursoId: recursoA, cantidadConsumida: 3 },
      ]);

      expect(resultado[0].remanente).toBe(7);
      expect(resultado[1].cantidadConsumida).toBe(5);
      expect(resultado[1].remanente).toBe(0);
    });

    it("debe agrupar múltiples filas de un mismo recurso y distribuir consumo/devolución", () => {
      const filasDuplicadas: AsignacionPendienteCierre[] = [
        { id: "f1", recursoId: recursoA, nombre: "Sacos", esIndividual: false, cantidadAsignada: 6 },
        { id: "f2", recursoId: recursoA, nombre: "Sacos", esIndividual: false, cantidadAsignada: 4 },
      ];

      const resultado = calcularReintegroInventario(filasDuplicadas, [
        { recursoId: recursoA, cantidadConsumida: 7 },
      ]);

      expect(resultado).toHaveLength(1);
      expect(resultado[0].cantidadAsignada).toBe(10);
      expect(resultado[0].cantidadConsumida).toBe(7);
      expect(resultado[0].remanente).toBe(3);
      expect(resultado[0].filas).toEqual([
        { id: "f1", cantidadAsignada: 6, cantidadConsumida: 6, cantidadDevuelta: 0 },
        { id: "f2", cantidadAsignada: 4, cantidadConsumida: 1, cantidadDevuelta: 3 },
      ]);
    });

    it("debe reintegrar completo un activo individual aunque se omita en consumos", () => {
      const res = calcularReintegroInventario(
        [{ id: "f-ind", recursoId: recursoInd, nombre: "Motobomba", esIndividual: true, cantidadAsignada: 1 }],
        []
      );

      expect(res[0]).toMatchObject({
        recursoId: recursoInd,
        esIndividual: true,
        cantidadConsumida: 0,
        remanente: 1,
      });
    });

    it("debe lanzar ConsumoInvalidoError si se reporta consumo > 0 para un activo individual", () => {
      expect(() =>
        calcularReintegroInventario(
          [{ id: "f-ind", recursoId: recursoInd, nombre: "Motobomba", esIndividual: true, cantidadAsignada: 1 }],
          [{ recursoId: recursoInd, cantidadConsumida: 1 }]
        )
      ).toThrow(ConsumoInvalidoError);
    });

    it("debe lanzar ConsumoInvalidoError si la cantidad consumida supera lo asignado", () => {
      expect(() =>
        calcularReintegroInventario(asignacionesBase, [{ recursoId: recursoA, cantidadConsumida: 11 }])
      ).toThrow(ConsumoInvalidoError);
    });

    it("debe lanzar ConsumoInvalidoError si se reporta un recurso que no pertenece al operativo", () => {
      expect(() =>
        calcularReintegroInventario(asignacionesBase, [
          { recursoId: "00000000-0000-4000-8000-999999999999", cantidadConsumida: 1 },
        ])
      ).toThrow(ConsumoInvalidoError);
    });
  });

  describe("3. Orquestación transaccional (cerrarRecuperacionService)", () => {
    const fakeTrx = {} as KyselyTrx;

    function mockTransaccionExitosa() {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: async (cb: (trx: KyselyTrx) => Promise<unknown>) => cb(fakeTrx),
      } as never);
    }

    const operativoEnEjecucion = {
      id: recuperacionId,
      codigo: "REC-2026-0010",
      nombre: "Entrega en Sector Collico",
      descripcion: "Apoyo tras temporal",
      sector: "Collico",
      direccion_texto: "Av. Balmaceda 1200",
      prioridad: "ALTA" as const,
      contacto_nombre: "Juan Pérez",
      contacto_telefono: "+56911112222",
      latitud: -39.81,
      longitud: -73.24,
      ubicacion: null,
      estado: "EN_EJECUCION" as const,
      familias_afectadas: 6,
      delegacion_id: null,
      fecha_estimada_fin: null,
      fecha_cierre: null,
      observaciones_cierre: null,
      eliminado_en: null,
      evento_atp_id: null,
      creado_por_id: usuarioId,
      actualizado_por_id: null,
      cerrado_por_id: null,
      creado_en: new Date("2026-11-18T10:00:00Z"),
      actualizado_en: new Date("2026-11-18T10:00:00Z"),
    };

    it("debe lanzar NotFoundError si el operativo no existe", async () => {
      mockTransaccionExitosa();
      vi.spyOn(repo, "bloquearRecuperacionPorId").mockResolvedValueOnce(undefined);

      await expect(
        cerrarRecuperacionService(
          recuperacionId,
          { resumenCierre: "Resumen válido de cierre.", consumos: [] },
          usuarioId
        )
      ).rejects.toThrow(NotFoundError);
    });

    it.each(["PLANIFICADA", "COMPLETADA", "CANCELADA"] as const)(
      "debe lanzar RecuperacionNoCerrableError si el estado es %s",
      async (estadoInvalido) => {
        mockTransaccionExitosa();
        vi.spyOn(repo, "bloquearRecuperacionPorId").mockResolvedValueOnce({
          ...operativoEnEjecucion,
          estado: estadoInvalido,
        });

        await expect(
          cerrarRecuperacionService(
            recuperacionId,
            { resumenCierre: "Resumen válido de cierre.", consumos: [] },
            usuarioId
          )
        ).rejects.toThrow(RecuperacionNoCerrableError);
      }
    );

    it("debe reintegrar remanentes a cantidad_inventario, cerrar misión, liberar patrulla y emitir sockets post-commit", async () => {
      mockTransaccionExitosa();
      vi.spyOn(repo, "bloquearRecuperacionPorId").mockResolvedValueOnce(operativoEnEjecucion);
      vi.spyOn(repo, "listarAsignacionesPendientesDevolucion").mockResolvedValueOnce([
        {
          id: "fila-a",
          recursoId: recursoA,
          nombre: "Sacos de Arena",
          esIndividual: false,
          cantidadAsignada: 10,
        },
        {
          id: "fila-b",
          recursoId: recursoB,
          nombre: "Frazadas",
          esIndividual: false,
          cantidadAsignada: 5,
        },
      ]);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([
        {
          id: recursoA,
          nombre: "Sacos de Arena",
          cantidad_inventario: 0,
          cantidad_en_uso: 0,
          cantidad_minima: 2,
          estado: "NO_DISPONIBLE",
          es_individual: false,
        },
        {
          id: recursoB,
          nombre: "Frazadas",
          cantidad_inventario: 20,
          cantidad_en_uso: 0,
          cantidad_minima: 5,
          estado: "DISPONIBLE",
          es_individual: false,
        },
      ]);

      const spyDevolverStock = vi
        .spyOn(repo, "devolverStockRecursoConDetalle")
        .mockResolvedValueOnce({
        id: recursoA,
        nombre: "Sacos de Arena",
        es_individual: false,
        estado: "DISPONIBLE",
        cantidad_inventario: 4,
        cantidad_en_uso: 0,
        cantidad_minima: 2,
      } as never);
      const spyMarcarDevolucion = vi.spyOn(repo, "marcarDevolucionAsignacion").mockResolvedValue();

      vi.spyOn(repo, "buscarMisionParaCierrePorRecuperacionId").mockResolvedValue({
        id: misionId,
        codigo: "MIS-2026-0099",
        titulo: "Despacho Collico",
        estado: "EN_CURSO",
        tipo_mision: "RECUPERACION",
        patrulla_id: patrullaId,
        incidente_id: null,
        fecha_inicio: new Date("2026-11-18T10:05:00Z"),
      });
      vi.spyOn(repo, "buscarMisionPorRecuperacionId").mockResolvedValue({
        id: misionId,
        codigo: "MIS-2026-0099",
        titulo: "Despacho Collico",
        estado: "COMPLETADA",
        tipo_mision: "RECUPERACION",
        patrulla_id: patrullaId,
      });

      const spyCompletarMision = vi.spyOn(repo, "completarMisionRecuperacion").mockResolvedValueOnce({
        id: misionId,
        codigo: "MIS-2026-0099",
        estado: "COMPLETADA",
        tipo_mision: "RECUPERACION",
        patrulla_id: patrullaId,
        cuadrilla_id: null,
        incidente_id: null,
      } as never);
      vi.spyOn(repo, "registrarHitoMision").mockResolvedValueOnce({
        id: "hito-1",
        hito: "OPERATIVO_CONCLUIDO",
        descripcion: "Operativo concluido por Encargado: Se entregaron 6 sacos.",
        registrado_por_id: usuarioId,
        creado_en: new Date(),
      } as never);

      vi.spyOn(repo, "contarOtrasMisionesActivasPatrulla").mockResolvedValueOnce(0);
      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValue({
        id: patrullaId,
        nombre: "Patrulla Alfa",
        estado: "EN_RECUPERACION",
        delegacion_id: null,
        usuario_lider_id: liderId,
      });
      const spyPatrullaEstado = vi.spyOn(repo, "actualizarEstadoPatrulla").mockResolvedValue();
      const spyLiderEstado = vi.spyOn(repo, "actualizarEstadoPersonalLider").mockResolvedValue();

      vi.spyOn(repo, "cerrarRecuperacion").mockResolvedValueOnce({
        ...operativoEnEjecucion,
        estado: "COMPLETADA",
        observaciones_cierre: "Se entregaron 6 sacos.",
        fecha_cierre: new Date(),
        cerrado_por_id: usuarioId,
      });

      const spySocketRec = vi.spyOn(socketModule, "emitirRecuperacionActualizada").mockImplementation(() => {});
      const spySocketRecurso = vi.spyOn(socketModule, "emitirRecursoActualizado").mockImplementation(() => {});
      const spySocketPatrulla = vi.spyOn(socketModule, "notificarPatrullaActualizada").mockImplementation(() => {});
      const spySocketMision = vi.spyOn(socketModule, "notificarMisionActualizada").mockImplementation(() => {});

      const res = await cerrarRecuperacionService(
        recuperacionId,
        {
          resumenCierre: "Se entregaron 6 sacos.",
          consumos: [{ recursoId: recursoA, cantidadConsumida: 6 }],
        },
        usuarioId
      );

      expect(res.evento.estado).toBe("COMPLETADA");
      expect(res.evento.observacionesCierre).toBe("Se entregaron 6 sacos.");
      expect(res.evento.cerradoPorId).toBe(usuarioId);
      // Recurso A devuelve 4; recurso B omitido => consumo total => no llama devolverStockRecurso
      expect(spyDevolverStock).toHaveBeenCalledTimes(1);
      expect(spyDevolverStock).toHaveBeenCalledWith(fakeTrx, recursoA, 4);
      expect(spyMarcarDevolucion).toHaveBeenCalledTimes(2);
      expect(res.recursosReintegrados[0]).toMatchObject({
        recursoId: recursoA,
        cantidadAsignada: 10,
        cantidadConsumida: 6,
        cantidadDevuelta: 4,
        cantidadInventario: 4,
        cantidadEnUso: 0,
        estadoRecurso: "DISPONIBLE",
      });
      expect(res.recursosReintegrados[1]).toMatchObject({
        recursoId: recursoB,
        cantidadAsignada: 5,
        cantidadConsumida: 5,
        cantidadDevuelta: 0,
      });

      expect(spyCompletarMision).toHaveBeenCalledTimes(1);
      expect(spyPatrullaEstado).toHaveBeenCalledWith(fakeTrx, patrullaId, "DISPONIBLE");
      expect(spyLiderEstado).toHaveBeenCalledWith(fakeTrx, liderId, "disponible", true);
      expect(res.patrullaLiberada).toEqual({ id: patrullaId, nombre: "Patrulla Alfa", estado: "DISPONIBLE" });

      expect(spySocketRec).toHaveBeenCalledWith(
        expect.objectContaining({ id: recuperacionId, estado: "COMPLETADA", accion: "CERRADA" })
      );
      expect(spySocketRecurso).toHaveBeenCalledTimes(2);
      expect(spySocketPatrulla).toHaveBeenCalledWith(
        expect.objectContaining({ patrullaId, estado: "DISPONIBLE", misionActivaId: null })
      );
      expect(spySocketMision).toHaveBeenCalledWith(
        expect.objectContaining({ misionId, estado: "COMPLETADA" })
      );
    });

    it("no debe liberar la patrulla si tiene otra misión activa y no debe emitir sockets si falla la transacción", async () => {
      mockTransaccionExitosa();
      vi.spyOn(repo, "bloquearRecuperacionPorId").mockResolvedValueOnce(operativoEnEjecucion);
      vi.spyOn(repo, "listarAsignacionesPendientesDevolucion").mockResolvedValueOnce([]);
      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValueOnce([]);
      vi.spyOn(repo, "buscarMisionParaCierrePorRecuperacionId").mockResolvedValue({
        id: misionId,
        codigo: "MIS-2026-0099",
        titulo: "Despacho Collico",
        estado: "RECHAZADA",
        tipo_mision: "RECUPERACION",
        patrulla_id: patrullaId,
        incidente_id: null,
        fecha_inicio: null,
      });
      vi.spyOn(repo, "contarOtrasMisionesActivasPatrulla").mockResolvedValueOnce(1);
      const spyPatrullaEstado = vi.spyOn(repo, "actualizarEstadoPatrulla").mockResolvedValue();
      vi.spyOn(repo, "cerrarRecuperacion").mockRejectedValueOnce(new Error("Fallo DB simulado"));

      const spySocketRec = vi.spyOn(socketModule, "emitirRecuperacionActualizada").mockImplementation(() => {});

      await expect(
        cerrarRecuperacionService(
          recuperacionId,
          { resumenCierre: "Resumen válido de cierre.", consumos: [] },
          usuarioId
        )
      ).rejects.toThrow("Fallo DB simulado");

      expect(spyPatrullaEstado).not.toHaveBeenCalled();
      expect(spySocketRec).not.toHaveBeenCalled();
    });
  });
});
