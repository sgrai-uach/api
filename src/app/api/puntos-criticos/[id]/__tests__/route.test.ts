import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PUT } from "../route";
import * as puntoCriticoService from "@/modules/eventos-atp/punto-critico.service";
import type { PuntoCriticoDetalleResponse } from "@/modules/eventos-atp/punto-critico.schema";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";

describe("Route Handlers /api/puntos-criticos/[id] (HU-55)", () => {
  const puntoIdValido = "40000000-0000-4000-8000-000000000001";
  const contextValido = { params: Promise.resolve({ id: puntoIdValido }) };

  const detalleMock: PuntoCriticoDetalleResponse = {
    id: puntoIdValido,
    codigo: "PC-ANG-01",
    nombre: "Sector Humedal Angachilla",
    descripcion: "Zona baja con riesgo de anegamiento",
    tipoRiesgo: "Inundación fluvial",
    prioridad: "ALTA",
    activo: true,
    estadoTexto: "Activo",
    latitud: -39.8456,
    longitud: -73.2389,
    delegacion: {
      id: "30000000-0000-4000-8000-000000000001",
      codigo: "DEL-SUR",
      nombre: "Delegación Municipal Sur",
    },
    creadoEn: "2026-06-15T12:00:00.000Z",
    actualizadoEn: "2026-10-04T19:00:00.000Z",
    actualizadoPorId: "00000000-0000-4000-8000-000000000001",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/puntos-criticos/[id]", () => {
    it("debe responder 400 si el parámetro id no es un UUID válido", async () => {
      const contextInvalido = { params: Promise.resolve({ id: "id-invalido" }) };
      const req = new NextRequest("http://localhost:3000/api/puntos-criticos/id-invalido");
      const res = await GET(req, contextInvalido);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Identificador de punto crítico inválido");
    });

    it("debe responder 401 si no está autenticado", async () => {
      vi.spyOn(puntoCriticoService, "obtenerDetallePuntoCritico").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`);
      const res = await GET(req, contextValido);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("autenticación");
    });

    it("debe responder 403 si el usuario no tiene rol de Administrador", async () => {
      vi.spyOn(puntoCriticoService, "obtenerDetallePuntoCritico").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        headers: { "x-user-id": "usuario-no-admin" },
      });
      const res = await GET(req, contextValido);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Administrador");
    });

    it("debe responder 404 si el punto crítico no existe", async () => {
      vi.spyOn(puntoCriticoService, "obtenerDetallePuntoCritico").mockRejectedValueOnce(
        new NotFoundError("Punto crítico no encontrado.")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await GET(req, contextValido);

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toContain("no encontrado");
    });

    it("debe responder 200 con el detalle completo para precarga", async () => {
      vi.spyOn(puntoCriticoService, "obtenerDetallePuntoCritico").mockResolvedValueOnce(detalleMock);

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await GET(req, contextValido);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(puntoIdValido);
      expect(body.codigo).toBe("PC-ANG-01");
      expect(body.delegacion.nombre).toBe("Delegación Municipal Sur");
    });
  });

  describe("PUT /api/puntos-criticos/[id]", () => {
    const payloadValido = {
      nombre: "Sector Humedal Angachilla - Actualizado",
      descripcion: "Monitoreo reforzado de caudal invernal",
      tipoRiesgo: "Anegamiento fluvial",
      prioridad: "CRITICA" as const,
      delegacionId: "30000000-0000-4000-8000-000000000001",
      latitud: -39.8456,
      longitud: -73.2389,
    };

    it("debe responder 400 si el parámetro id de ruta es inválido", async () => {
      const contextInvalido = { params: Promise.resolve({ id: "id-invalido" }) };
      const req = new NextRequest("http://localhost:3000/api/puntos-criticos/id-invalido", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify(payloadValido),
      });

      const res = await PUT(req, contextInvalido);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Identificador de punto crítico inválido");
    });

    it("debe responder 400 si el cuerpo no es un JSON válido", async () => {
      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: "invalid-json",
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("JSON válido");
    });

    it("debe responder 400 si faltan campos obligatorios o la latitud está fuera de rango", async () => {
      const payloadInvalido = {
        nombre: "Sector",
        prioridad: "ALTA",
        latitud: 120.0, // Inválido (> 90)
        longitud: -73.2,
      };

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify(payloadInvalido),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Parámetros de edición");
    });

    it("debe responder 401 si el usuario no proporciona cabecera de autenticación", async () => {
      vi.spyOn(puntoCriticoService, "editarPuntoCritico").mockRejectedValueOnce(
        new UnauthorizedError("No autorizado.")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadValido),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(401);
    });

    it("debe responder 403 si el usuario no tiene permisos de administrador", async () => {
      vi.spyOn(puntoCriticoService, "editarPuntoCritico").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere perfil de Administrador.")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000002",
        },
        body: JSON.stringify(payloadValido),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(403);
    });

    it("debe responder 404 si el punto crítico no existe", async () => {
      vi.spyOn(puntoCriticoService, "editarPuntoCritico").mockRejectedValueOnce(
        new NotFoundError("Punto crítico no encontrado.")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify(payloadValido),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(404);
    });

    it("debe responder 409 si el punto crítico se encuentra desactivado del sistema", async () => {
      vi.spyOn(puntoCriticoService, "editarPuntoCritico").mockRejectedValueOnce(
        new ConflictError("No es posible editar el punto crítico porque se encuentra desactivado del sistema.")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify(payloadValido),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.message).toContain("desactivado");
    });

    it("debe responder 200 con el punto crítico actualizado exitosamente", async () => {
      const actualizadoMock = {
        ...detalleMock,
        nombre: payloadValido.nombre,
        prioridad: payloadValido.prioridad,
      };
      vi.spyOn(puntoCriticoService, "editarPuntoCritico").mockResolvedValueOnce(actualizadoMock);

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${puntoIdValido}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-user-id": "00000000-0000-4000-8000-000000000001",
        },
        body: JSON.stringify(payloadValido),
      });

      const res = await PUT(req, contextValido);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.nombre).toBe(payloadValido.nombre);
      expect(body.prioridad).toBe(payloadValido.prioridad);
      expect(body.codigo).toBe("PC-ANG-01");
    });
  });
});
