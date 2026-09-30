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
    expect(spec.paths["/api/seguridad/usuario-activo"]).toBeDefined();
    expect(spec.paths["/api/seguridad/usuario-activo"].get).toBeDefined();
  });
});
