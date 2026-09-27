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

    vi.spyOn(actualizarEmpleadoService, "actualizarEmpleado").mockResolvedValueOnce(mockEmpleado as any);

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
