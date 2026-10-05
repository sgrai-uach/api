import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import * as puntoCriticoService from "@/modules/eventos-atp/punto-critico.service";
import {
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
} from "@/modules/seguridad/errors";

describe("Route Handlers /api/puntos-criticos (HU-57, HU-58)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/puntos-criticos", () => {
    it("debe responder 401 si no se envía cabecera de autenticación", async () => {
      vi.spyOn(puntoCriticoService, "listarPuntosCriticos").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      const req = new NextRequest("http://localhost:3000/api/puntos-criticos");
      const res = await GET(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("autenticación");
    });

    it("debe responder 403 si el usuario no tiene rol de Administrador", async () => {
      vi.spyOn(puntoCriticoService, "listarPuntosCriticos").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      const req = new NextRequest("http://localhost:3000/api/puntos-criticos", {
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000002" },
      });
      const res = await GET(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Administrador");
    });

    it("debe responder 400 si los parámetros de consulta son inválidos", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/puntos-criticos?pagina=-1&limite=200",
        {
          headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
        }
      );
      const res = await GET(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("Parámetros de consulta inválidos.");
      expect(body.errors).toBeDefined();
    });

    it("debe responder 200 con listado vacío si la base de datos no contiene registros (Criterio 3)", async () => {
      vi.spyOn(puntoCriticoService, "listarPuntosCriticos").mockResolvedValueOnce({
        data: [],
        meta: {
          total: 0,
          pagina: 1,
          limite: 10,
          totalPaginas: 0,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/puntos-criticos", {
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it("debe responder 200 con listado de puntos críticos y metadatos", async () => {
      vi.spyOn(puntoCriticoService, "listarPuntosCriticos").mockResolvedValueOnce({
        data: [
          {
            id: "40000000-0000-4000-8000-000000000001",
            codigo: "PC-ANG-01",
            nombre: "Sector Humedal Angachilla",
            descripcion: "Zona baja con riesgo de anegamiento",
            tipoRiesgo: "Inundación",
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
          },
        ],
        meta: {
          total: 1,
          pagina: 1,
          limite: 10,
          totalPaginas: 1,
        },
      });

      const req = new NextRequest(
        "http://localhost:3000/api/puntos-criticos?pagina=1&limite=10",
        {
          headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
        }
      );
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].codigo).toBe("PC-ANG-01");
      expect(body.meta.total).toBe(1);
    });
  });

  describe("POST /api/puntos-criticos (HU-58)", () => {
    const adminId = "00000000-0000-4000-8000-000000000001";
    const payloadValido = {
      nombre: "Sector Miraflores - Humedal",
      descripcion: "Anegamiento recurrente en invierno",
      tipoRiesgo: "Inundación y anegamiento",
      prioridad: "ALTA",
      delegacionId: "30000000-0000-4000-8000-000000000001",
      latitud: -39.835,
      longitud: -73.245,
    };

    it("debe responder 401 si no se envía cabecera de autenticación", async () => {
      vi.spyOn(puntoCriticoService, "crearPuntoCritico").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      const req = new NextRequest("http://localhost:3000/api/puntos-criticos", {
        method: "POST",
        body: JSON.stringify(payloadValido),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("autenticación");
    });

    it("debe responder 403 si un usuario sin rol de Administrador intenta crear un punto crítico", async () => {
      vi.spyOn(puntoCriticoService, "crearPuntoCritico").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      const req = new NextRequest("http://localhost:3000/api/puntos-criticos", {
        method: "POST",
        headers: {
          "x-user-id": "00000000-0000-4000-8000-000000000007", // Informante
        },
        body: JSON.stringify(payloadValido),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Administrador");
    });

    it("debe responder 400 si el body enviado no es JSON válido", async () => {
      const req = new NextRequest("http://localhost:3000/api/puntos-criticos", {
        method: "POST",
        headers: { "x-user-id": adminId },
        body: "invalid-json{",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("JSON válido");
    });

    it("debe responder 400 si la validación de Zod falla (ej. faltan coordenadas o nombre inválido)", async () => {
      const req = new NextRequest("http://localhost:3000/api/puntos-criticos", {
        method: "POST",
        headers: { "x-user-id": adminId },
        body: JSON.stringify({
          nombre: "AB", // muy corto
          // latitud y longitud omitidas
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("Datos de creación de punto crítico inválidos.");
      expect(body.errors).toBeDefined();
    });

    it("debe responder 400 si el servicio lanza BadRequestError por delegación inexistente", async () => {
      vi.spyOn(puntoCriticoService, "crearPuntoCritico").mockRejectedValueOnce(
        new BadRequestError("La delegación territorial no existe en el sistema.")
      );

      const req = new NextRequest("http://localhost:3000/api/puntos-criticos", {
        method: "POST",
        headers: { "x-user-id": adminId },
        body: JSON.stringify(payloadValido),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("delegación territorial no existe");
    });

    it("debe responder 409 si el servicio lanza ConflictError por código duplicado", async () => {
      vi.spyOn(puntoCriticoService, "crearPuntoCritico").mockRejectedValueOnce(
        new ConflictError("El código de punto crítico ya se encuentra registrado.")
      );

      const req = new NextRequest("http://localhost:3000/api/puntos-criticos", {
        method: "POST",
        headers: { "x-user-id": adminId },
        body: JSON.stringify(payloadValido),
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.message).toContain("código de punto crítico ya se encuentra");
    });

    it("debe responder 201 Created si la creación es exitosa y retornar el punto creado", async () => {
      const puntoCreadoMock = {
        id: "40000000-0000-4000-8000-000000000099",
        codigo: "PC-SUR-001",
        nombre: payloadValido.nombre,
        descripcion: payloadValido.descripcion,
        tipoRiesgo: payloadValido.tipoRiesgo,
        prioridad: payloadValido.prioridad as "ALTA",
        activo: true,
        estadoTexto: "Activo",
        latitud: payloadValido.latitud,
        longitud: payloadValido.longitud,
        delegacion: {
          id: payloadValido.delegacionId,
          codigo: "DEL-SUR",
          nombre: "Delegación Municipal Sur",
        },
        creadoEn: "2026-10-05T00:00:00.000Z",
        creadoPorId: adminId,
      };

      vi.spyOn(puntoCriticoService, "crearPuntoCritico").mockResolvedValueOnce(puntoCreadoMock);

      const req = new NextRequest("http://localhost:3000/api/puntos-criticos", {
        method: "POST",
        headers: { "x-user-id": adminId },
        body: JSON.stringify(payloadValido),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe("40000000-0000-4000-8000-000000000099");
      expect(body.codigo).toBe("PC-SUR-001");
      expect(body.nombre).toBe(payloadValido.nombre);
      expect(body.creadoPorId).toBe(adminId);
    });
  });
});
