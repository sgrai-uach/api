import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";

describe("Endpoint POST /api/recursos", () => {
  it("debe responder 400 si el cuerpo no es un JSON válido", async () => {
    const req = new NextRequest("http://localhost:3000/api/recursos", {
      method: "POST",
      body: "esto no es json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("JSON válido");
  });

  it("debe responder 400 si faltan campos obligatorios en el esquema", async () => {
    const req = new NextRequest("http://localhost:3000/api/recursos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "AB", // Demasiado corto
        cantidadInventario: -1, // Negativo
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe("Datos de entrada inválidos.");
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("debe responder 401 si no se envía la cabecera X-User-Id", async () => {
    const req = new NextRequest("http://localhost:3000/api/recursos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: "Generador 5kVA",
        cantidadInventario: 1,
        latitud: -39.8142,
        longitud: -73.2459,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("X-User-Id");
  });
});
