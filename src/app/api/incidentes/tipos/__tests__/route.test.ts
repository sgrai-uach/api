import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("Endpoint GET /api/incidentes/tipos", () => {
  it("debe retornar la lista de tipos de afectación válidos con status 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toContain("Anegamiento");
    expect(body.data).toContain("Caída de árbol");
    expect(body.data).toContain("Corte de energía");
  });
});
