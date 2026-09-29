import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as service from "@/modules/incidentes/aviso-incidente.service";

describe("Endpoint POST /api/incidentes/avisos", () => {
  it("debe responder 400 si el cuerpo no es un JSON válido", async () => {
    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos", {
      method: "POST",
      body: "esto no es json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("JSON válido");
  });

  it("debe responder 400 si el RUT del informante o campos obligatorios no son válidos", async () => {
    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 550",
        informanteNombre: "Juan Pérez",
        informanteRut: "11111111-9", // Inválido
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Datos de entrada inválidos.");
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("debe responder 201 Created cuando el reporte es nuevo", async () => {
    vi.spyOn(service, "registrarAvisoDesdeChatbot").mockResolvedValue({
      id: "a1111111-1111-1111-1111-111111111111",
      codigoSeguimiento: "58291045",
      esDuplicado: false,
      mensaje: "Aviso de incidente registrado exitosamente. Guarde su número de seguimiento.",
      tipoAfectacion: "Anegamiento",
      direccion: "Av. Alemania 550",
      estado: "PENDIENTE_VERIFICACION",
      creadoEn: "2026-09-07T15:00:00.000Z",
      avisoOriginalId: null,
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 550",
        informanteNombre: "Juan Pérez",
        informanteRut: "11111111-1",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.esDuplicado).toBe(false);
    expect(body.data.codigoSeguimiento).toBe("58291045");
  });

  it("debe responder 200 OK cuando se detecta un duplicado existente", async () => {
    vi.spyOn(service, "registrarAvisoDesdeChatbot").mockResolvedValue({
      id: "a2222222-2222-2222-2222-222222222222",
      codigoSeguimiento: "12345678",
      esDuplicado: true,
      mensaje: "Este incidente ya ha sido reportado previamente en esta zona. Se ha asociado su reporte al número de seguimiento existente.",
      tipoAfectacion: "Anegamiento",
      direccion: "Av. Alemania 552",
      estado: "VERIFICANDO",
      creadoEn: "2026-09-07T15:10:00.000Z",
      avisoOriginalId: "a1111111-1111-1111-1111-111111111111",
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 552",
        informanteNombre: "María Soto",
        informanteRut: "11111112-K",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.esDuplicado).toBe(true);
    expect(body.data.codigoSeguimiento).toBe("12345678");
  });
});
