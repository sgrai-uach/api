import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "@/modules/seguridad/errors";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import * as misionService from "@/modules/misiones/mision.service";
import type { ReportarLlegadaResponse } from "@/modules/misiones/mision-llegada.schema";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  reportarLlegadaCuadrillaService: vi.fn(),
}));

describe("Route Handler POST /api/misiones/[id]/llegada (HU-42)", () => {
  const misionIdValido = "60000000-0000-4000-8000-000000000001";
  const delegadoIdValido = "00000000-0000-4000-8000-000000000005";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 si no hay usuario autenticado", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(null);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación Authorization: Bearer <token>.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/llegada`, {
      method: "POST",
      body: JSON.stringify({ latitud: -39.8142, longitud: -73.2459 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: misionIdValido }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("autenticación");
  });

  it("debe retornar 403 si el usuario carece del permiso misiones:terreno:ejecutar", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: misiones:terreno:ejecutar")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/llegada`, {
      method: "POST",
      body: JSON.stringify({ latitud: -39.8142, longitud: -73.2459 }),
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer token-invalido",
      },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: misionIdValido }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("misiones:terreno:ejecutar");
  });

  it("debe retornar 400 si el parámetro id de la ruta no es un UUID válido", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Pedro Delegado",
      rol: "DELEGADO_CUADRILLA",
    });

    const req = new NextRequest("http://localhost:3000/api/misiones/id-invalido/llegada", {
      method: "POST",
      body: JSON.stringify({ latitud: -39.8142, longitud: -73.2459 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: "id-invalido" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("UUID válido");
  });

  it("debe retornar 400 si las coordenadas GPS están fuera de rango", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Pedro Delegado",
      rol: "DELEGADO_CUADRILLA",
    });

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/llegada`, {
      method: "POST",
      body: JSON.stringify({ latitud: -95.0, longitud: -73.2459 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: misionIdValido }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("geolocalización");
  });

  it("debe retornar 403 si el servicio rechaza porque el usuario no es el delegado asignado", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Pedro Delegado",
      rol: "DELEGADO_CUADRILLA",
    });

    vi.mocked(misionService.reportarLlegadaCuadrillaService).mockRejectedValueOnce(
      new ForbiddenError("Acceso denegado. Solo el delegado asignado a la cuadrilla de esta misión puede reportar la llegada a terreno.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/llegada`, {
      method: "POST",
      body: JSON.stringify({ latitud: -39.8142, longitud: -73.2459 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: misionIdValido }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("Solo el delegado asignado");
  });

  it("debe retornar 409 si la llegada a terreno ya fue reportada previamente", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Pedro Delegado",
      rol: "DELEGADO_CUADRILLA",
    });

    vi.mocked(misionService.reportarLlegadaCuadrillaService).mockRejectedValueOnce(
      new ConflictError("La llegada a terreno ya fue reportada previamente para esta misión.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/llegada`, {
      method: "POST",
      body: JSON.stringify({ latitud: -39.8142, longitud: -73.2459 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: misionIdValido }),
    });

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.message).toContain("ya fue reportada previamente");
  });

  it("debe retornar 404 si la misión no existe", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Pedro Delegado",
      rol: "DELEGADO_CUADRILLA",
    });

    vi.mocked(misionService.reportarLlegadaCuadrillaService).mockRejectedValueOnce(
      new NotFoundError("No se encontró ninguna misión con el identificador proporcionado.")
    );

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/llegada`, {
      method: "POST",
      body: JSON.stringify({ latitud: -39.8142, longitud: -73.2459 }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: misionIdValido }),
    });

    expect(res.status).toBe(404);
  });

  it("debe retornar 201 Created al reportar exitosamente la llegada a terreno", async () => {
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValueOnce(delegadoIdValido);
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: delegadoIdValido,
      nombre: "Pedro Delegado",
      rol: "DELEGADO_CUADRILLA",
    });

    const mockResponse: ReportarLlegadaResponse = {
      message: "Llegada a terreno reportada exitosamente.",
      data: {
        hitoId: "80000000-0000-4000-8000-000000000001",
        misionId: misionIdValido,
        codigoMision: "MIS-2026-001",
        hito: "LLEGADA_TERRENO",
        descripcion: "Llegada a terreno reportada por la brigada operativa.",
        latitud: -39.81422,
        longitud: -73.24591,
        registradoEn: "2026-11-08T19:30:00.000Z",
        registradoPor: {
          id: delegadoIdValido,
          nombre: "Pedro Delegado",
        },
        estadoMision: "EN_CURSO",
        miembrosActualizados: 4,
      },
    };

    vi.mocked(misionService.reportarLlegadaCuadrillaService).mockResolvedValueOnce(mockResponse);

    const req = new NextRequest(`http://localhost:3000/api/misiones/${misionIdValido}/llegada`, {
      method: "POST",
      body: JSON.stringify({
        latitud: -39.81422,
        longitud: -73.24591,
        observaciones: "Equipo en terreno",
      }),
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer token-delegado",
      },
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: misionIdValido }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.message).toBe("Llegada a terreno reportada exitosamente.");
    expect(json.data.hito).toBe("LLEGADA_TERRENO");
    expect(json.data.miembrosActualizados).toBe(4);
    expect(json.data.estadoMision).toBe("EN_CURSO");
  });
});

