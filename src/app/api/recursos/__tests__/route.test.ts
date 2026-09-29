import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import * as recursoService from "@/modules/recursos-y-personal/recurso.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/errors";

describe("Route Handlers /api/recursos", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/recursos", () => {
    it("debe responder 401 si no se envía cabecera de autenticación", async () => {
      vi.spyOn(recursoService, "listarRecursos").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      const req = new NextRequest("http://localhost:3000/api/recursos");
      const res = await GET(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("autenticación");
    });

    it("debe responder 403 si el usuario no tiene rol de Administrador", async () => {
      vi.spyOn(recursoService, "listarRecursos").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      const req = new NextRequest("http://localhost:3000/api/recursos", {
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000002" },
      });
      const res = await GET(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Administrador");
    });

    it("debe responder 400 si los parámetros de consulta son inválidos", async () => {
      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=-1&limite=200", {
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await GET(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("Parámetros de consulta inválidos.");
    });

    it("debe responder 200 con listado paginado y metadatos", async () => {
      vi.spyOn(recursoService, "listarRecursos").mockResolvedValueOnce({
        data: [],
        meta: {
          total: 0,
          pagina: 1,
          limite: 10,
          totalPaginas: 0,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/recursos?pagina=1&limite=10", {
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
      });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.meta).toEqual({
        total: 0,
        pagina: 1,
        limite: 10,
        totalPaginas: 0,
      });
    });
  });

  describe("POST /api/recursos", () => {
    it("debe responder 400 si el cuerpo no es un JSON válido", async () => {
      const req = new NextRequest("http://localhost:3000/api/recursos", {
        method: "POST",
        body: "esto no es json",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("JSON válido");
    });

    it("debe responder 400 si faltan campos obligatorios en el esquema", async () => {
      const req = new NextRequest("http://localhost:3000/api/recursos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: "AB", // Demasiado corto
          cantidadInventario: -1, // Negativo
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toBe("Datos de entrada inválidos.");
      expect(Array.isArray(body.errors)).toBe(true);
      expect(body.errors.length).toBeGreaterThan(0);
    });

    it("debe responder 401 si no se envía la cabecera X-User-Id", async () => {
      vi.spyOn(recursoService, "crearRecurso").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      const req = new NextRequest("http://localhost:3000/api/recursos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: "Generador 5kVA",
          cantidadInventario: 1,
          latitud: -39.8142,
          longitud: -73.2459,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("X-User-Id");
    });
  });
});
