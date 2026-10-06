import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CrearEventoRecuperacionInputSchema,
  CrearEventoRecuperacionInput,
} from "../recuperacion.schema";
import {
  crearEventoRecuperacionService,
  PatrullaNoDisponibleError,
  StockInsuficienteError,
  NotFoundError,
} from "../recuperacion.service";
import * as repo from "../recuperacion.repository";
import type { KyselyTrx } from "../recuperacion.repository";
import { db } from "@/lib/db";
import * as socketModule from "@/lib/socket";

describe("Módulo Eventos ATP - Creación de Eventos de Recuperación (HU-29)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
        creado_por_id: usuarioId,
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
      const spyActualizarPatrulla = vi.spyOn(repo, "actualizarEstadoPatrulla").mockResolvedValueOnce();
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
});
