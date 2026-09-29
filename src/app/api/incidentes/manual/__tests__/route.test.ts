import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as authService from "@/modules/seguridad/auth.service";
import * as incidentesService from "@/modules/incidentes/aviso-incidente.service";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Endpoint POST /api/incidentes/manual", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe responder 401 si no se provee la cabecera X-User-Id", async () => {
    vi.spyOn(authService, "verificarPermiso").mockRejectedValue(
      new UnauthorizedError("Se requiere cabecera de autenticación X-User-Id.")
    );

    const req = new NextRequest("http://localhost:3000/api/incidentes/manual", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.message).toContain("X-User-Id");
  });

  it("debe responder 403 si el usuario no tiene el permiso crear_incidente_manual", async () => {
    vi.spyOn(authService, "verificarPermiso").mockRejectedValue(
      new ForbiddenError("No cuenta con el permiso requerido: crear_incidente_manual")
    );

    const req = new NextRequest("http://localhost:3000/api/incidentes/manual", {
      method: "POST",
      headers: { "x-user-id": "user-sin-permiso" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.message).toContain("crear_incidente_manual");
  });

  it("debe responder 400 si el body no es un JSON válido", async () => {
    vi.spyOn(authService, "verificarPermiso").mockResolvedValue({
      id: "operador-id",
      nombre: "Operador Call Center",
      rol: "Call Center",
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/manual", {
      method: "POST",
      headers: { "x-user-id": "operador-id" },
      body: "json-invalido",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("JSON válido");
  });

  it("debe responder 400 si faltan campos obligatorios o el RUT es inválido", async () => {
    vi.spyOn(authService, "verificarPermiso").mockResolvedValue({
      id: "operador-id",
      nombre: "Operador Call Center",
      rol: "Call Center",
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "operador-id",
      },
      body: JSON.stringify({
        origenReporte: "LLAMADA_TELEFONICA",
        tipoAfectacion: "Anegamiento",
        descripcion: "Agua", // Demasiado corto
        direccion: "Val", // Demasiado corto
        informanteNombre: "A",
        informanteRut: "11111111-9", // DV erróneo
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("Datos de entrada inválidos");
    expect(Array.isArray(data.errors)).toBe(true);
    expect(data.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("debe responder 409 Conflict si se detecta duplicado cercano y forzarCreacion es false", async () => {
    vi.spyOn(authService, "verificarPermiso").mockResolvedValue({
      id: "operador-id",
      nombre: "Operador Call Center",
      rol: "Call Center",
    });

    const mockDuplicados = [
      {
        id: "dup-1",
        codigo: "INC-888888",
        tipoAfectacion: "Caída de árbol",
        direccion: "Picarte 2010",
        estado: "REPORTADO",
        distanciaMetros: 20,
        creadoEn: "2026-09-13T18:00:00Z",
        origen: "incidente" as const,
      },
    ];

    vi.spyOn(incidentesService, "crearIncidenteManual").mockRejectedValue(
      new incidentesService.ConflictoDuplicadoError(
        "Se detectaron incidentes o reportes similares en la misma zona recientemente.",
        mockDuplicados
      )
    );

    const req = new NextRequest("http://localhost:3000/api/incidentes/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "operador-id",
      },
      body: JSON.stringify({
        origenReporte: "LLAMADA_TELEFONICA",
        tipoAfectacion: "Caída de árbol",
        descripcion: "Árbol derribado sobre automóvil",
        direccion: "Picarte 2000",
        informanteNombre: "Vecino Picarte",
        informanteRut: "11111111-1",
        forzarCreacion: false,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.requiereConfirmacion).toBe(true);
    expect(data.duplicados).toHaveLength(1);
    expect(data.duplicados[0].codigo).toBe("INC-888888");
  });

  it("debe responder 201 Created al persistir exitosamente el incidente", async () => {
    vi.spyOn(authService, "verificarPermiso").mockResolvedValue({
      id: "operador-id",
      nombre: "Operador Call Center",
      rol: "Call Center",
    });

    vi.spyOn(incidentesService, "crearIncidenteManual").mockResolvedValue({
      mensaje: "Incidente ingresado exitosamente y disponible para el Encargado.",
      incidente: {
        id: "inc-uuid-1",
        codigo: "INC-2026-0001",
        tipoAfectacion: "Anegamiento",
        descripcion: "Crecida de agua en patio",
        direccion: "Av. Alemania 550",
        latitud: -39.8175,
        longitud: -73.2412,
        estado: "REPORTADO",
        prioridad: "MEDIA",
        requiereAsistenciaSocial: false,
        avisoOrigenId: "aviso-uuid-1",
        creadoPorId: "operador-id",
        creadoEn: "2026-09-13T19:00:00Z",
      },
      aviso: {
        id: "aviso-uuid-1",
        codigoSeguimiento: "84920194",
        esDuplicado: false,
        mensaje: "Aviso verificado implícitamente por operador.",
        tipoAfectacion: "Anegamiento",
        direccion: "Av. Alemania 550",
        estado: "EN_ATENCION",
        creadoEn: "2026-09-13T19:00:00Z",
        avisoOriginalId: null,
      },
    });

    const req = new NextRequest("http://localhost:3000/api/incidentes/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "operador-id",
      },
      body: JSON.stringify({
        origenReporte: "LLAMADA_TELEFONICA",
        tipoAfectacion: "Anegamiento",
        descripcion: "Crecida de agua en patio",
        direccion: "Av. Alemania 550",
        informanteNombre: "Juan Pérez",
        informanteRut: "11111111-1",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.incidente.estado).toBe("REPORTADO");
    expect(data.data.incidente.codigo).toBe("INC-2026-0001");
    expect(data.data.aviso.codigoSeguimiento).toBe("84920194");
  });
});
