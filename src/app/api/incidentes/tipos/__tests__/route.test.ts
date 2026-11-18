import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as tipologiaServiceModule from "@/modules/incidentes/tipologia.service";

describe("Endpoint GET /api/incidentes/tipos", () => {
  it("debe retornar la lista de tipos de afectación válidos con status 200 en modo simple", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toContain("Anegamiento");
    expect(body.data).toContain("Caída de árbol");
    expect(body.data).toContain("Corte de energía");
  });

  it("debe retornar el catálogo detallado con IDs cuando se pasa el parámetro catalogo=true (HU-37)", async () => {
    const mockCatalogo = [
      {
        id: "40000000-0000-4000-8000-000000000001",
        nombre: "Inundación",
        descripcion: "Acumulación desmedida de agua",
        activo: true,
      },
      {
        id: "40000000-0000-4000-8000-000000000003",
        nombre: "Caída de árbol",
        descripcion: "Obstrucción por ramas o troncos",
        activo: true,
      },
    ];

    const spy = vi
      .spyOn(tipologiaServiceModule.tipologiaService, "listarTipos")
      .mockResolvedValueOnce(mockCatalogo);

    const req = new NextRequest("http://localhost:3000/api/incidentes/tipos?catalogo=true");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(spy).toHaveBeenCalled();
    expect(body.message).toContain("Catálogo oficial de tipos de incidente");
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toHaveProperty("id", "40000000-0000-4000-8000-000000000001");
    expect(body.data[0]).toHaveProperty("nombre", "Inundación");
  });
});
