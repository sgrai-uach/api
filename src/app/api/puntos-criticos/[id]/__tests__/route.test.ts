import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "../route";
import * as puntoCriticoService from "@/modules/eventos-atp/punto-critico.service";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";
import { generarTokenPrueba } from "@/lib/test-utils/auth";

describe("Route Handlers /api/puntos-criticos/[id] (HU-56)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const validUuid = "40000000-0000-4000-8000-000000000001";
  const adminUserId = "00000000-0000-4000-8000-000000000001";

  describe("DELETE /api/puntos-criticos/[id]", () => {
    it("debe responder 400 si el parámetro id no es un UUID válido", async () => {
      const req = new NextRequest("http://localhost:3000/api/puntos-criticos/invalido", {
        method: "DELETE",
        headers: { "x-user-id": adminUserId },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: "invalido" }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Identificador de punto crítico inválido.");
      expect(body.errors).toBeDefined();
    });

    it("debe responder 401 si no se envía cabecera de autenticación válida", async () => {
      vi.spyOn(puntoCriticoService, "eliminarPuntoCritico").mockRejectedValueOnce(
        new UnauthorizedError("Cabecera X-User-Id requerida para autenticación.")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${validUuid}`, {
        method: "DELETE",
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toContain("autenticación");
    });

    it("debe responder 403 si el usuario carece de perfil de Administrador", async () => {
      vi.spyOn(puntoCriticoService, "eliminarPuntoCritico").mockRejectedValueOnce(
        new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador.")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${validUuid}`, {
        method: "DELETE",
        headers: { "x-user-id": "00000000-0000-4000-8000-000000000002" },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.message).toContain("Administrador");
    });

    it("debe responder 404 si el punto crítico no existe", async () => {
      vi.spyOn(puntoCriticoService, "eliminarPuntoCritico").mockRejectedValueOnce(
        new NotFoundError(`Punto crítico con ID '${validUuid}' no encontrado.`)
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${validUuid}`, {
        method: "DELETE",
        headers: { "x-user-id": adminUserId },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toContain("no encontrado");
    });

    it("Criterio 3: debe responder 409 Conflict si existen misiones preventivas activas en curso", async () => {
      vi.spyOn(puntoCriticoService, "eliminarPuntoCritico").mockRejectedValueOnce(
        new ConflictError(
          "No es posible eliminar el punto crítico 'Sector Humedal Angachilla' porque cuenta con 1 misión(es) preventivas activas o patrullas asignadas en terreno (Misiones asociadas: MIS-2026-004)."
        )
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${validUuid}`, {
        method: "DELETE",
        headers: { "x-user-id": adminUserId },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.message).toContain("misión(es) preventivas activas");
    });

    it("Criterios 1, 4, 5 y 6: debe responder 200 OK con los datos de desactivación exitosa", async () => {
      const mockResponse = {
        message: "Punto crítico desactivado exitosamente del sistema.",
        id: validUuid,
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla - Pasaje Los Robles",
        activo: false,
        eliminadoEn: "2026-10-04T00:30:00.000Z",
        eliminadoPorId: adminUserId,
      };

      vi.spyOn(puntoCriticoService, "eliminarPuntoCritico").mockResolvedValueOnce(mockResponse);

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${validUuid}`, {
        method: "DELETE",
        headers: { "x-user-id": adminUserId },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Punto crítico desactivado exitosamente del sistema.");
      expect(body.activo).toBe(false);
      expect(body.id).toBe(validUuid);
      expect(body.codigo).toBe("PC-ANG-01");
      expect(body.eliminadoPorId).toBe(adminUserId);
      expect(body.eliminadoEn).toBe("2026-10-04T00:30:00.000Z");
    });

    it("debe responder 500 ante errores internos no controlados", async () => {
      vi.spyOn(puntoCriticoService, "eliminarPuntoCritico").mockRejectedValueOnce(
        new Error("Fallo de conexión a PostgreSQL")
      );

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${validUuid}`, {
        method: "DELETE",
        headers: { "x-user-id": adminUserId },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.message).toBe("Error interno del servidor al procesar la solicitud.");
    });

    it("debe extraer el usuario id correctamente desde un token JWT Bearer firmado", async () => {
      const token = await generarTokenPrueba(adminUserId);
      const mockResponse = {
        message: "Punto crítico desactivado exitosamente del sistema.",
        id: validUuid,
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla - Pasaje Los Robles",
        activo: false,
        eliminadoEn: "2026-10-04T00:30:00.000Z",
        eliminadoPorId: adminUserId,
      };

      const spyEliminar = vi.spyOn(puntoCriticoService, "eliminarPuntoCritico").mockResolvedValueOnce(mockResponse);

      const req = new NextRequest(`http://localhost:3000/api/puntos-criticos/${validUuid}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: validUuid }),
      });

      expect(res.status).toBe(200);
      expect(spyEliminar).toHaveBeenCalledWith(validUuid, adminUserId);
    });
  });
});
