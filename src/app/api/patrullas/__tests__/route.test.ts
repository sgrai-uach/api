import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { GET as GET_BY_ID, PATCH as PATCH_BY_ID } from "../[id]/route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as patrullaService from "@/modules/recursos-y-personal/patrulla.service";
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/modules/seguridad/errors";

describe("Route Handlers /api/patrullas", () => {
  const adminId = "00000000-0000-4000-8000-000000000001";
  const validPatrullaId = "f1000000-0000-4000-8000-000000000001";

  const dummyPatrullaDTO = {
    id: validPatrullaId,
    nombre: "Patrulla Rápida Costa-1",
    estado: "EN_VERIFICACION" as const,
    latitud: -39.86523,
    longitud: -73.39841,
    ultimaActualizacionUbicacion: "2026-10-20T22:00:00.000Z",
    delegacion: {
      id: "30000000-0000-4000-8000-000000000003",
      nombre: "Delegación Costa",
      codigo: "DEL_COSTA",
    },
    lider: {
      id: "00000000-0000-4000-8000-000000000003",
      nombre: "Encargado de Operaciones",
      email: "encargado@valdivia.cl",
      telefono: "+56911112222",
      rut: "33333333-3",
    },
    integrantes: [],
    misionActiva: {
      id: "d1000000-0000-4000-8000-000000000001",
      codigo: "MIS-2026-0001",
      titulo: "Evaluación de terreno",
      tipoMision: "VERIFICACION",
      estado: "EN_CURSO",
      prioridad: "CRITICA",
      incidenteId: "a1000000-0000-4000-8000-000000000003",
      incidenteCodigo: "INC-2026-0003",
      incidenteFolio: "FOL-2026-0003",
      incidenteTipoAfectacion: "Derrumbe",
      incidenteDireccion: "Ruta T-350",
    },
    creadoEn: "2026-10-20T10:00:00.000Z",
    actualizadoEn: "2026-10-20T22:30:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/patrullas", () => {
    it("debe retornar 400 si los parámetros de consulta son inválidos", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);

      const req = new NextRequest("http://localhost:3000/api/patrullas?delegacionId=no-es-uuid");
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("inválidos");
    });

    it("debe retornar 401 si no hay usuario autenticado", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
        new UnauthorizedError("Token no válido")
      );

      const req = new NextRequest("http://localhost:3000/api/patrullas");
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it("debe retornar 403 si el usuario carece de permiso misiones:leer", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "listarPatrullasService").mockRejectedValueOnce(
        new ForbiddenError("No cuenta con el permiso requerido: misiones:leer")
      );

      const req = new NextRequest("http://localhost:3000/api/patrullas");
      const res = await GET(req);

      expect(res.status).toBe(403);
    });

    it("debe retornar 200 y la lista de patrullas con metadata", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "listarPatrullasService").mockResolvedValueOnce({
        message: "Listado de patrullas obtenido exitosamente",
        data: [dummyPatrullaDTO],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/patrullas?estado=EN_VERIFICACION");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].estado).toBe("EN_VERIFICACION");
      expect(json.meta.total).toBe(1);
    });
  });

  describe("GET /api/patrullas/[id]", () => {
    it("debe retornar 400 si el parámetro de ruta id no es un UUID válido", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);

      const req = new NextRequest("http://localhost:3000/api/patrullas/patrulla-1");
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: "patrulla-1" }) });

      expect(res.status).toBe(400);
    });

    it("debe retornar 404 si la patrulla no existe", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "obtenerDetallePatrullaService").mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3000/api/patrullas/${validPatrullaId}`);
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: validPatrullaId }) });

      expect(res.status).toBe(404);
    });

    it("debe retornar 200 y el detalle de la patrulla si existe", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "obtenerDetallePatrullaService").mockResolvedValueOnce({
        message: "Detalle obtenido exitosamente",
        data: dummyPatrullaDTO,
      });

      const req = new NextRequest(`http://localhost:3000/api/patrullas/${validPatrullaId}`);
      const res = await GET_BY_ID(req, { params: Promise.resolve({ id: validPatrullaId }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(validPatrullaId);
    });
  });

  describe("PATCH /api/patrullas/[id]", () => {
    it("debe retornar 400 si el payload contiene un estado no canónico", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);

      const req = new NextRequest(`http://localhost:3000/api/patrullas/${validPatrullaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "Ocupada" }),
      });

      const res = await PATCH_BY_ID(req, { params: Promise.resolve({ id: validPatrullaId }) });
      expect(res.status).toBe(400);
    });

    it("debe retornar 404 si la patrulla a actualizar no existe", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "actualizarEstadoPatrullaService").mockResolvedValueOnce(null);

      const req = new NextRequest(`http://localhost:3000/api/patrullas/${validPatrullaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "DISPONIBLE" }),
      });

      const res = await PATCH_BY_ID(req, { params: Promise.resolve({ id: validPatrullaId }) });
      expect(res.status).toBe(404);
    });

    it("debe retornar 200 cuando se actualiza exitosamente el estado", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "actualizarEstadoPatrullaService").mockResolvedValueOnce({
        message: "Estado actualizado exitosamente",
        data: {
          ...dummyPatrullaDTO,
          estado: "DISPONIBLE",
          misionActiva: null,
        },
      });

      const req = new NextRequest(`http://localhost:3000/api/patrullas/${validPatrullaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "DISPONIBLE",
          motivo: "Reincorporación a base de delegación",
        }),
      });

      const res = await PATCH_BY_ID(req, { params: Promise.resolve({ id: validPatrullaId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.estado).toBe("DISPONIBLE");
    });
  });

  describe("POST /api/patrullas (Alta de Patrulla - HU-83)", () => {
    const validPayload = {
      codigo: "PV-NORTE-01",
      nombre: "Patrulla Rápida Norte 1",
      delegacionId: "30000000-0000-4000-8000-000000000001",
      vehiculoId: "e1000000-0000-4000-8000-000000000002",
      personalIds: ["b1000000-0000-4000-8000-000000000001"],
    };

    it("debe retornar 201 Created cuando el payload es válido y el usuario tiene permiso recursos:crear", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "crearPatrullaService").mockResolvedValueOnce({
        message: "Patrulla verificadora registrada exitosamente.",
        data: {
          ...dummyPatrullaDTO,
          codigo: "PV-NORTE-01",
          nombre: "Patrulla Rápida Norte 1",
          estado: "DISPONIBLE",
        },
      });

      const req = new NextRequest("http://localhost:3000/api/patrullas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.message).toContain("exitosa");
      expect(json.data.codigo).toBe("PV-NORTE-01");
      expect(json.data.estado).toBe("DISPONIBLE");
    });

    it("debe retornar 400 Bad Request si el cuerpo de la petición no es JSON válido", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);

      const req = new NextRequest("http://localhost:3000/api/patrullas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "esto no es json",
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("JSON válido");
    });

    it("debe retornar 400 Bad Request si la validación Zod falla", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);

      const req = new NextRequest("http://localhost:3000/api/patrullas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: "P", // muy corto
          delegacionId: "no-es-uuid",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("inválidos");
    });

    it("debe retornar 401 Unauthorized si el usuario no está autenticado", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
        new UnauthorizedError("Token no válido")
      );

      const req = new NextRequest("http://localhost:3000/api/patrullas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("debe retornar 403 Forbidden si el usuario carece de permiso recursos:crear", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "crearPatrullaService").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere permiso recursos:crear.")
      );

      const req = new NextRequest("http://localhost:3000/api/patrullas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("debe retornar 409 Conflict si el código ya existe o el vehículo no está disponible", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "crearPatrullaService").mockRejectedValueOnce(
        new ConflictError("El código identificador 'PV-NORTE-01' ya se encuentra registrado.")
      );

      const req = new NextRequest("http://localhost:3000/api/patrullas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.message).toContain("ya se encuentra registrado");
    });

    it("debe retornar 404 Not Found si la delegación o vehículo no existen", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "crearPatrullaService").mockRejectedValueOnce(
        new NotFoundError("La delegación municipal con ID '30000000-0000-4000-8000-000000000001' no existe.")
      );

      const req = new NextRequest("http://localhost:3000/api/patrullas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(404);
    });

    it("debe retornar 400 Bad Request si el servicio arroja BadRequestError por personal sin rol válido", async () => {
      vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(adminId);
      vi.spyOn(patrullaService, "crearPatrullaService").mockRejectedValueOnce(
        new BadRequestError("Los funcionarios no cuentan con el rol operativo 'PATRULLA_VERIFICADORA'.")
      );

      const req = new NextRequest("http://localhost:3000/api/patrullas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.message).toContain("PATRULLA_VERIFICADORA");
    });
  });
});
