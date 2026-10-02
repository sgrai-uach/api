import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as puntoCriticoService from "@/modules/eventos-atp/punto-critico.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/errors";

describe("Route Handlers /api/puntos-criticos (HU-57)", () => {
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
});
