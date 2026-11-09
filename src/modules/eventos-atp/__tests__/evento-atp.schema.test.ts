import { describe, it, expect } from "vitest";
import {
  CrearEventoAtpInputSchema,
  NivelAlertaEventoAtpSchema,
  TipoAmenazaEventoAtpSchema,
} from "../evento-atp.schema";

const inputValido = {
  nombre: "Sistema Frontal Mayo 2026",
  descripcion:
    "Sistema frontal con precipitaciones intensas y vientos moderados a fuertes durante 48 horas.",
  tipoAmenaza: "METEOROLOGICA" as const,
  nivelAlerta: "AMARILLA" as const,
  fechaInicio: "2026-05-01T10:00",
  fechaTermino: "2026-05-03T18:00",
  delegacionIds: ["30000000-0000-4000-8000-000000000001"],
};

describe("Evento ATP - Esquema Zod (H61)", () => {
  it("debe aceptar un evento válido y aplicar delegaciones vacías por defecto", () => {
    const resultado = CrearEventoAtpInputSchema.safeParse(inputValido);

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.nombre).toBe(inputValido.nombre);
      expect(resultado.data.delegacionIds).toHaveLength(1);
    }
  });

  it("debe aceptar alcance comunal cuando no se envían delegaciones", () => {
    const sinDelegaciones = { ...inputValido, delegacionIds: undefined };
    const resultado = CrearEventoAtpInputSchema.safeParse(sinDelegaciones);

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.delegacionIds).toEqual([]);
    }
  });

  it("debe rechazar nombre vacío o demasiado corto", () => {
    const resultado = CrearEventoAtpInputSchema.safeParse({
      ...inputValido,
      nombre: "AB",
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].path).toContain("nombre");
    }
  });

  it("debe rechazar un tipo de amenaza no homologado", () => {
    const resultado = CrearEventoAtpInputSchema.safeParse({
      ...inputValido,
      tipoAmenaza: "VOLCANICA",
    });

    expect(resultado.success).toBe(false);
    expect(TipoAmenazaEventoAtpSchema.safeParse("VOLCANICA").success).toBe(
      false
    );
  });

  it("debe rechazar un nivel de alerta no oficial", () => {
    const resultado = CrearEventoAtpInputSchema.safeParse({
      ...inputValido,
      nivelAlerta: "NARANJA",
    });

    expect(resultado.success).toBe(false);
    expect(NivelAlertaEventoAtpSchema.safeParse("NARANJA").success).toBe(false);
  });

  it("debe rechazar fecha_termino anterior a fecha_inicio", () => {
    const resultado = CrearEventoAtpInputSchema.safeParse({
      ...inputValido,
      fechaInicio: "2026-05-03T18:00",
      fechaTermino: "2026-05-01T10:00",
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const issue = resultado.error.issues.find((i) =>
        i.path.includes("fechaTermino")
      );
      expect(issue?.message).toContain("mayor o igual");
    }
  });

  it("debe aceptar fecha_termino igual a fecha_inicio", () => {
    const resultado = CrearEventoAtpInputSchema.safeParse({
      ...inputValido,
      fechaInicio: "2026-05-01T10:00",
      fechaTermino: "2026-05-01T10:00",
    });

    expect(resultado.success).toBe(true);
  });

  it("debe rechazar delegaciones duplicadas", () => {
    const delegacionId = "30000000-0000-4000-8000-000000000001";
    const resultado = CrearEventoAtpInputSchema.safeParse({
      ...inputValido,
      delegacionIds: [delegacionId, delegacionId],
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(
        resultado.error.issues.some((i) => i.path.includes("delegacionIds"))
      ).toBe(true);
    }
  });

  it("debe rechazar un código manual con caracteres no permitidos", () => {
    const resultado = CrearEventoAtpInputSchema.safeParse({
      ...inputValido,
      codigo: "ATP 2026/0001",
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].path).toContain("codigo");
    }
  });
});
