import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("Endpoint GET /openapi.json", () => {
  it("debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const spec = await res.json();
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toContain("SGRAI API");
    expect(spec.info.version).toBe("0.6.0");

    // Rutas de Recursos
    expect(spec.paths["/api/recursos"]).toBeDefined();
    expect(spec.paths["/api/recursos"].post).toBeDefined();
    expect(spec.paths["/api/recursos"].get).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"]).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"].get).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"].put).toBeDefined();

    // Rutas de Incidentes
    expect(spec.paths["/api/incidentes/manual"]).toBeDefined();
    expect(spec.paths["/api/incidentes/manual"].post).toBeDefined();
    expect(spec.paths["/api/incidentes/manual"].post.summary).toBe(
      "Ingreso manual de incidente (Call Center / Terreno)"
    );
    expect(spec.paths["/api/incidentes/verificar-duplicado"]).toBeDefined();
    expect(spec.paths["/api/incidentes/verificar-duplicado"].post).toBeDefined();
    expect(spec.paths["/api/incidentes/avisos"]).toBeDefined();
    expect(spec.paths["/api/incidentes/avisos"].post).toBeDefined();
    expect(
      spec.paths["/api/incidentes/avisos/seguimiento/{codigo}"]
    ).toBeDefined();
    expect(spec.paths["/api/incidentes/tipos"]).toBeDefined();
    expect(spec.paths["/api/incidentes"]).toBeDefined();
    expect(spec.paths["/api/incidentes"].get).toBeDefined();
    expect(spec.paths["/api/incidentes/{id}"]).toBeDefined();
    expect(spec.paths["/api/incidentes/{id}"].get).toBeDefined();

    // Rutas de Seguridad
    expect(spec.paths["/api/seguridad/roles"]).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}"]).toBeDefined();
    expect(spec.paths["/api/seguridad/permisos"]).toBeDefined();
    expect(spec.paths["/api/seguridad/permisos"].get).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}/permisos"]).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}/permisos"].put).toBeDefined();
    // Rutas de Personal (HU-12 y HU-13)
    expect(spec.paths["/api/personal"]).toBeDefined();
    expect(spec.paths["/api/personal"].get).toBeDefined();
    expect(spec.paths["/api/personal/{id}"]).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].get).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].patch).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].delete).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].delete.responses["200"]).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].delete.responses["400"]).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].delete.responses["401"]).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].delete.responses["403"]).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].delete.responses["404"]).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].delete.responses["409"]).toBeDefined();
    expect(spec.paths["/api/personal/{id}"].delete.responses["500"]).toBeDefined();
  });
});

