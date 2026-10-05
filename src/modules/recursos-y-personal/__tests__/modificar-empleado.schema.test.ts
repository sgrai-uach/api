import { describe, it, expect } from "vitest";
import { ModificarEmpleadoSchema } from "../schemas/modificar-empleado.schema";

describe("ModificarEmpleadoSchema (HU-12)", () => {
  it("valida correctamente un payload válido completo", () => {
    const payload = {
      rut: "12.345.678-5",
      nombres: "Juan Carlos",
      apellidos: "Pérez González",
      email: "juan.perez@valdivia.cl",
      telefono: "+56912345678",
      rol_id: "6e206d80-b1ab-4b5a-8dda-c65e9e1fce68",
      delegacion_id: "3bccea9e-289a-4fcc-88aa-50386c8e59fa",
      activo: true,
      fecha_ingreso: "2024-01-15",
      fecha_salida: null,
      especialidad: "Motosierrista",
      cargo: "Brigadista Terreno",
      estado_operativo: "disponible" as const,
      disponible_terreno: true,
      observaciones: "Apto para faenas",
    };

    const resultado = ModificarEmpleadoSchema.safeParse(payload);
    expect(resultado.success).toBe(true);
  });

  it("permite actualización parcial con un solo campo", () => {
    const payload = {
      activo: false,
    };

    const resultado = ModificarEmpleadoSchema.safeParse(payload);
    expect(resultado.success).toBe(true);
  });

  it("falla si el RUT tiene formato inválido", () => {
    const payload = {
      rut: "12345",
    };

    const resultado = ModificarEmpleadoSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it("falla si el email es inválido", () => {
    const payload = {
      email: "correo-no-valido",
    };

    const resultado = ModificarEmpleadoSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it("falla si rol_id no es un UUID válido", () => {
    const payload = {
      rol_id: "rol-no-uuid",
    };

    const resultado = ModificarEmpleadoSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it("falla si la fecha de ingreso no sigue el formato YYYY-MM-DD", () => {
    const payload = {
      fecha_ingreso: "15/01/2024",
    };

    const resultado = ModificarEmpleadoSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });

  it("falla si el estado operativo no pertenece al enum permitido", () => {
    const payload = {
      estado_operativo: "VOLANDO",
    };

    const resultado = ModificarEmpleadoSchema.safeParse(payload);
    expect(resultado.success).toBe(false);
  });
});
