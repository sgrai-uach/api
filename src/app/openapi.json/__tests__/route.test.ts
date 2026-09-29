import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("Endpoint GET /openapi.json", () => {
  it("debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const spec = await res.json();
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toBe("SGRAI API");
    expect(spec.info.version).toBe("0.3.0");
    expect(spec.paths["/api/recursos"]).toBeDefined();
    expect(spec.paths["/api/recursos"].post).toBeDefined();
    expect(spec.paths["/api/recursos"].get).toBeDefined();
  });
});
