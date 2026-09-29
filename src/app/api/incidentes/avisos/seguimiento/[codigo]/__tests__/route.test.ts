import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as service from "@/modules/incidentes/aviso-incidente.service";

describe("Endpoint GET /api/incidentes/avisos/seguimiento/[codigo]", () => {
  it("debe responder 400 si el código de seguimiento está vacío o solo contiene espacios", async () => {
    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos/seguimiento/%20");
    const res = await GET(req, { params: Promise.resolve({ codigo: "   " }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("código de seguimiento es obligatorio");
  });

  it("debe responder 404 si el reporte no existe", async () => {
    vi.spyOn(service, "consultarAvisoPorSeguimiento").mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos/seguimiento/99999999");
    const res = await GET(req, { params: Promise.resolve({ codigo: "99999999" }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("No se encontró ningún reporte");
  });

  it("debe responder 200 con el estado del reporte, etiqueta y descripción amigable si existe", async () => {
    vi.spyOn(service, "consultarAvisoPorSeguimiento").mockResolvedValue({
      codigoSeguimiento: "58291045",
      estado: "EN_ATENCION",
      estadoEtiqueta: "En Atención",
      estadoDescripcion:
        "El incidente fue confirmado en terreno y una cuadrilla operativa municipal está trabajando en el lugar para atender la emergencia.",
      tipoAfectacion: "Anegamiento",
      direccionAproximada: "Av. Alemania 550",
      descripcion: null,
      creadoEn: "2026-09-07T15:00:00.000Z",
      actualizadoEn: "2026-09-07T16:00:00.000Z",
      esDuplicado: false,
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos/seguimiento/58291045");
    const res = await GET(req, { params: Promise.resolve({ codigo: "58291045" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.codigoSeguimiento).toBe("58291045");
    expect(body.data.estado).toBe("EN_ATENCION");
    expect(body.data.estadoEtiqueta).toBe("En Atención");
    expect(body.data.estadoDescripcion).toContain("cuadrilla operativa municipal");
    expect(body.data.tipoAfectacion).toBe("Anegamiento");
  });
});
