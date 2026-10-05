import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CrearEventoPrevencionInputSchema,
  EventoPrevencionResponseSchema,
} from "../evento-prevencion.schema";
import {
  crearEventoPrevencionService,
  PatrullaNoDisponibleError,
  NotFoundError,
  StockInsuficienteError,
} from "../evento-prevencion.service";
import * as repo from "../evento-prevencion.repository";
import * as socketModule from "@/lib/socket";
import { db } from "@/lib/db";

describe("Módulo Eventos ATP / Prevención (HU-30) - Pruebas Unitarias", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Validación de Esquemas Zod", () => {
    const payloadValido = {
      nombre: "Limpieza y monitoreo de sumideros en Angachilla",
      descripcion: "Monitoreo preventivo del caudal e inspección de alcantarillas por frente de mal tiempo.",
      sector: "Humedal Angachilla",
      direccionTexto: "Av. Simpson con Los Robles",
      prioridad: "ALTA",
      delegacionId: "30000000-0000-4000-8000-000000000001",
      puntoCriticoId: "40000000-0000-4000-8000-000000000001",
      latitud: -39.8456,
      longitud: -73.2389,
      patrullaId: "50000000-0000-4000-8000-000000000001",
      recursos: [
        {
          recursoId: "00000000-0000-4000-8000-000000000001",
          cantidad: 10,
        },
      ],
    };

    it("debe validar un payload correcto de creación de evento de prevención", () => {
      const parsed = CrearEventoPrevencionInputSchema.safeParse(payloadValido);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.nombre).toBe(payloadValido.nombre);
        expect(parsed.data.prioridad).toBe("ALTA");
        expect(parsed.data.recursos).toHaveLength(1);
      }
    });

    it("debe asignar prioridad MEDIA por defecto si no se indica", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { prioridad, ...sinPrioridad } = payloadValido;
      const parsed = CrearEventoPrevencionInputSchema.safeParse(sinPrioridad);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.prioridad).toBe("MEDIA");
      }
    });

    it("debe rechazar si la descripción tiene menos de 5 caracteres", () => {
      const payloadInvalido = { ...payloadValido, descripcion: "abc" };
      const parsed = CrearEventoPrevencionInputSchema.safeParse(payloadInvalido);
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar si el nombre tiene menos de 3 caracteres", () => {
      const payloadInvalido = { ...payloadValido, nombre: "ab" };
      const parsed = CrearEventoPrevencionInputSchema.safeParse(payloadInvalido);
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar si delegacionId no es un UUID válido", () => {
      const payloadInvalido = { ...payloadValido, delegacionId: "123-invalido" };
      const parsed = CrearEventoPrevencionInputSchema.safeParse(payloadInvalido);
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar si patrullaId no es un UUID válido", () => {
      const payloadInvalido = { ...payloadValido, patrullaId: "no-uuid" };
      const parsed = CrearEventoPrevencionInputSchema.safeParse(payloadInvalido);
      expect(parsed.success).toBe(false);
    });

    it("debe rechazar cantidades de recursos menores a 1", () => {
      const payloadInvalido = {
        ...payloadValido,
        recursos: [
          {
            recursoId: "00000000-0000-4000-8000-000000000001",
            cantidad: 0,
          },
        ],
      };
      const parsed = CrearEventoPrevencionInputSchema.safeParse(payloadInvalido);
      expect(parsed.success).toBe(false);
    });

    it("debe validar esquema de respuesta estructurada", () => {
      const respuestaValida = {
        id: "70000000-0000-4000-8000-000000000001",
        codigo: "PREV-2026-0001",
        nombre: "Inspección preventiva Collico",
        descripcion: "Monitoreo preventivo del estero",
        sector: "Collico",
        direccionTexto: "Calle Principal 123",
        prioridad: "ALTA",
        estado: "PLANIFICADA",
        latitud: -39.8142,
        longitud: -73.2459,
        puntoCritico: {
          id: "40000000-0000-4000-8000-000000000001",
          codigo: "PC-COL-01",
          nombre: "Estero Collico",
        },
        delegacion: {
          id: "30000000-0000-4000-8000-000000000001",
          codigo: "DEL-SUR",
          nombre: "Delegación Sur",
        },
        mision: {
          id: "60000000-0000-4000-8000-000000000001",
          codigo: "MIS-2026-0001",
          titulo: "Inspección preventiva Collico",
          estado: "DESPACHADA",
          tipoMision: "PREVENCION",
        },
        patrulla: {
          id: "50000000-0000-4000-8000-000000000001",
          nombre: "Patrulla Alfa",
          estado: "EN_PREVENCION",
        },
        recursos: [
          {
            recursoId: "00000000-0000-4000-8000-000000000001",
            nombre: "Sacos de Arena",
            cantidadAsignada: 5,
          },
        ],
        creadoPorId: "00000000-0000-4000-8000-000000000001",
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      };

      const parsed = EventoPrevencionResponseSchema.safeParse(respuestaValida);
      expect(parsed.success).toBe(true);
    });
  });

  describe("2. Servicio de Negocio (crearEventoPrevencionService)", () => {
    const inputValido = {
      nombre: "Monitoreo preventivo de quebrada",
      descripcion: "Revisión técnica de cauce y retiro de ramas caídas.",
      sector: "Sector Isla Teja",
      direccionTexto: "Los Robles 450",
      prioridad: "MEDIA" as const,
      delegacionId: "30000000-0000-4000-8000-000000000001",
      puntoCriticoId: "40000000-0000-4000-8000-000000000001",
      latitud: -39.81,
      longitud: -73.25,
      patrullaId: "50000000-0000-4000-8000-000000000001",
      recursos: [
        {
          recursoId: "00000000-0000-4000-8000-000000000001",
          cantidad: 5,
        },
      ],
    };

    const usuarioId = "00000000-0000-4000-8000-000000000001";

    it("debe lanzar NotFoundError si la patrulla verificadora no existe", async () => {
      // Mock db.transaction().execute()
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (callback) => {
          return await callback({} as any);
        }),
      } as any);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValue(undefined);

      await expect(
        crearEventoPrevencionService(inputValido, usuarioId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar PatrullaNoDisponibleError si la patrulla no está en estado DISPONIBLE", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (callback) => {
          return await callback({} as any);
        }),
      } as any);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValue({
        id: inputValido.patrullaId,
        nombre: "Patrulla Alfa",
        estado: "EN_VERIFICACION" as any,
        delegacion_id: inputValido.delegacionId,
        usuario_lider_id: null,
      });

      await expect(
        crearEventoPrevencionService(inputValido, usuarioId)
      ).rejects.toThrow(PatrullaNoDisponibleError);
    });

    it("debe lanzar NotFoundError si la delegación indicada no existe", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (callback) => {
          return await callback({} as any);
        }),
      } as any);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValue({
        id: inputValido.patrullaId,
        nombre: "Patrulla Alfa",
        estado: "DISPONIBLE" as any,
        delegacion_id: inputValido.delegacionId,
        usuario_lider_id: null,
      });

      vi.spyOn(repo, "buscarDelegacionPorId").mockResolvedValue(undefined);

      await expect(
        crearEventoPrevencionService(inputValido, usuarioId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar NotFoundError si el punto crítico indicado no existe", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (callback) => {
          return await callback({} as any);
        }),
      } as any);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValue({
        id: inputValido.patrullaId,
        nombre: "Patrulla Alfa",
        estado: "DISPONIBLE" as any,
        delegacion_id: inputValido.delegacionId,
        usuario_lider_id: null,
      });

      vi.spyOn(repo, "buscarDelegacionPorId").mockResolvedValue({
        id: inputValido.delegacionId,
        codigo_delegacion: "DEL-SUR",
        nombre_delegacion: "Delegación Sur",
      } as any);

      vi.spyOn(repo, "buscarPuntoCriticoPorId").mockResolvedValue(undefined);

      await expect(
        crearEventoPrevencionService(inputValido, usuarioId)
      ).rejects.toThrow(NotFoundError);
    });

    it("debe lanzar StockInsuficienteError si no hay stock disponible para el recurso solicitado", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (callback) => {
          return await callback({} as any);
        }),
      } as any);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValue({
        id: inputValido.patrullaId,
        nombre: "Patrulla Alfa",
        estado: "DISPONIBLE" as any,
        delegacion_id: inputValido.delegacionId,
        usuario_lider_id: null,
      });

      vi.spyOn(repo, "buscarDelegacionPorId").mockResolvedValue({
        id: inputValido.delegacionId,
        codigo_delegacion: "DEL-SUR",
        nombre_delegacion: "Delegación Sur",
      } as any);

      vi.spyOn(repo, "buscarPuntoCriticoPorId").mockResolvedValue({
        id: inputValido.puntoCriticoId!,
        codigo: "PC-COL-01",
        nombre: "Punto Crítico Collico",
        activo: true,
      } as any);

      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValue([
        {
          id: inputValido.recursos[0].recursoId,
          nombre: "Motobomba 5HP",
          cantidad_inventario: 2,
          cantidad_en_uso: 1, // disponible: 1, pero se solicitan 5
          activo: true,
        } as any,
      ]);

      await expect(
        crearEventoPrevencionService(inputValido, usuarioId)
      ).rejects.toThrow(StockInsuficienteError);
    });

    it("debe crear el evento de prevención exitosamente, despachar misión y emitir socket", async () => {
      vi.spyOn(db, "transaction").mockReturnValue({
        execute: vi.fn().mockImplementation(async (callback) => {
          return await callback({} as any);
        }),
      } as any);

      vi.spyOn(repo, "buscarPatrullaPorId").mockResolvedValue({
        id: inputValido.patrullaId,
        nombre: "Patrulla Alfa",
        estado: "DISPONIBLE" as any,
        delegacion_id: inputValido.delegacionId,
        usuario_lider_id: "user-lider-uuid",
      });

      vi.spyOn(repo, "buscarDelegacionPorId").mockResolvedValue({
        id: inputValido.delegacionId,
        codigo_delegacion: "DEL-SUR",
        nombre_delegacion: "Delegación Sur",
      } as any);

      vi.spyOn(repo, "buscarPuntoCriticoPorId").mockResolvedValue({
        id: inputValido.puntoCriticoId!,
        codigo: "PC-COL-01",
        nombre: "Punto Crítico Collico",
        activo: true,
      } as any);

      vi.spyOn(repo, "obtenerRecursosParaBloqueo").mockResolvedValue([
        {
          id: inputValido.recursos[0].recursoId,
          nombre: "Sacos de Arena",
          cantidad_inventario: 20,
          cantidad_en_uso: 0,
          activo: true,
        } as any,
      ]);

      vi.spyOn(repo, "generarSiguienteCodigoPrevencion").mockResolvedValue("PREV-2026-0001");
      vi.spyOn(repo, "generarSiguienteCodigoMision").mockResolvedValue("MIS-2026-0001");

      vi.spyOn(repo, "insertarEventoPrevencion").mockResolvedValue({
        id: "evento-uuid-1",
        codigo: "PREV-2026-0001",
        nombre: inputValido.nombre,
        descripcion: inputValido.descripcion,
        prioridad: inputValido.prioridad,
        estado: "PLANIFICADA",
        sector: inputValido.sector,
        direccion_texto: inputValido.direccionTexto,
        punto_critico_id: inputValido.puntoCriticoId!,
        delegacion_id: inputValido.delegacionId,
        latitud: inputValido.latitud,
        longitud: inputValido.longitud,
        creado_por_id: usuarioId,
        creado_en: new Date(),
        actualizado_en: new Date(),
      });

      vi.spyOn(repo, "insertarMisionPrevencion").mockResolvedValue({
        id: "mision-uuid-1",
        codigo: "MIS-2026-0001",
        titulo: inputValido.nombre,
        estado: "DESPACHADA",
        tipo_mision: "PREVENCION",
      });

      vi.spyOn(repo, "insertarRecursosPrevencion").mockResolvedValue(undefined as any);
      vi.spyOn(repo, "descontarStockRecurso").mockResolvedValue(undefined as any);
      vi.spyOn(repo, "actualizarEstadoPatrulla").mockResolvedValue(undefined as any);
      vi.spyOn(repo, "actualizarEstadoPersonalLider").mockResolvedValue(undefined as any);

      const spyEmitirSocket = vi
        .spyOn(socketModule, "emitirEventoPrevencionCreado")
        .mockImplementation(() => {});

      const resultado = await crearEventoPrevencionService(inputValido, usuarioId);

      expect(resultado).toBeDefined();
      expect(resultado.codigo).toBe("PREV-2026-0001");
      expect(resultado.mision.codigo).toBe("MIS-2026-0001");
      expect(resultado.patrulla.estado).toBe("EN_PREVENCION");
      expect(resultado.recursos).toHaveLength(1);
      expect(resultado.puntoCritico?.codigo).toBe("PC-COL-01");

      expect(repo.actualizarEstadoPatrulla).toHaveBeenCalledWith(
        expect.anything(),
        inputValido.patrullaId,
        "EN_PREVENCION"
      );
      expect(repo.actualizarEstadoPersonalLider).toHaveBeenCalledWith(
        expect.anything(),
        "user-lider-uuid",
        "en_mision"
      );
      expect(spyEmitirSocket).toHaveBeenCalledWith(resultado);
    });
  });
});
