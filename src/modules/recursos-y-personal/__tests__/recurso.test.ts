import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  determinarEstadoRecurso,
  calcularDisponibilidadOperativa,
  obtenerEtiquetaTipoRecurso,
} from "../recurso.utils";
import {
  CrearRecursoInputSchema,
  DetallesRecursoSchema,
  ListarRecursosQuerySchema,
} from "../recurso.schema";
import { crearRecurso, listarRecursos } from "../recurso.service";
import * as recursoRepository from "../recurso.repository";
import { seguridadService } from "@/modules/seguridad/service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/errors";

describe("Módulo Recursos y Personal - Pruebas Unitarias", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Reglas de Cálculo de Estado y Disponibilidad Operativa", () => {
    it("debe retornar NO_DISPONIBLE si la cantidad en inventario es 0", () => {
      expect(determinarEstadoRecurso(0, 10)).toBe("NO_DISPONIBLE");
      expect(determinarEstadoRecurso(0, 0)).toBe("NO_DISPONIBLE");
    });

    it("debe retornar NO_DISPONIBLE si la cantidad en inventario es negativa", () => {
      expect(determinarEstadoRecurso(-5, 10)).toBe("NO_DISPONIBLE");
    });

    it("debe retornar BAJO_STOCK si la cantidad en inventario es menor o igual al umbral mínimo", () => {
      expect(determinarEstadoRecurso(5, 10)).toBe("BAJO_STOCK");
      expect(determinarEstadoRecurso(10, 10)).toBe("BAJO_STOCK");
      expect(determinarEstadoRecurso(1, 20)).toBe("BAJO_STOCK");
    });

    it("debe retornar DISPONIBLE si la cantidad en inventario supera el umbral mínimo", () => {
      expect(determinarEstadoRecurso(11, 10)).toBe("DISPONIBLE");
      expect(determinarEstadoRecurso(50, 20)).toBe("DISPONIBLE");
    });

    it("debe retornar DISPONIBLE cuando el umbral mínimo es 0 y hay stock disponible", () => {
      expect(determinarEstadoRecurso(1, 0)).toBe("DISPONIBLE");
      expect(determinarEstadoRecurso(500, 0)).toBe("DISPONIBLE");
    });

    it("calcularDisponibilidadOperativa debe priorizar estado EN_MANTENCION", () => {
      expect(calcularDisponibilidadOperativa("EN_MANTENCION", 5, 0, 1)).toBe("EN_MANTENCION");
      expect(calcularDisponibilidadOperativa("EN_MANTENCION", 0, 0, 0)).toBe("EN_MANTENCION");
    });

    it("calcularDisponibilidadOperativa debe retornar ASIGNADO si todo el stock está en uso", () => {
      expect(calcularDisponibilidadOperativa("DISPONIBLE", 1, 1, 0)).toBe("ASIGNADO");
      expect(calcularDisponibilidadOperativa("DISPONIBLE", 5, 5, 2)).toBe("ASIGNADO");
    });

    it("calcularDisponibilidadOperativa debe retornar BAJO_STOCK si el disponible es <= minimo", () => {
      expect(calcularDisponibilidadOperativa("DISPONIBLE", 10, 8, 3)).toBe("BAJO_STOCK");
    });

    it("obtenerEtiquetaTipoRecurso debe formatear correctamente", () => {
      expect(obtenerEtiquetaTipoRecurso(true)).toBe("Vehículo o Maquinaria");
      expect(obtenerEtiquetaTipoRecurso(false)).toBe("Material o Insumo");
    });
  });

  describe("2. Validación de Esquemas Zod", () => {
    it("debe aceptar un recurso a granel válido con delegacionId", () => {
      const payload = {
        nombre: "Sacos de Arena",
        esIndividual: false,
        cantidadInventario: 500,
        cantidadMinima: 100,
        latitud: -39.8142,
        longitud: -73.2459,
        descripcion: "Sacos de contención para crecida de ríos",
        delegacionId: "30000000-0000-4000-8000-000000000001",
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.nombre).toBe("Sacos de Arena");
        expect(resultado.data.esIndividual).toBe(false);
        expect(resultado.data.delegacionId).toBe("30000000-0000-4000-8000-000000000001");
      }
    });

    it("debe aceptar una Camioneta con especificaciones técnicas en detalles", () => {
      const payload = {
        nombre: "Camioneta Operaciones 4x4",
        esIndividual: true,
        cantidadInventario: 1,
        cantidadMinima: 0,
        latitud: -39.817,
        longitud: -73.242,
        detalles: {
          patente: "ABCD-12",
          marca: "Toyota",
          modelo: "Hilux",
          anio: 2023,
          kilometraje: 45000,
          tipoCombustible: "DIESEL",
          capacidadPasajeros: 5,
        },
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.detalles.kilometraje).toBe(45000);
        expect(resultado.data.detalles.patente).toBe("ABCD-12");
      }
    });

    it("debe rechazar nombres demasiado cortos (< 3 caracteres)", () => {
      const payload = {
        nombre: "AB",
        cantidadInventario: 1,
        latitud: -39.8142,
        longitud: -73.2459,
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar cantidades de inventario negativas", () => {
      const payload = {
        nombre: "Generador Eléctrico",
        cantidadInventario: -1,
        latitud: -39.8142,
        longitud: -73.2459,
      };

      const resultado = CrearRecursoInputSchema.safeParse(payload);
      expect(resultado.success).toBe(false);
    });

    it("debe rechazar valores numéricos técnicos negativos en detalles", () => {
      expect(DetallesRecursoSchema.safeParse({ kilometraje: -100 }).success).toBe(false);
      expect(DetallesRecursoSchema.safeParse({ capacidadCargaKg: -5 }).success).toBe(false);
      expect(DetallesRecursoSchema.safeParse({ caudalMaximoLpm: 0 }).success).toBe(false);
    });

    it("ListarRecursosQuerySchema debe asignar valores por defecto en paginación", () => {
      const resultado = ListarRecursosQuerySchema.safeParse({});
      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.pagina).toBe(1);
        expect(resultado.data.limite).toBe(10);
      }
    });

    it("ListarRecursosQuerySchema debe rechazar páginas inválidas o límites excesivos", () => {
      expect(ListarRecursosQuerySchema.safeParse({ pagina: 0 }).success).toBe(false);
      expect(ListarRecursosQuerySchema.safeParse({ limite: 105 }).success).toBe(false);
    });
  });

  describe("3. Servicio de Listado Paginado (listarRecursos)", () => {
    const adminId = "00000000-0000-4000-8000-000000000001";

    it("debe arrojar UnauthorizedError si la cabecera X-User-Id está ausente", async () => {
      await expect(listarRecursos({}, null)).rejects.toThrow(UnauthorizedError);
      await expect(listarRecursos({}, "")).rejects.toThrow(UnauthorizedError);
    });

    it("debe arrojar ForbiddenError si el usuario no tiene rol Administrador", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere perfil de Administrador.")
      );

      await expect(listarRecursos({}, "usuario-no-admin")).rejects.toThrow(ForbiddenError);
    });

    it("debe retornar listado vacío cuando no hay recursos registrados (Criterio Vacío)", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: adminId,
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce([]);
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(0);

      const respuesta = await listarRecursos({ pagina: 1, limite: 10 }, adminId);

      expect(respuesta.data).toEqual([]);
      expect(respuesta.meta).toEqual({
        total: 0,
        pagina: 1,
        limite: 10,
        totalPaginas: 0,
      });
    });

    it("debe retornar registros mapeados con delegación y disponibilidad calculada", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: adminId,
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      const mockFilas = [
        {
          id: "40000000-0000-4000-8000-000000000001",
          nombre: "Camioneta Rescate 4x4",
          es_individual: true,
          estado: "DISPONIBLE" as const,
          cantidad_inventario: 1,
          cantidad_en_uso: 0,
          cantidad_minima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: "Unidad ligera",
          detalles: { patente: "ABCD-12" },
          delegacion_id: "30000000-0000-4000-8000-000000000001",
          delegacion_codigo: "DEL_NORTE",
          delegacion_nombre: "Delegación Municipal Norte",
          creado_por_id: adminId,
          creado_en: new Date("2026-09-17T10:00:00Z"),
          actualizado_en: new Date("2026-09-17T10:00:00Z"),
        },
      ];

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce(mockFilas as any);
      vi.spyOn(recursoRepository, "contarRecursos").mockResolvedValueOnce(1);

      const respuesta = await listarRecursos({ pagina: 1, limite: 10 }, adminId);

      expect(respuesta.data.length).toBe(1);
      const item = respuesta.data[0];
      expect(item.nombre).toBe("Camioneta Rescate 4x4");
      expect(item.tipo).toBe("Vehículo o Maquinaria");
      expect(item.estado).toBe("DISPONIBLE");
      expect(item.cantidadDisponible).toBe(1);
      expect(item.delegacion).toEqual({
        id: "30000000-0000-4000-8000-000000000001",
        codigo: "DEL_NORTE",
        nombre: "Delegación Municipal Norte",
      });
      expect(respuesta.meta.total).toBe(1);
      expect(respuesta.meta.totalPaginas).toBe(1);
    });
  });

  describe("4. Servicio de Creación (crearRecurso)", () => {
    it("debe arrojar UnauthorizedError si la cabecera X-User-Id está ausente", async () => {
      const input = {
        nombre: "Generador 5kVA",
        esIndividual: true,
        cantidadInventario: 1,
        cantidadMinima: 0,
        latitud: -39.8142,
        longitud: -73.2459,
        detalles: {},
      };

      await expect(crearRecurso(input, null)).rejects.toThrow(UnauthorizedError);
      await expect(crearRecurso(input, "")).rejects.toThrow(UnauthorizedError);
    });
  });
});
