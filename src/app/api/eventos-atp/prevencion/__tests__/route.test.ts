import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as eventoPrevencionService from "@/modules/eventos-atp/evento-prevencion.service";
import * as authGuard from "@/modules/seguridad/auth.guard";
import { seguridadService } from "@/modules/seguridad/service";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/modules/seguridad/errors";
import {
  PatrullaNoDisponibleError,
  NotFoundError,
  StockInsuficienteError,
} from "@/modules/eventos-atp/evento-prevencion.service";

describe("Route Handlers /api/eventos-atp/prevencion (HU-30)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const payloadValido = {
    nombre: "Inspección preventiva y limpieza de cauce",
    descripcion: "Revisión técnica de colectores en sector Angachilla ante pronóstico de lluvias.",
    sector: "Humedal Angachilla",
    direccionTexto: "Pasaje Los Robles s/n con Simpson",
    prioridad: "ALTA",
    delegacionId: "30000000-0000-4000-8000-000000000001",
    puntoCriticoId: "40000000-0000-4000-8000-000000000001",
    latitud: -39.8456,
    longitud: -73.2389,
    patrullaId: "50000000-0000-4000-8000-000000000001",
    recursos: [
      {
        recursoId: "00000000-0000-4000-8000-000000000001",
        cantidad: 5,
      },
    ],
  };

  it("debe retornar 401 si no se envía cabecera de autenticación o token inválido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Token de sesión inválido o expirado.")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/prevencion", {
      method: "POST",
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("Token de sesión inválido");
  });

  it("debe retornar 403 si el usuario no tiene permisos suficientes para crear eventos de prevención", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(
      "00000000-0000-4000-8000-000000000099"
    );
    vi.spyOn(seguridadService, "validarAccesoRoles").mockRejectedValueOnce(
      new ForbiddenError("Acceso denegado. Permiso insuficiente.")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/prevencion", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("Acceso denegado");
  });

  it("debe retornar 400 si el cuerpo de la petición no es un JSON válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(
      "00000000-0000-4000-8000-000000000001"
    );
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/prevencion", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: "json-invalido{",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("JSON válido");
  });

  it("debe retornar 400 si la validación de entrada falla (descripción corta o delegación ausente)", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(
      "00000000-0000-4000-8000-000000000001"
    );
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/prevencion", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify({
        ...payloadValido,
        descripcion: "ab", // menos de 5 caracteres
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Datos de entrada inválidos");
    expect(body.errors).toBeDefined();
  });

  it("debe retornar 404 si la patrulla, delegación o punto crítico no existen", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(
      "00000000-0000-4000-8000-000000000001"
    );
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);
    vi.spyOn(eventoPrevencionService, "crearEventoPrevencionService").mockRejectedValueOnce(
      new NotFoundError("La patrulla verificadora indicada no fue encontrada.")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/prevencion", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("no fue encontrada");
  });

  it("debe retornar 409 si la patrulla verificadora no está disponible", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(
      "00000000-0000-4000-8000-000000000001"
    );
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);
    vi.spyOn(eventoPrevencionService, "crearEventoPrevencionService").mockRejectedValueOnce(
      new PatrullaNoDisponibleError(
        'La patrulla "Patrulla Alfa" no está disponible para asignación (estado actual: EN_VERIFICACION).'
      )
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/prevencion", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("no está disponible");
  });

  it("debe retornar 409 si el stock de recursos solicitados es insuficiente", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(
      "00000000-0000-4000-8000-000000000001"
    );
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);
    vi.spyOn(eventoPrevencionService, "crearEventoPrevencionService").mockRejectedValueOnce(
      new StockInsuficienteError(
        'Stock insuficiente para el recurso "Sacos de Arena". Solicitado: 5, Disponible: 2.'
      )
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/prevencion", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toContain("Stock insuficiente");
  });

  it("debe retornar 201 y el evento creado si la solicitud es válida (flujo feliz)", async () => {
    const mockRespuesta = {
      id: "70000000-0000-4000-8000-000000000001",
      codigo: "PREV-2026-0001",
      nombre: payloadValido.nombre,
      descripcion: payloadValido.descripcion,
      sector: payloadValido.sector,
      direccionTexto: payloadValido.direccionTexto,
      prioridad: payloadValido.prioridad,
      estado: "PLANIFICADA" as const,
      latitud: payloadValido.latitud,
      longitud: payloadValido.longitud,
      puntoCritico: {
        id: payloadValido.puntoCriticoId,
        codigo: "PC-ANG-01",
        nombre: "Sector Humedal Angachilla",
      },
      delegacion: {
        id: payloadValido.delegacionId,
        codigo: "DEL-SUR",
        nombre: "Delegación Municipal Sur",
      },
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0001",
        titulo: payloadValido.nombre,
        estado: "DESPACHADA",
        tipoMision: "PREVENCION",
      },
      patrulla: {
        id: payloadValido.patrullaId,
        nombre: "Patrulla Verificadora Alfa",
        estado: "EN_PREVENCION",
      },
      recursos: [
        {
          recursoId: payloadValido.recursos[0].recursoId,
          nombre: "Sacos de Arena",
          cantidadAsignada: 5,
        },
      ],
      creadoPorId: "00000000-0000-4000-8000-000000000001",
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(
      "00000000-0000-4000-8000-000000000001"
    );
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);
    vi.spyOn(eventoPrevencionService, "crearEventoPrevencionService").mockResolvedValueOnce(
      mockRespuesta
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/prevencion", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toContain("creado y patrulla despachada exitosamente");
    expect(body.data.codigo).toBe("PREV-2026-0001");
    expect(body.data.mision.estado).toBe("DESPACHADA");
    expect(body.data.patrulla.estado).toBe("EN_PREVENCION");
  });

  it("debe retornar 500 si ocurre un error inesperado no controlado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(
      "00000000-0000-4000-8000-000000000001"
    );
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({} as any);
    vi.spyOn(eventoPrevencionService, "crearEventoPrevencionService").mockRejectedValueOnce(
      new Error("Fallo de conexión a la base de datos")
    );

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/prevencion", {
      method: "POST",
      headers: { authorization: "Bearer valid-token" },
      body: JSON.stringify(payloadValido),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain("Error interno del servidor");
  });
});
