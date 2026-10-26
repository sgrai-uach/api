import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as cuadrillaService from "@/modules/recursos-y-personal/cuadrilla.service";
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/modules/seguridad/errors";

describe("Route Handlers /api/cuadrillas (GET / POST)", () => {
  const usuarioAdminId = "00000000-0000-4000-8000-000000000001";
  const cuadrillaIdMock = "50000000-0000-4000-8000-000000000001";

  const cuadrillaMock = {
    id: cuadrillaIdMock,
    nombre: "Cuadrilla Vías y Calles",
    estado: "DISPONIBLE" as const,
    delegacion: {
      id: "30000000-0000-4000-8000-000000000001",
      nombre: "Delegación Municipal Calle Calle",
    },
    delegado: {
      id: "00000000-0000-4000-8000-000000000005",
      nombre: "Carlos Operativo",
      email: "carlos@valdivia.cl",
      rut: "15.123.456-7",
    },
    recursos: [],
    trabajadores: [],
    totalRecursos: 0,
    totalTrabajadores: 0,
    creadoEn: "2026-10-24T12:00:00.000Z",
    actualizadoEn: null,
  };

  const payloadCrearValido = {
    nombre: "Cuadrilla Vías y Calles",
    delegacionId: "30000000-0000-4000-8000-000000000001",
    usuarioDelegadoId: "00000000-0000-4000-8000-000000000005",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/cuadrillas", () => {
    it("debe retornar 200 OK con el listado paginado de cuadrillas", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
      vi.spyOn(cuadrillaService, "listarCuadrillas").mockResolvedValue({
        message: "Listado de cuadrillas obtenido exitosamente",
        data: [cuadrillaMock],
        meta: {
          total: 1,
          pagina: 1,
          limite: 10,
          paginasTotales: 1,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/cuadrillas?pagina=1&limite=10&busqueda=Vias");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.message).toBe("Listado de cuadrillas obtenido exitosamente");
      expect(data.data).toHaveLength(1);
      expect(data.meta.total).toBe(1);
    });

    it("debe retornar 400 Bad Request si los parámetros de query son inválidos", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);

      const req = new NextRequest("http://localhost:3000/api/cuadrillas?delegacionId=invalido");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("Parámetros de consulta inválidos.");
    });

    it("debe retornar 401 si no está autenticado", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValue(
        new UnauthorizedError("Token no válido")
      );

      const req = new NextRequest("http://localhost:3000/api/cuadrillas");
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("debe retornar 403 si el usuario no tiene permisos de lectura", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue("user-sin-permisos");
      vi.spyOn(cuadrillaService, "listarCuadrillas").mockRejectedValue(
        new ForbiddenError("Acceso denegado")
      );

      const req = new NextRequest("http://localhost:3000/api/cuadrillas");
      const res = await GET(req);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/cuadrillas", () => {
    it("debe retornar 201 Created al dar de alta una cuadrilla", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
      vi.spyOn(cuadrillaService, "crearCuadrilla").mockResolvedValue(cuadrillaMock);

      const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
        method: "POST",
        body: JSON.stringify(payloadCrearValido),
        headers: { "content-type": "application/json" },
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.message).toBe("Cuadrilla operativa creada exitosamente");
      expect(data.data.id).toBe(cuadrillaIdMock);
    });

    it("debe retornar 400 Bad Request si el cuerpo no es JSON válido", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);

      const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
        method: "POST",
        body: "no es json",
        headers: { "content-type": "application/json" },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("El cuerpo de la solicitud debe ser un JSON válido.");
    });

    it("debe retornar 400 Bad Request si faltan campos obligatorios", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);

      const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
        method: "POST",
        body: JSON.stringify({ nombre: "No" }),
        headers: { "content-type": "application/json" },
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.message).toBe("Datos de entrada inválidos.");
    });

    it("debe retornar 409 Conflict si el nombre ya existe", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
      vi.spyOn(cuadrillaService, "crearCuadrilla").mockRejectedValue(
        new ConflictError("Ya existe una cuadrilla operativa con el nombre ingresado.")
      );

      const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
        method: "POST",
        body: JSON.stringify(payloadCrearValido),
        headers: { "content-type": "application/json" },
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.message).toContain("Ya existe una cuadrilla");
    });
  });
});
