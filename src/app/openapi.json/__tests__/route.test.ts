import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("Endpoint GET /openapi.json", () => {
  it("debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const spec = await res.json();
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toContain("SGRAI API");
    expect(spec.info.version).toBe("0.7.0");
    // Rutas de Puntos Críticos (Eventos ATP - HU-57)
    expect(spec.paths["/api/puntos-criticos"]).toBeDefined();
    expect(spec.paths["/api/puntos-criticos"].get).toBeDefined();

    // Rutas de Recursos
    expect(spec.paths["/api/recursos"]).toBeDefined();
    expect(spec.paths["/api/recursos"].post).toBeDefined();
    expect(spec.paths["/api/recursos"].get).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"]).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"].get).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"].put).toBeDefined();

    // Rutas de Incidentes
    expect(spec.paths["/api/incidentes/kpis"]).toBeDefined();
    expect(spec.paths["/api/incidentes/kpis"].get).toBeDefined();
    expect(spec.paths["/api/incidentes/kpis"].get.summary).toBe(
      "Obtener contadores y KPIs de incidentes del día"
    );
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
    expect(spec.paths["/api/seguridad/login"]).toBeDefined();
    expect(spec.paths["/api/seguridad/login"].post).toBeDefined();
    expect(spec.paths["/api/seguridad/roles"]).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}"]).toBeDefined();
    expect(spec.paths["/api/seguridad/permisos"]).toBeDefined();
    expect(spec.paths["/api/seguridad/permisos"].get).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}/permisos"]).toBeDefined();
    expect(spec.paths["/api/seguridad/roles/{id}/permisos"].put).toBeDefined();
    expect(spec.paths["/api/seguridad/usuario-activo"]).toBeDefined();
    expect(spec.paths["/api/seguridad/usuario-activo"].get).toBeDefined();

    // Rutas de Misiones (HU-17)
    expect(spec.paths["/api/misiones/{id}"]).toBeDefined();
    expect(spec.paths["/api/misiones/{id}"].get).toBeDefined();
    expect(spec.paths["/api/misiones/{id}"].get.summary).toBe(
      "Consultar detalle completo de una misión operativa"
    );
  });
});

