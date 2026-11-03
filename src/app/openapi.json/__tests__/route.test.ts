import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("Endpoint GET /openapi.json", () => {
  it("debe retornar la especificación OpenAPI 3.0 con la ruta /api/recursos", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const spec = await res.json();
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toContain("SGRAI API");
    expect(spec.info.version).toBe("0.10.0");

    // Rutas de Patrullas Verificadoras (HU-16)
    expect(spec.paths["/api/patrullas"]).toBeDefined();
    expect(spec.paths["/api/patrullas"].get).toBeDefined();
    expect(spec.paths["/api/patrullas/{id}"]).toBeDefined();
    expect(spec.paths["/api/patrullas/{id}"].get).toBeDefined();
    expect(spec.paths["/api/patrullas/{id}"].patch).toBeDefined();

    // Rutas de Puntos Críticos (Eventos ATP - HU-57 / HU-55 / HU-56)
    expect(spec.paths["/api/puntos-criticos"]).toBeDefined();
    expect(spec.paths["/api/puntos-criticos"].get).toBeDefined();
    expect(spec.paths["/api/puntos-criticos/{id}"]).toBeDefined();
    expect(spec.paths["/api/puntos-criticos/{id}"].delete).toBeDefined();

    // Rutas de Recuperación (Eventos ATP - HU-29)
    expect(spec.paths["/api/eventos-atp/recuperacion"]).toBeDefined();
    expect(spec.paths["/api/eventos-atp/recuperacion"].post).toBeDefined();

    // Rutas de Recursos y Personal
    expect(spec.paths["/api/recursos"]).toBeDefined();
    expect(spec.paths["/api/recursos"].post).toBeDefined();
    expect(spec.paths["/api/recursos"].get).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"]).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"].get).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"].put).toBeDefined();
    expect(spec.paths["/api/recursos/{id}"].delete).toBeDefined();
    expect(spec.paths["/api/personal"]).toBeDefined();
    expect(spec.paths["/api/personal"].get).toBeDefined();

    // Rutas de Misiones
    expect(spec.paths["/api/misiones"]).toBeDefined();
    expect(spec.paths["/api/misiones"].get).toBeDefined();

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

    // Esquemas registrados en components/schemas (HU-9)
    expect(spec.components.schemas.EliminarRecursoResponse).toBeDefined();

    // Rutas de Misiones (HU-17)
    expect(spec.paths["/api/misiones/{id}"]).toBeDefined();
    expect(spec.paths["/api/misiones/{id}"].get).toBeDefined();
    expect(spec.paths["/api/misiones/{id}"].get.summary).toBe(
      "Consultar detalle completo de una misión operativa"
    );

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

    // Rutas de Eventos ATP - Prevención (HU-30)
    expect(spec.paths["/api/eventos-atp/prevencion"]).toBeDefined();
    expect(spec.paths["/api/eventos-atp/prevencion"].post).toBeDefined();
    expect(spec.paths["/api/eventos-atp/prevencion"].post.responses["201"]).toBeDefined();
    expect(spec.paths["/api/eventos-atp/prevencion"].post.responses["400"]).toBeDefined();
    expect(spec.paths["/api/eventos-atp/prevencion"].post.responses["401"]).toBeDefined();
    expect(spec.paths["/api/eventos-atp/prevencion"].post.responses["403"]).toBeDefined();
    expect(spec.paths["/api/eventos-atp/prevencion"].post.responses["404"]).toBeDefined();
    expect(spec.paths["/api/eventos-atp/prevencion"].post.responses["409"]).toBeDefined();
    expect(spec.paths["/api/eventos-atp/prevencion"].post.responses["500"]).toBeDefined();
  });
});

