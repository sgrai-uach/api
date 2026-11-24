import { describe, it, expect } from "vitest";
import { SolicitarApoyoMisionInputNormalizedSchema } from "../mision.schema";

describe("Mision Schema - SolicitarApoyoMisionInputNormalizedSchema (HU-44)", () => {
  it("debe fallar cuando requiereApoyoAdicional es true y no se envía detalleApoyoRequerido", () => {
    const res = SolicitarApoyoMisionInputNormalizedSchema.safeParse({
      requiereApoyoAdicional: true,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes("detalleApoyoRequerido"))).toBe(true);
    }
  });

  it("debe fallar cuando requiereApoyoAdicional es true y detalleApoyoRequerido tiene menos de 5 caracteres útiles", () => {
    const resCorto = SolicitarApoyoMisionInputNormalizedSchema.safeParse({
      requiereApoyoAdicional: true,
      detalleApoyoRequerido: "  abc ",
    });
    expect(resCorto.success).toBe(false);

    const resVacio = SolicitarApoyoMisionInputNormalizedSchema.safeParse({
      requiere_apoyo_adicional: true,
      detalle_apoyo_requerido: "    ",
    });
    expect(resVacio.success).toBe(false);
  });

  it("debe validar y normalizar correctamente con >= 5 caracteres tanto en camelCase como en snake_case", () => {
    const resCamel = SolicitarApoyoMisionInputNormalizedSchema.safeParse({
      requiereApoyoAdicional: true,
      detalleApoyoRequerido: "  Se solicita motoniveladora y cuadrilla adicional de despeje  ",
    });
    expect(resCamel.success).toBe(true);
    if (resCamel.success) {
      expect(resCamel.data.requiereApoyoAdicional).toBe(true);
      expect(resCamel.data.detalleApoyoRequerido).toBe(
        "Se solicita motoniveladora y cuadrilla adicional de despeje"
      );
    }

    const resSnake = SolicitarApoyoMisionInputNormalizedSchema.safeParse({
      requiere_apoyo_adicional: true,
      detalle_apoyo_requerido: "Se requiere bomba de achique adicional",
      resumen_tecnico: "Faena en curso con nivel de agua creciente",
    });
    expect(resSnake.success).toBe(true);
    if (resSnake.success) {
      expect(resSnake.data.requiereApoyoAdicional).toBe(true);
      expect(resSnake.data.detalleApoyoRequerido).toBe(
        "Se requiere bomba de achique adicional"
      );
      expect(resSnake.data.resumenTecnico).toBe(
        "Faena en curso con nivel de agua creciente"
      );
    }
  });

  it("debe permitir requiereApoyoAdicional = false sin detalle y normalizar detalleApoyoRequerido a null y requiereCuadrillaAdicional a false", () => {
    const res = SolicitarApoyoMisionInputNormalizedSchema.safeParse({
      requiereApoyoAdicional: false,
      requiereCuadrillaAdicional: true,
      detalleApoyoRequerido: "Texto residual que debe descartarse",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.requiereApoyoAdicional).toBe(false);
      expect(res.data.requiereCuadrillaAdicional).toBe(false);
      expect(res.data.detalleApoyoRequerido).toBeNull();
    }
  });

  it("debe aceptar requiereCuadrillaAdicional en camelCase y snake_case cuando requiereApoyoAdicional es true", () => {
    const resCamel = SolicitarApoyoMisionInputNormalizedSchema.safeParse({
      requiereApoyoAdicional: true,
      requiereCuadrillaAdicional: true,
      detalleApoyoRequerido: "Se requiere segunda cuadrilla electrica",
    });
    expect(resCamel.success).toBe(true);
    if (resCamel.success) {
      expect(resCamel.data.requiereCuadrillaAdicional).toBe(true);
    }

    const resSnake = SolicitarApoyoMisionInputNormalizedSchema.safeParse({
      requiere_apoyo_adicional: true,
      requiere_cuadrilla_adicional: true,
      detalle_apoyo_requerido: "Se requiere cuadrilla forestal adicional",
    });
    expect(resSnake.success).toBe(true);
    if (resSnake.success) {
      expect(resSnake.data.requiereCuadrillaAdicional).toBe(true);
    }
  });
});
