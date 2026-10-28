import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as postCuadrillas } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as cuadrillaService from "@/modules/recursos-y-personal/cuadrilla.service";
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from "@/modules/seguridad/errors";

describe("Endpoint POST /api/cuadrillas (H79)", () => {
  const usuarioAdminId = "00000000-0000-4000-8000-000000000001";

  const payloadValido = {
    nombre: "Cuadrilla Vías y Calles",
    delegacionId: "30000000-0000-4000-8000-000000000001",
    usuarioDelegadoId: "00000000-0000-4000-8000-000000000005",
  };

  const cuadrillaRespuestaMock = {
    id: "50000000-0000-4000-8000-000000000001",
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
    creadoEn: "2026-10-24T12:00:00.000Z",
    creadoPorId: usuarioAdminId,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe retornar 400 Bad Request si el cuerpo no es un JSON válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);

    const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
      method: "POST",
      body: "esto no es json",
      headers: { "content-type": "application/json" },
    });

    const res = await postCuadrillas(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe("El cuerpo de la solicitud debe ser un JSON válido.");
  });

  it("debe retornar 400 Bad Request si faltan campos requeridos según esquema Zod", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);

    const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
      method: "POST",
      body: JSON.stringify({ nombre: "Cu" }),
      headers: { "content-type": "application/json" },
    });

    const res = await postCuadrillas(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe("Datos de entrada inválidos.");
    expect(data.errors).toBeDefined();
    expect(data.errors.length).toBeGreaterThan(0);
  });

  it("debe retornar 401 Unauthorized si el usuario no está autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValue(
      new UnauthorizedError("No autenticado.")
    );

    const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
      method: "POST",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await postCuadrillas(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.message).toBe("No autenticado.");
  });

  it("debe retornar 403 Forbidden si el usuario no posee rol Administrador ni permiso recursos:crear", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue("usuario-sin-permiso");
    vi.spyOn(cuadrillaService, "crearCuadrilla").mockRejectedValue(
      new ForbiddenError("Acceso denegado. Se requiere el perfil de Administrador o permiso recursos:crear.")
    );

    const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
      method: "POST",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await postCuadrillas(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain("Acceso denegado");
  });

  it("debe retornar 409 Conflict si el nombre de la cuadrilla ya está en uso", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
    vi.spyOn(cuadrillaService, "crearCuadrilla").mockRejectedValue(
      new ConflictError("Ya existe una cuadrilla operativa con el nombre ingresado.")
    );

    const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
      method: "POST",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await postCuadrillas(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.message).toBe("Ya existe una cuadrilla operativa con el nombre ingresado.");
  });

  it("debe retornar 404 Not Found si la delegación municipal no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
    vi.spyOn(cuadrillaService, "crearCuadrilla").mockRejectedValue(
      new NotFoundError("La delegación municipal especificada no existe.")
    );

    const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
      method: "POST",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await postCuadrillas(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.message).toBe("La delegación municipal especificada no existe.");
  });

  it("debe retornar 400 Bad Request si la delegación o el usuario están inactivos", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
    vi.spyOn(cuadrillaService, "crearCuadrilla").mockRejectedValue(
      new BadRequestError("La delegación municipal seleccionada se encuentra inactiva.")
    );

    const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
      method: "POST",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await postCuadrillas(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe("La delegación municipal seleccionada se encuentra inactiva.");
  });

  it("debe responder 201 Created y retornar los datos cuando el registro es exitoso", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
    vi.spyOn(cuadrillaService, "crearCuadrilla").mockResolvedValue(cuadrillaRespuestaMock);

    const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
      method: "POST",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await postCuadrillas(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toBe("Cuadrilla operativa creada exitosamente");
    expect(body.data).toEqual(cuadrillaRespuestaMock);
    expect(body.data.estado).toBe("DISPONIBLE");
  });

  it("BUG-H79-API-03: debe autenticar correctamente utilizando la cabecera x-user-id sin token Bearer", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(null);
    vi.spyOn(cuadrillaService, "crearCuadrilla").mockResolvedValue(cuadrillaRespuestaMock);

    const req = new NextRequest("http://localhost:3000/api/cuadrillas", {
      method: "POST",
      body: JSON.stringify(payloadValido),
      headers: {
        "content-type": "application/json",
        "x-user-id": usuarioAdminId,
      },
    });

    const res = await postCuadrillas(req);
    expect(res.status).toBe(201);
    expect(cuadrillaService.crearCuadrilla).toHaveBeenCalledWith(
      payloadValido,
      usuarioAdminId
    );
  });
});
