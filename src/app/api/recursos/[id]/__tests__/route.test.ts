import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "../route";
import * as recursoService from "@/modules/recursos-y-personal/recurso.service";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "@/modules/seguridad/errors";

describe("Route Handlers /api/recursos/[id] (HU-8)", () => {
  const recursoIdValido = "40000000-0000-4000-8000-000000000001";
  const contextValido = { params: Promise.resolve({ id: recursoIdValido }) };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/recursos/[id]", () => {
    it("debe responder 400 si el parámetro id no es un UUID válido", async () => {
      const contextInvalido = { params: Promise.resolve({ id: "id-invalido" }) };
      const req = new NextRequest("http://localhost:3000/api/recursos/id-invalido");
      const res = await GET(req, contextInvalido);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Identificador de recurso inválido");
    });

    it("debe responder 401 si no está autenticado", async () => {
      vi.spyOn(recursoService, "obtenerRecursoDetalle").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`);
      const res = await GET(req, contextValido);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("autenticación");
    });

    it("debe responder 403 si el usuario no tiene rol de Administrador", async () => {
      vi.spyOn(recursoService, "obtenerRecursoDetalle").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        headers: { "x-user-id": "usuario-no-admin" },
      });
      const res = await GET(req, contextValido);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Administrador");
    });

    it("debe responder 404 si el recurso no existe", async () => {
      vi.spyOn(recursoService, "obtenerRecursoDetalle").mockRejectedValueOnce(
        new NotFoundError(`Recurso con ID '${recursoIdValido}' no encontrado.`)
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await GET(req, contextValido);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toContain("no encontrado");
    });

    it("debe responder 200 con el detalle del recurso pre-cargado para edición", async () => {
      const mockDetalle = {
        id: recursoIdValido,
        nombre: "Camioneta Rescate 4x4",
        tipo: "Vehículo o Maquinaria",
        esIndividual: true,
        estado: "DISPONIBLE" as const,
        cantidadInventario: 1,
        cantidadEnUso: 0,
        cantidadDisponible: 1,
        cantidadMinima: 0,
        latitud: -39.8142,
        longitud: -73.2459,
        descripcion: "Unidad rápida",
        detalles: { patente: "ABCD-12" },
        delegacion: {
          id: "30000000-0000-4000-8000-000000000001",
          codigo: "DEL_NORTE",
          nombre: "Delegación Municipal Norte",
        },
        delegacionId: "30000000-0000-4000-8000-000000000001",
        creadoPorId: "00000000-0000-4000-8000-000000000001",
        actualizadoPorId: null,
        creadoEn: "2026-09-17T10:00:00.000Z",
        actualizadoEn: "2026-09-17T10:00:00.000Z",
      };

      vi.spyOn(recursoService, "obtenerRecursoDetalle").mockResolvedValueOnce(mockDetalle);

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await GET(req, contextValido);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(recursoIdValido);
      expect(body.nombre).toBe("Camioneta Rescate 4x4");
      expect(body.delegacion.codigo).toBe("DEL_NORTE");
    });
  });

  describe("PUT /api/recursos/[id]", () => {
    it("debe responder 400 si el parámetro id no es un UUID válido", async () => {
      const contextInvalido = { params: Promise.resolve({ id: "id-invalido" }) };
      const req = new NextRequest("http://localhost:3000/api/recursos/id-invalido", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: "Prueba" }),
      });
      const res = await PUT(req, contextInvalido);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Identificador de recurso inválido");
    });

    it("debe responder 400 si el cuerpo no es un JSON válido", async () => {
      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "PUT",
        body: "cuerpo-no-json",
      });
      const res = await PUT(req, contextValido);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("JSON válido");
    });

    it("debe responder 400 si la validación Zod falla", async () => {
      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: "AB", // Menor a 3 caracteres
          cantidadInventario: -1, // Negativo
        }),
      });
      const res = await PUT(req, contextValido);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Datos de entrada inválidos");
      expect(Array.isArray(body.errors)).toBe(true);
    });

    it("debe responder 400 si el inventario se intenta reducir por debajo de lo en uso", async () => {
      vi.spyOn(recursoService, "editarRecurso").mockRejectedValueOnce(
        new BadRequestError("No es posible reducir la cantidad en inventario por debajo de las unidades en uso.")
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify({
          nombre: "Sacos de Arena",
          cantidadInventario: 10,
          cantidadMinima: 5,
          latitud: -39.8142,
          longitud: -73.2459,
        }),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("unidades en uso");
    });

    it("debe responder 400 si se intenta asignar mantención a un recurso a granel", async () => {
      vi.spyOn(recursoService, "editarRecurso").mockRejectedValueOnce(
        new BadRequestError("Los materiales o recursos a granel no admiten estado de mantenimiento técnico.")
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify({
          nombre: "Sacos de Arena",
          cantidadInventario: 10,
          cantidadMinima: 5,
          enMantencion: true,
          latitud: -39.8142,
          longitud: -73.2459,
        }),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("recursos a granel no admiten estado de mantenimiento");
    });

    it("debe responder 401 si el usuario no envía cabecera de autenticación", async () => {
      vi.spyOn(recursoService, "editarRecurso").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: "Camioneta Rescate 4x4",
          cantidadInventario: 1,
          cantidadMinima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
        }),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("autenticación");
    });

    it("debe responder 404 si el recurso no existe", async () => {
      vi.spyOn(recursoService, "editarRecurso").mockRejectedValueOnce(
        new NotFoundError(`Recurso con ID '${recursoIdValido}' no encontrado.`)
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify({
          nombre: "Camioneta Rescate 4x4",
          cantidadInventario: 1,
          cantidadMinima: 0,
          latitud: -39.8142,
          longitud: -73.2459,
        }),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toContain("no encontrado");
    });

    it("debe responder 200 y retornar el recurso actualizado con notificación", async () => {
      const mockActualizado = {
        id: recursoIdValido,
        nombre: "Camioneta Rescate 4x4 - Actualizada",
        tipo: "Vehículo o Maquinaria",
        esIndividual: true,
        estado: "EN_MANTENCION" as const,
        cantidadInventario: 1,
        cantidadEnUso: 0,
        cantidadDisponible: 1,
        cantidadMinima: 0,
        latitud: -39.8142,
        longitud: -73.2459,
        descripcion: "En mantenimiento preventivo",
        detalles: { patente: "ABCD-12", kilometraje: 49000 },
        delegacion: {
          id: "30000000-0000-4000-8000-000000000001",
          codigo: "DEL_NORTE",
          nombre: "Delegación Municipal Norte",
        },
        delegacionId: "30000000-0000-4000-8000-000000000001",
        creadoPorId: "00000000-0000-4000-8000-000000000001",
        actualizadoPorId: "00000000-0000-4000-8000-000000000001",
        creadoEn: "2026-09-17T10:00:00.000Z",
        actualizadoEn: "2026-09-29T16:00:00.000Z",
      };

      vi.spyOn(recursoService, "editarRecurso").mockResolvedValueOnce(mockActualizado);

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify({
          nombre: "Camioneta Rescate 4x4 - Actualizada",
          cantidadInventario: 1,
          cantidadMinima: 0,
          enMantencion: true,
          latitud: -39.8142,
          longitud: -73.2459,
          detalles: { patente: "ABCD-12", kilometraje: 49000 },
        }),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Recurso actualizado exitosamente");
      expect(body.data.nombre).toBe("Camioneta Rescate 4x4 - Actualizada");
      expect(body.data.estado).toBe("EN_MANTENCION");
      expect(body.data.actualizadoPorId).toBe("00000000-0000-4000-8000-000000000001");
    });
  });

  describe("DELETE /api/recursos/[id]", () => {
    it("debe responder 400 si el parámetro id no es un UUID válido", async () => {
      const contextInvalido = { params: Promise.resolve({ id: "id-invalido" }) };
      const req = new NextRequest("http://localhost:3000/api/recursos/id-invalido", {
        method: "DELETE",
      });
      const res = await DELETE(req, contextInvalido);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Identificador de recurso inválido");
    });

    it("debe responder 401 si no está autenticado", async () => {
      vi.spyOn(recursoService, "eliminarRecurso").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "DELETE",
      });
      const res = await DELETE(req, contextValido);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("autenticación");
    });

    it("debe responder 403 si el usuario no tiene rol de Administrador", async () => {
      vi.spyOn(recursoService, "eliminarRecurso").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "DELETE",
        headers: { "x-user-id": "usuario-no-admin" },
      });
      const res = await DELETE(req, contextValido);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Administrador");
    });

    it("debe responder 404 si el recurso no existe o ya fue eliminado", async () => {
      vi.spyOn(recursoService, "eliminarRecurso").mockRejectedValueOnce(
        new NotFoundError(`Recurso con ID '${recursoIdValido}' no encontrado.`)
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "DELETE",
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await DELETE(req, contextValido);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toContain("no encontrado");
    });

    it("debe responder 409 Conflict si el recurso está en uso en terreno o asignado a misiones activas", async () => {
      vi.spyOn(recursoService, "eliminarRecurso").mockRejectedValueOnce(
        new ConflictError(
          "No es posible eliminar el recurso 'Camioneta 4x4' porque se encuentra actualmente asignado a una misión activa o cuadrilla en terreno."
        )
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "DELETE",
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await DELETE(req, contextValido);

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.message).toContain("No es posible eliminar el recurso");
    });

    it("debe responder 200 con la confirmación del borrado lógico", async () => {
      vi.spyOn(recursoService, "eliminarRecurso").mockResolvedValueOnce({
        message: "Recurso dado de baja exitosamente del inventario.",
        id: recursoIdValido,
        nombre: "Pala Cuadrada",
        eliminadoEn: "2026-09-30T19:30:00.000Z",
        eliminadoPorId: "00000000-0000-4000-8000-000000000001",
      });

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "DELETE",
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await DELETE(req, contextValido);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain("Recurso dado de baja exitosamente");
      expect(body.id).toBe(recursoIdValido);
      expect(body.eliminadoPorId).toBe("00000000-0000-4000-8000-000000000001");
    });

    it("debe responder 500 ante error interno inesperado", async () => {
      vi.spyOn(recursoService, "eliminarRecurso").mockRejectedValueOnce(
        new Error("Fallo de conexión en base de datos")
      );

      const req = new NextRequest(`http://localhost:3000/api/recursos/${recursoIdValido}`, {
        method: "DELETE",
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await DELETE(req, contextValido);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.message).toContain("Error interno del servidor");
    });
  });
});

