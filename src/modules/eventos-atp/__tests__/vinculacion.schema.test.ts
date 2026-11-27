import { describe, it, expect } from "vitest";
import { VincularEntidadesInputSchema } from "../vinculacion.schema";

const UUID_A = "a0000000-0000-4000-8000-000000000001";
const UUID_B = "a0000000-0000-4000-8000-000000000002";

describe("vinculacion.schema - Contrato de vinculación (H60)", () => {
  it("acepta una solicitud con un solo grupo de entidades", () => {
    const resultado = VincularEntidadesInputSchema.parse({
      incidenteIds: [UUID_A],
    });

    expect(resultado.incidenteIds).toEqual([UUID_A]);
    expect(resultado.eventoPrevencionIds).toEqual([]);
    expect(resultado.recuperacionIds).toEqual([]);
    expect(resultado.eventoAsistenciaSocialIds).toEqual([]);
  });

  it("acepta varios grupos en una misma solicitud", () => {
    const resultado = VincularEntidadesInputSchema.parse({
      incidenteIds: [UUID_A],
      eventoPrevencionIds: [UUID_B],
      recuperacionIds: [UUID_A],
      eventoAsistenciaSocialIds: [UUID_B],
    });

    expect(resultado.incidenteIds).toHaveLength(1);
    expect(resultado.eventoPrevencionIds).toHaveLength(1);
    expect(resultado.recuperacionIds).toHaveLength(1);
    expect(resultado.eventoAsistenciaSocialIds).toHaveLength(1);
  });

  it("rechaza una solicitud sin entidades", () => {
    const resultado = VincularEntidadesInputSchema.safeParse({});

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toContain(
        "al menos una entidad"
      );
    }
  });

  it("rechaza identificadores que no son UUID", () => {
    const resultado = VincularEntidadesInputSchema.safeParse({
      incidenteIds: ["no-es-uuid"],
    });

    expect(resultado.success).toBe(false);
  });

  it("rechaza más de 200 entidades por grupo", () => {
    const ids = Array.from({ length: 201 }, (_, indice) =>
      `a0000000-0000-4000-8000-${String(indice).padStart(12, "0")}`
    );

    const resultado = VincularEntidadesInputSchema.safeParse({
      incidenteIds: ids,
    });

    expect(resultado.success).toBe(false);
  });
});
