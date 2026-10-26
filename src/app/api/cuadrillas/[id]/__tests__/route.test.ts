import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PUT } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as cuadrillaService from "@/modules/recursos-y-personal/cuadrilla.service";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/modules/seguridad/errors";

describe("Endpoint PUT /api/cuadrillas/[id] (H81)", () => {
  const usuarioAdminId = "00000000-0000-4000-8000-000000000001";
  const cuadrillaIdValido = "50000000-0000-4000-8000-000000000001";
  const contextValido = { params: Promise.resolve({ id: cuadrillaIdValido }) };

  const payloadValido = {
    nombre: "Cuadrilla Vías y Despeje Urbano",
    delegacionId: "30000000-0000-4000-8000-000000000001",
    usuarioDelegadoId: "00000000-0000-4000-8000-000000000005",
    recursos: [
      {
        recursoId: "e1000000-0000-4000-8000-000000000001",
        cantidad: 1,
      },
    ],
    trabajadores: [
      {
        personalId: "40000000-0000-4000-8000-000000000001",
      },
    ],
  };

  const cuadrillaRespuestaMock = {
    id: cuadrillaIdValido,
    nombre: "Cuadrilla Vías y Despeje Urbano",
    estado: "DISPONIBLE" as const,
    delegacion: {
      id: "30000000-0000-4000-8000-000000000001",
      nombre: "Delegación Municipal Norte",
    },
    delegado: {
      id: "00000000-0000-4000-8000-000000000005",
      nombre: "Carlos Operativo",
      email: "carlos@valdivia.cl",
      rut: "15.123.456-7",
    },
    recursos: [
      {
        id: "cd100000-0000-4000-8000-000000000001",
        recursoId: "e1000000-0000-4000-8000-000000000001",
        nombre: "Camioneta de Rescate 4x4",
        cantidadAsignada: 1,
        esIndividual: true,
      },
    ],
    trabajadores: [
      {
        id: "cp100000-0000-4000-8000-000000000001",
        personalId: "40000000-0000-4000-8000-000000000001",
        usuarioId: "00000000-0000-4000-8000-000000000009",
        nombre: "Juan Trabajador",
        rut: "16.123.456-8",
        cargo: "Motosierrista",
        especialidad: "Poda y Despeje",
        asignadoEn: "2026-10-26T01:00:00.000Z",
      },
    ],
    creadoEn: "2026-10-24T12:00:00.000Z",
    actualizadoEn: "2026-10-26T01:00:00.000Z",
    actualizadoPorId: usuarioAdminId,
    creadoPorId: usuarioAdminId,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe retornar 400 Bad Request si el parámetro de ruta no es un UUID válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
    const contextInvalido = { params: Promise.resolve({ id: "id-no-valido" }) };

    const req = new NextRequest("http://localhost:3000/api/cuadrillas/id-no-valido", {
      method: "PUT",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, contextInvalido);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Identificador de cuadrilla inválido");
  });

  it("debe retornar 400 Bad Request si el cuerpo no es un JSON válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);

    const req = new NextRequest(`http://localhost:3000/api/cuadrillas/${cuadrillaIdValido}`, {
      method: "PUT",
      body: "este cuerpo no es json",
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, contextValido);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe("El cuerpo de la solicitud debe ser un JSON válido.");
  });

  it("debe retornar 400 Bad Request si faltan campos obligatorios en el esquema Zod", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);

    const req = new NextRequest(`http://localhost:3000/api/cuadrillas/${cuadrillaIdValido}`, {
      method: "PUT",
      body: JSON.stringify({ nombre: "No" }), // Menor a 3 caracteres y faltan campos
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, contextValido);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toBe("Datos de entrada inválidos.");
    expect(data.errors).toBeDefined();
  });

  it("debe retornar 401 Unauthorized si la autenticación falla", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValue(
      new UnauthorizedError("Token de sesión ausente o expirado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/cuadrillas/${cuadrillaIdValido}`, {
      method: "PUT",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, contextValido);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.message).toContain("Token de sesión ausente");
  });

  it("debe retornar 403 Forbidden si el usuario no posee el permiso recursos:editar", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue("usuario-sin-permisos");
    vi.spyOn(cuadrillaService, "editarCuadrilla").mockRejectedValue(
      new ForbiddenError("Acceso denegado. Se requiere el permiso 'recursos:editar'.")
    );

    const req = new NextRequest(`http://localhost:3000/api/cuadrillas/${cuadrillaIdValido}`, {
      method: "PUT",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, contextValido);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain("recursos:editar");
  });

  it("debe retornar 404 Not Found si la cuadrilla no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
    vi.spyOn(cuadrillaService, "editarCuadrilla").mockRejectedValue(
      new NotFoundError("La cuadrilla operativa especificada no existe.")
    );

    const req = new NextRequest(`http://localhost:3000/api/cuadrillas/${cuadrillaIdValido}`, {
      method: "PUT",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, contextValido);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.message).toContain("no existe");
  });

  it("debe retornar 409 Conflict si la cuadrilla se encuentra EN_MISION", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
    vi.spyOn(cuadrillaService, "editarCuadrilla").mockRejectedValue(
      new ConflictError(
        "No es posible modificar los datos ni la dotación de una cuadrilla que se encuentra actualmente en misión activa."
      )
    );

    const req = new NextRequest(`http://localhost:3000/api/cuadrillas/${cuadrillaIdValido}`, {
      method: "PUT",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, contextValido);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.message).toContain("misión activa");
  });

  it("debe retornar 409 Conflict si el nombre ya pertenece a otra cuadrilla activa", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
    vi.spyOn(cuadrillaService, "editarCuadrilla").mockRejectedValue(
      new ConflictError("Ya existe otra cuadrilla operativa con el nombre ingresado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/cuadrillas/${cuadrillaIdValido}`, {
      method: "PUT",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, contextValido);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.message).toContain("Ya existe otra cuadrilla");
  });

  it("debe retornar 200 OK con los datos y dotación actualizada ante actualización exitosa", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioAdminId);
    vi.spyOn(cuadrillaService, "editarCuadrilla").mockResolvedValue(cuadrillaRespuestaMock);

    const req = new NextRequest(`http://localhost:3000/api/cuadrillas/${cuadrillaIdValido}`, {
      method: "PUT",
      body: JSON.stringify(payloadValido),
      headers: { "content-type": "application/json" },
    });

    const res = await PUT(req, contextValido);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message).toBe("Cuadrilla operativa actualizada exitosamente");
    expect(data.data.id).toBe(cuadrillaIdValido);
    expect(data.data.recursos).toHaveLength(1);
    expect(data.data.trabajadores).toHaveLength(1);
    expect(data.data.actualizadoEn).toBeDefined();
  });
});
