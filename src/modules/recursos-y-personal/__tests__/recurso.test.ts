import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  determinarEstadoRecurso,
  calcularDisponibilidadOperativa,
  obtenerEtiquetaTipoRecurso,
} from "../recurso.utils";
import {
  CrearRecursoInputSchema,
  ActualizarRecursoInputSchema,
  RecursoIdParamSchema,
  DetallesRecursoSchema,
  ListarRecursosQuerySchema,
} from "../recurso.schema";
import {
  crearRecurso,
  listarRecursos,
  obtenerRecursoDetalle,
  editarRecurso,
} from "../recurso.service";
import * as recursoRepository from "../recurso.repository";
import { seguridadService } from "@/modules/seguridad/service";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/modules/seguridad/errors";

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

      vi.spyOn(recursoRepository, "listarRecursosPaginados").mockResolvedValueOnce(
        mockFilas as unknown as Awaited<ReturnType<typeof recursoRepository.listarRecursosPaginados>>
      );
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

  describe("5. Validación de Esquema de Edición (ActualizarRecursoInputSchema) y Parámetro", () => {
    it("debe validar correctamente el UUID en RecursoIdParamSchema", () => {
      expect(RecursoIdParamSchema.safeParse({ id: "40000000-0000-4000-8000-000000000001" }).success).toBe(true);
      expect(RecursoIdParamSchema.safeParse({ id: "id-invalido" }).success).toBe(false);
    });

    it("debe validar un payload de actualización válido", () => {
      const payload = {
        nombre: "Camioneta Rescate 4x4 - Actualizada",
        cantidadInventario: 1,
        cantidadMinima: 0,
        enMantencion: true,
        latitud: -39.8142,
        longitud: -73.2459,
        descripcion: "En taller por mantención correctiva",
        detalles: { patente: "ABCD-12", kilometraje: 48000 },
        delegacionId: "30000000-0000-4000-8000-000000000001",
      };

      const res = ActualizarRecursoInputSchema.safeParse(payload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.enMantencion).toBe(true);
        expect(res.data.nombre).toBe("Camioneta Rescate 4x4 - Actualizada");
      }
    });

    it("debe rechazar nombres demasiado cortos (< 3 caracteres)", () => {
      const payload = {
        nombre: "AB",
        cantidadInventario: 10,
        cantidadMinima: 2,
        latitud: -39.8142,
        longitud: -73.2459,
      };

      expect(ActualizarRecursoInputSchema.safeParse(payload).success).toBe(false);
    });

    it("debe rechazar cantidades negativas en la actualización", () => {
      const payload = {
        nombre: "Generador 5kVA",
        cantidadInventario: -5,
        latitud: -39.8142,
        longitud: -73.2459,
      };

      expect(ActualizarRecursoInputSchema.safeParse(payload).success).toBe(false);
    });
  });

  describe("6. Servicio de Detalle de Recurso (obtenerRecursoDetalle)", () => {
    const adminId = "00000000-0000-4000-8000-000000000001";
    const recursoId = "40000000-0000-4000-8000-000000000001";

    it("debe arrojar UnauthorizedError si usuarioId está ausente", async () => {
      await expect(obtenerRecursoDetalle(recursoId, null)).rejects.toThrow(UnauthorizedError);
    });

    it("debe arrojar NotFoundError si el recurso no existe", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: adminId,
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(recursoRepository, "obtenerRecursoPorId").mockResolvedValueOnce(null);

      await expect(obtenerRecursoDetalle(recursoId, adminId)).rejects.toThrow(NotFoundError);
    });

    it("debe retornar la información completa pre-cargada del recurso", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: adminId,
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(recursoRepository, "obtenerRecursoPorId").mockResolvedValueOnce({
        id: recursoId,
        nombre: "Camioneta Rescate 4x4",
        es_individual: true,
        estado: "DISPONIBLE" as const,
        cantidad_inventario: 1,
        cantidad_en_uso: 0,
        cantidad_minima: 0,
        latitud: -39.8142,
        longitud: -73.2459,
        descripcion: "Unidad operativa",
        detalles: { patente: "ABCD-12" },
        delegacion_id: "30000000-0000-4000-8000-000000000001",
        delegacion_codigo: "DEL_NORTE",
        delegacion_nombre: "Delegación Municipal Norte",
        creado_por_id: adminId,
        actualizado_por_id: null,
        creado_en: new Date("2026-09-17T10:00:00Z"),
        actualizado_en: new Date("2026-09-17T10:00:00Z"),
      } as unknown as Awaited<ReturnType<typeof recursoRepository.obtenerRecursoPorId>>);

      const detalle = await obtenerRecursoDetalle(recursoId, adminId);
      expect(detalle.id).toBe(recursoId);
      expect(detalle.nombre).toBe("Camioneta Rescate 4x4");
      expect(detalle.tipo).toBe("Vehículo o Maquinaria");
      expect(detalle.estado).toBe("DISPONIBLE");
      expect(detalle.cantidadDisponible).toBe(1);
      expect(detalle.delegacion?.codigo).toBe("DEL_NORTE");
    });
  });

  describe("7. Servicio de Edición de Recurso (editarRecurso)", () => {
    const adminId = "00000000-0000-4000-8000-000000000001";
    const recursoId = "40000000-0000-4000-8000-000000000001";

    it("debe arrojar UnauthorizedError si usuarioId está ausente", async () => {
      const input = {
        nombre: "Sacos de Arena",
        cantidadInventario: 300,
        cantidadMinima: 50,
        enMantencion: false,
        latitud: -39.8142,
        longitud: -73.2459,
        detalles: {},
      };

      await expect(editarRecurso(recursoId, input, null)).rejects.toThrow(UnauthorizedError);
    });

    it("debe arrojar NotFoundError si el recurso no existe", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: adminId,
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(recursoRepository, "obtenerRecursoPorId").mockResolvedValueOnce(null);

      const input = {
        nombre: "Sacos de Arena",
        cantidadInventario: 300,
        cantidadMinima: 50,
        enMantencion: false,
        latitud: -39.8142,
        longitud: -73.2459,
        detalles: {},
      };

      await expect(editarRecurso(recursoId, input, adminId)).rejects.toThrow(NotFoundError);
    });

    it("debe arrojar BadRequestError si se intenta reducir la cantidad en inventario por debajo de lo en uso", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: adminId,
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(recursoRepository, "obtenerRecursoPorId").mockResolvedValueOnce({
        id: recursoId,
        nombre: "Sacos de Arena",
        es_individual: false,
        estado: "DISPONIBLE" as const,
        cantidad_inventario: 100,
        cantidad_en_uso: 60, // 60 sacos actualmente en terreno
        cantidad_minima: 10,
        latitud: -39.8142,
        longitud: -73.2459,
        descripcion: null,
        detalles: {},
        delegacion_id: null,
        creado_por_id: adminId,
        actualizado_por_id: null,
        creado_en: new Date(),
        actualizado_en: new Date(),
      } as unknown as Awaited<ReturnType<typeof recursoRepository.obtenerRecursoPorId>>);

      const input = {
        nombre: "Sacos de Arena",
        cantidadInventario: 40, // Intento de bajar a 40 cuando 60 están en uso
        cantidadMinima: 10,
        enMantencion: false,
        latitud: -39.8142,
        longitud: -73.2459,
        detalles: {},
      };

      await expect(editarRecurso(recursoId, input, adminId)).rejects.toThrow(
        /por debajo de las unidades actualmente en uso/
      );
    });

    it("debe forzar estado EN_MANTENCION cuando enMantencion es true", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: adminId,
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(recursoRepository, "obtenerRecursoPorId")
        .mockResolvedValueOnce({
          id: recursoId,
          nombre: "Camioneta 4x4",
          es_individual: true,
          estado: "DISPONIBLE" as const,
          cantidad_inventario: 1,
          cantidad_en_uso: 0,
          cantidad_minima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: null,
          detalles: { patente: "ABCD-12" },
          delegacion_id: null,
          creado_por_id: adminId,
          actualizado_por_id: null,
          creado_en: new Date(),
          actualizado_en: new Date(),
        } as unknown as Awaited<ReturnType<typeof recursoRepository.obtenerRecursoPorId>>)
        .mockResolvedValueOnce({
          id: recursoId,
          nombre: "Camioneta 4x4",
          es_individual: true,
          estado: "EN_MANTENCION" as const,
          cantidad_inventario: 1,
          cantidad_en_uso: 0,
          cantidad_minima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: null,
          detalles: { patente: "ABCD-12" },
          delegacion_id: null,
          creado_por_id: adminId,
          actualizado_por_id: adminId,
          creado_en: new Date(),
          actualizado_en: new Date(),
        } as unknown as Awaited<ReturnType<typeof recursoRepository.obtenerRecursoPorId>>);

      const actualizarSpy = vi.spyOn(recursoRepository, "actualizarRecurso").mockResolvedValueOnce(
        {} as unknown as Awaited<ReturnType<typeof recursoRepository.actualizarRecurso>>
      );

      const input = {
        nombre: "Camioneta 4x4",
        cantidadInventario: 1,
        cantidadMinima: 0,
        enMantencion: true,
        latitud: -39.8142,
        longitud: -73.2459,
        detalles: { patente: "ABCD-12" },
      };

      const resultado = await editarRecurso(recursoId, input, adminId);

      expect(actualizarSpy).toHaveBeenCalledWith(
        recursoId,
        expect.objectContaining({
          estado: "EN_MANTENCION",
          actualizado_por_id: adminId,
        })
      );
      expect(resultado.estado).toBe("EN_MANTENCION");
      expect(resultado.actualizadoPorId).toBe(adminId);
    });

    it("debe rechazar con BadRequestError si se intenta marcar en mantención un recurso a granel (es_individual: false)", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: adminId,
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(recursoRepository, "obtenerRecursoPorId").mockResolvedValueOnce({
        id: recursoId,
        nombre: "Sacos de Arena",
        es_individual: false,
        estado: "DISPONIBLE" as const,
        cantidad_inventario: 100,
        cantidad_en_uso: 10,
        cantidad_minima: 20,
        latitud: -39.8142,
        longitud: -73.2459,
        descripcion: null,
        detalles: {},
        delegacion_id: null,
        creado_por_id: adminId,
        actualizado_por_id: null,
        creado_en: new Date(),
        actualizado_en: new Date(),
      } as unknown as Awaited<ReturnType<typeof recursoRepository.obtenerRecursoPorId>>);

      const input = {
        nombre: "Sacos de Arena",
        cantidadInventario: 100,
        cantidadMinima: 20,
        enMantencion: true,
        latitud: -39.8142,
        longitud: -73.2459,
      };

      await expect(editarRecurso(recursoId, input, adminId)).rejects.toThrow(
        "Los materiales o recursos a granel no admiten estado de mantenimiento técnico."
      );
    });

    it("debe pasar a NO_DISPONIBLE cuando la cantidad en inventario es 0", async () => {
      vi.spyOn(seguridadService, "validarAccesoAdministrador").mockResolvedValueOnce({
        id: adminId,
        rut: "11111111-1",
        nombre: "Admin",
        email: "admin@valdivia.cl",
        rolId: "20000000-0000-4000-8000-000000000001",
        rolNombre: "Administrador",
        activo: true,
      });

      vi.spyOn(recursoRepository, "obtenerRecursoPorId")
        .mockResolvedValueOnce({
          id: recursoId,
          nombre: "Frazadas Térmicas",
          es_individual: false,
          estado: "DISPONIBLE" as const,
          cantidad_inventario: 50,
          cantidad_en_uso: 0,
          cantidad_minima: 10,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: null,
          detalles: {},
          delegacion_id: null,
          creado_por_id: adminId,
          actualizado_por_id: null,
          creado_en: new Date(),
          actualizado_en: new Date(),
        } as unknown as Awaited<ReturnType<typeof recursoRepository.obtenerRecursoPorId>>)
        .mockResolvedValueOnce({
          id: recursoId,
          nombre: "Frazadas Térmicas",
          es_individual: false,
          estado: "NO_DISPONIBLE" as const,
          cantidad_inventario: 0,
          cantidad_en_uso: 0,
          cantidad_minima: 10,
          latitud: -39.8142,
          longitud: -73.2459,
          descripcion: null,
          detalles: {},
          delegacion_id: null,
          creado_por_id: adminId,
          actualizado_por_id: adminId,
          creado_en: new Date(),
          actualizado_en: new Date(),
        } as unknown as Awaited<ReturnType<typeof recursoRepository.obtenerRecursoPorId>>);

      const actualizarSpy = vi.spyOn(recursoRepository, "actualizarRecurso").mockResolvedValueOnce(
        {} as unknown as Awaited<ReturnType<typeof recursoRepository.actualizarRecurso>>
      );

      const input = {
        nombre: "Frazadas Térmicas",
        cantidadInventario: 0, // Inventario agotado a 0
        cantidadMinima: 10,
        enMantencion: false,
        latitud: -39.8142,
        longitud: -73.2459,
        detalles: {},
      };

      const resultado = await editarRecurso(recursoId, input, adminId);

      expect(actualizarSpy).toHaveBeenCalledWith(
        recursoId,
        expect.objectContaining({
          estado: "NO_DISPONIBLE",
          cantidad_inventario: 0,
        })
      );
      expect(resultado.estado).toBe("NO_DISPONIBLE");
    });
  });
});

