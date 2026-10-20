import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../route";
import * as actualizarEmpleadoService from "@/modules/recursos-y-personal/services/actualizar-empleado.service";

describe("PATCH /api/personal/[id] (HU-12)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna 400 si el payload contiene datos inválidos", async () => {
    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001", {
      method: "PATCH",
      body: JSON.stringify({ email: "correo-invalido" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Datos de entrada inválidos");
  });

  it("retorna 404 si el empleado no existe", async () => {
    vi.spyOn(actualizarEmpleadoService, "actualizarEmpleado").mockRejectedValueOnce(
      new actualizarEmpleadoService.EmpleadoNotFoundError("Empleado no encontrado")
    );

    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001", {
      method: "PATCH",
      body: JSON.stringify({ nombres: "Carlos" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Empleado no encontrado");
  });

  it("retorna 409 si el email ya existe", async () => {
    vi.spyOn(actualizarEmpleadoService, "actualizarEmpleado").mockRejectedValueOnce(
      new actualizarEmpleadoService.EmailDuplicadoError("El correo electrónico ya se encuentra registrado por otro usuario")
    );

    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001", {
      method: "PATCH",
      body: JSON.stringify({ email: "existente@valdivia.cl" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("correo electrónico");
  });

  it("retorna 200 y el empleado actualizado si los datos son válidos", async () => {
    const mockEmpleado = {
      usuario_id: "00000000-0000-4000-8000-000000000001",
      rut: "12.345.678-5",
      nombres: "Juan",
      apellidos: "Pérez",
      email: "juan@valdivia.cl",
      telefono: "+56912345678",
      usuario_activo: true,
      fecha_ingreso: "2024-01-01",
      fecha_salida: null,
      rol_id: "6e206d80-b1ab-4b5a-8dda-c65e9e1fce68",
      rol_codigo: "BRIGADISTA",
      rol_nombre: "Personal de Terreno",
      delegacion_id: null,
      delegacion_codigo: null,
      delegacion_nombre: null,
      personal_id: null,
      especialidad: null,
      cargo: null,
      estado_operativo: null,
      disponible_terreno: null,
      observaciones: null,
      usuario_updated_at: new Date(),
      personal_updated_at: null,
    };

    vi.spyOn(actualizarEmpleadoService, "actualizarEmpleado").mockResolvedValueOnce(
      mockEmpleado as unknown as Awaited<ReturnType<typeof actualizarEmpleadoService.actualizarEmpleado>>
    );

    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001", {
      method: "PATCH",
      body: JSON.stringify({ nombres: "Juan" }),
      headers: { "Content-Type": "application/json", "x-user-id": "admin-123" },
    });

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mensaje).toBe("Datos del empleado actualizados exitosamente");
    expect(body.data.nombres).toBe("Juan");
  });
});

describe("DELETE /api/personal/[id] (HU-13)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna 401 si falta cabecera de autenticación x-user-id", async () => {
    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001", {
      method: "DELETE",
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(401);
  });

  it("retorna 403 si el usuario que ejecuta no es Administrador", async () => {
    const authGuard = await import("@/modules/seguridad/auth.guard");
    const { ForbiddenError } = await import("@/modules/seguridad/errors");
    vi.spyOn(authGuard, "verificarAdministrador").mockRejectedValueOnce(
      new ForbiddenError("Acceso denegado. Se requiere perfil de Administrador.")
    );

    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001", {
      method: "DELETE",
      headers: { "x-user-id": "operador-callcenter" },
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Acceso denegado");
  });

  it("retorna 404 si el empleado a dar de baja no existe", async () => {
    const authGuard = await import("@/modules/seguridad/auth.guard");
    vi.spyOn(authGuard, "verificarAdministrador").mockResolvedValueOnce({
      id: "admin-id",
      rut: "11.111.111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      rolId: "admin-rol",
      rolNombre: "Administrador",
      activo: true,
    });

    const eliminarService = await import(
      "@/modules/recursos-y-personal/services/eliminar-empleado.service"
    );
    vi.spyOn(eliminarService, "eliminarEmpleadoLogico").mockRejectedValueOnce(
      new actualizarEmpleadoService.EmpleadoNotFoundError("Empleado no encontrado para dar de baja")
    );

    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000099", {
      method: "DELETE",
      headers: { "x-user-id": "admin-id" },
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000099" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Empleado no encontrado");
  });

  it("retorna 409 si el empleado se encuentra en una misión o patrulla activa", async () => {
    const authGuard = await import("@/modules/seguridad/auth.guard");
    vi.spyOn(authGuard, "verificarAdministrador").mockResolvedValueOnce({
      id: "admin-id",
      rut: "11.111.111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      rolId: "admin-rol",
      rolNombre: "Administrador",
      activo: true,
    });

    const eliminarService = await import(
      "@/modules/recursos-y-personal/services/eliminar-empleado.service"
    );
    vi.spyOn(eliminarService, "eliminarEmpleadoLogico").mockRejectedValueOnce(
      new eliminarService.EmpleadoEnMisionActivaError("El empleado se encuentra en terreno")
    );

    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001", {
      method: "DELETE",
      headers: { "x-user-id": "admin-id" },
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("El empleado se encuentra en terreno");
  });

  it("retorna 200 y confirma la baja lógica si el usuario es administrador y no hay conflictos", async () => {
    const authGuard = await import("@/modules/seguridad/auth.guard");
    vi.spyOn(authGuard, "verificarAdministrador").mockResolvedValueOnce({
      id: "admin-id",
      rut: "11.111.111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      rolId: "admin-rol",
      rolNombre: "Administrador",
      activo: true,
    });

    const eliminarService = await import(
      "@/modules/recursos-y-personal/services/eliminar-empleado.service"
    );
    vi.spyOn(eliminarService, "eliminarEmpleadoLogico").mockResolvedValueOnce({
      usuario_id: "00000000-0000-4000-8000-000000000001",
      activo: false,
      fecha_salida: "2026-10-01",
    });

    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001", {
      method: "DELETE",
      headers: { "x-user-id": "admin-id" },
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mensaje).toBe("Empleado dado de baja exitosamente");
    expect(body.data.activo).toBe(false);
  });

  it("BUG-H13-API-04: retorna 400 Bad Request si el parámetro :id no es un UUID válido", async () => {
    const authGuard = await import("@/modules/seguridad/auth.guard");
    vi.spyOn(authGuard, "verificarAdministrador").mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11.111.111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      rolId: "20000000-0000-4000-8000-000000000001",
      rolNombre: "Administrador",
      activo: true,
    });

    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost:3000/api/personal/no-es-un-uuid", {
      method: "DELETE",
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000001" },
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "no-es-un-uuid" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("UUID válido");
  });

  it("BUG-H13-API-03: retorna 401 Unauthorized y no 500 ante cabecera de autenticación no-UUID", async () => {
    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001", {
      method: "DELETE",
      headers: { "x-user-id": "admin" },
    });

    const res = await DELETE(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/personal/[id] (HU-11 / Validación de UUID y RBAC)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("BUG-H13-API-04: retorna 400 Bad Request si el parámetro :id no es un UUID válido", async () => {
    const authGuard = await import("@/modules/seguridad/auth.guard");
    vi.spyOn(authGuard, "verificarAccesoPersonal").mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000001",
      rut: "11.111.111-1",
      nombre: "Administrador General",
      email: "admin@valdivia.cl",
      rolId: "20000000-0000-4000-8000-000000000001",
      rolNombre: "Administrador",
      activo: true,
    });

    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost:3000/api/personal/no-es-un-uuid");

    const res = await GET(req, {
      params: Promise.resolve({ id: "no-es-un-uuid" }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("UUID válido");
  });

  it("H11-API: retorna 401 Unauthorized si la petición no incluye token de sesión", async () => {
    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001"
    );

    const res = await GET(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(401);
  });

  it("H11-API: retorna 403 Forbidden si el usuario no posee permisos de personal", async () => {
    const authGuard = await import("@/modules/seguridad/auth.guard");
    const { ForbiddenError } = await import("@/modules/seguridad/errors");
    vi.spyOn(authGuard, "verificarAccesoPersonal").mockRejectedValueOnce(
      new ForbiddenError("Acceso denegado. Se requiere el permiso 'personal:leer'.")
    );

    const { GET } = await import("../route");
    const req = new NextRequest(
      "http://localhost:3000/api/personal/00000000-0000-4000-8000-000000000001"
    );

    const res = await GET(req, {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Acceso denegado");
  });
});
