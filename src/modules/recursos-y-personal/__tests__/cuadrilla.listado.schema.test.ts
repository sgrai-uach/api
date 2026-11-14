import { describe, it, expect } from "vitest";
import { ListarCuadrillasQuerySchema } from "../cuadrilla.schema";

describe("Módulo Recursos y Personal - ListarCuadrillasQuerySchema (H80)", () => {
  it("caso 1: sin parámetros deja pagina y limite sin default para que el servicio aplique el fallback", () => {
    const resultado = ListarCuadrillasQuerySchema.safeParse({});
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.pagina).toBeUndefined();
      expect(resultado.data.limite).toBeUndefined();
      expect(resultado.data.busqueda).toBeUndefined();
      expect(resultado.data.delegacionId).toBeUndefined();
      expect(resultado.data.estado).toBeUndefined();
    }
  });

  it("caso 2: pagina='2' y limite='5' realiza coerción correcta a números", () => {
    const resultado = ListarCuadrillasQuerySchema.safeParse({
      pagina: "2",
      limite: "5",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.pagina).toBe(2);
      expect(resultado.data.limite).toBe(5);
    }
  });

  it("caso 3: delegacionId UUID válido es aceptado", () => {
    const validUuid = "30000000-0000-4000-8000-000000000001";
    const resultado = ListarCuadrillasQuerySchema.safeParse({
      delegacionId: validUuid,
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.delegacionId).toBe(validUuid);
    }
  });

  it("caso 4: delegacionId no-UUID falla con error en el campo delegacionId", () => {
    const resultado = ListarCuadrillasQuerySchema.safeParse({
      delegacionId: "invalido-no-uuid",
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      const issue = resultado.error.issues.find((i) => i.path.includes("delegacionId"));
      expect(issue).toBeDefined();
      expect(issue?.message).toBe("El identificador de delegación debe ser un UUID válido");
    }
  });

  it("caso 5: estado='DISPONIBLE' es aceptado", () => {
    const resultado = ListarCuadrillasQuerySchema.safeParse({
      estado: "DISPONIBLE",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.estado).toBe("DISPONIBLE");
    }
  });

  it("caso 6: estado='INVALIDO' es rechazado", () => {
    const resultado = ListarCuadrillasQuerySchema.safeParse({
      estado: "INVALIDO",
    });
    expect(resultado.success).toBe(false);
  });

  it("caso 7: busqueda='  texto  ' se recorta con .trim()", () => {
    const resultado = ListarCuadrillasQuerySchema.safeParse({
      busqueda: "  texto  ",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.busqueda).toBe("texto");
    }
  });

  it("caso 8: limite='150' (> max 100) es rechazado", () => {
    const resultado = ListarCuadrillasQuerySchema.safeParse({
      limite: "150",
    });
    expect(resultado.success).toBe(false);
  });

  it("caso 9: page=2 y limit=5 (alias) se parsean correctamente", () => {
    const resultado = ListarCuadrillasQuerySchema.safeParse({
      page: "2",
      limit: "5",
    });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.page).toBe(2);
      expect(resultado.data.limit).toBe(5);
    }
  });
});

