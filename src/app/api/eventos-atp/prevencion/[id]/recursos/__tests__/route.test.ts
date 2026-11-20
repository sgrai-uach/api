/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as eventoPrevencionService from "@/modules/eventos-atp/evento-prevencion.service";
import {
  BadRequestError,
  ConflictoEstadoError,
  NotFoundError,
  PatrullaNoDisponibleError,
  RecursoNoDisponibleError,
  StockInsuficienteError,
} from "@/modules/eventos-atp/evento-prevencion.service";
import * as authGuard from "@/modules/seguridad/auth.guard";
import { seguridadService } from "@/modules/seguridad/service";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";
import { PERMISO_ASIGNAR_MISION } from "@/modules/seguridad/permisos.constants";

describe("Route Handler POST /api/eventos-atp/prevencion/[id]/recursos (HU-33)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";
  const eventoId = "80000000-0000-4000-8000-000000000010";
  const contextValido = { params: Promise.resolve({ id: eventoId }) };

  const payloadValido = {
    patrullaId: "50000000-0000-4000-8000-000000000001",
    recursos: [
      {
        recursoId: "80000000-0000-4000-8000-000000000001",
        cantidad: 10,
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe retornar 401 si no hay usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockRejectedValueOnce(
      new UnauthorizedError("Token de sesión inválido o expirado.")
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${eventoId}/recursos`,
      {
        method: "POST",
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await POST(req, contextValido);
    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el usuario carece del permiso misiones:asignar", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    const validarSpy = vi
      .spyOn(seguridadService, "validarAccesoRoles")
      .mockRejectedValueOnce(new ForbiddenError("No posee el permiso misiones:asignar"));

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${eventoId}/recursos`,
      {
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await POST(req, contextValido);
    expect(res.status).toBe(403);
    expect(validarSpy).toHaveBeenCalledWith(
      usuarioEncargadoId,
      [PERMISO_ASIGNAR_MISION],
      expect.any(String)
    );
  });

  it("debe retornar 400 si el parámetro id de ruta no es UUID válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({
      id: usuarioEncargadoId,
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/eventos-atp/prevencion/id-invalido/recursos",
      {
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await POST(req, { params: Promise.resolve({ id: "id-invalido" }) });
    expect(res.status).toBe(400);
  });

  it("debe retornar 400 si el cuerpo es JSON malformado, vacío o inválido según Zod", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioEncargadoId);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValue({
      id: usuarioEncargadoId,
    } as any);

    const reqJsonInvalido = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${eventoId}/recursos`,
      {
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: "{invalido",
      }
    );
    const res1 = await POST(reqJsonInvalido, contextValido);
    expect(res1.status).toBe(400);

    const reqRecursosVacios = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${eventoId}/recursos`,
      {
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify({
          patrullaId: payloadValido.patrullaId,
          recursos: [],
        }),
      }
    );
    const res2 = await POST(reqRecursosVacios, contextValido);
    expect(res2.status).toBe(400);
  });

  it("debe retornar 400 si el servicio lanza BadRequestError (ej. activo individual con cantidad > 1)", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({
      id: usuarioEncargadoId,
    } as any);
    vi.spyOn(
      eventoPrevencionService,
      "asignarRecursosPrevencionService"
    ).mockRejectedValueOnce(
      new BadRequestError('El activo individual "Motobomba" solo admite cantidad 1.')
    );

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${eventoId}/recursos`,
      {
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await POST(req, contextValido);
    expect(res.status).toBe(400);
  });

  it("debe retornar 404 si el servicio lanza NotFoundError", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({
      id: usuarioEncargadoId,
    } as any);
    vi.spyOn(
      eventoPrevencionService,
      "asignarRecursosPrevencionService"
    ).mockRejectedValueOnce(new NotFoundError("El evento de prevención indicado no fue encontrado."));

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${eventoId}/recursos`,
      {
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await POST(req, contextValido);
    expect(res.status).toBe(404);
  });

  it("debe retornar 409 ante conflictos de stock, patrulla ocupada, recurso no disponible o estado cerrado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValue(usuarioEncargadoId);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValue({
      id: usuarioEncargadoId,
    } as any);

    const errores409 = [
      new PatrullaNoDisponibleError("Patrulla no disponible."),
      new StockInsuficienteError("Stock insuficiente."),
      new RecursoNoDisponibleError("Recurso en mantención."),
      new ConflictoEstadoError("Evento en estado COMPLETADA."),
    ];

    for (const err of errores409) {
      vi.spyOn(
        eventoPrevencionService,
        "asignarRecursosPrevencionService"
      ).mockRejectedValueOnce(err);

      const req = new NextRequest(
        `http://localhost:3000/api/eventos-atp/prevencion/${eventoId}/recursos`,
        {
          method: "POST",
          headers: { authorization: "Bearer valid-token" },
          body: JSON.stringify(payloadValido),
        }
      );

      const res = await POST(req, contextValido);
      expect(res.status).toBe(409);
    }
  });

  it("debe retornar 200 OK con la misión preventiva y patrulla EN_PREVENCION en flujo exitoso", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({
      id: usuarioEncargadoId,
    } as any);

    const respuestaMock = {
      evento: {
        id: eventoId,
        codigo: "PREV-2026-0001",
        nombre: "Limpieza preventiva de colectores en Angachilla",
        estado: "PLANIFICADA" as const,
      },
      mision: {
        id: "60000000-0000-4000-8000-000000000099",
        codigo: "MIS-2026-0099",
        titulo: "Despacho preventivo: Limpieza preventiva de colectores en Angachilla",
        estado: "DESPACHADA",
        tipoMision: "PREVENCION",
      },
      patrulla: {
        id: payloadValido.patrullaId,
        nombre: "Patrulla Sur 1",
        estado: "EN_PREVENCION",
      },
      recursos: [
        {
          recursoId: payloadValido.recursos[0].recursoId,
          nombre: "Sacos de Arena 25kg",
          esIndividual: false,
          cantidadAsignada: 10,
          cantidadEnUso: 15,
          estadoRecurso: "DISPONIBLE",
        },
      ],
      asignadoEn: "2026-11-19T21:00:00.000Z",
    };

    const serviceSpy = vi
      .spyOn(eventoPrevencionService, "asignarRecursosPrevencionService")
      .mockResolvedValueOnce(respuestaMock);

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${eventoId}/recursos`,
      {
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await POST(req, contextValido);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.patrulla.estado).toBe("EN_PREVENCION");
    expect(body.data.mision.tipoMision).toBe("PREVENCION");
    expect(serviceSpy).toHaveBeenCalledWith(eventoId, payloadValido, usuarioEncargadoId);
  });

  it("debe retornar 500 si ocurre un error inesperado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(seguridadService, "validarAccesoRoles").mockResolvedValueOnce({
      id: usuarioEncargadoId,
    } as any);
    vi.spyOn(
      eventoPrevencionService,
      "asignarRecursosPrevencionService"
    ).mockRejectedValueOnce(new Error("Fallo inesperado en BD"));

    const req = new NextRequest(
      `http://localhost:3000/api/eventos-atp/prevencion/${eventoId}/recursos`,
      {
        method: "POST",
        headers: { authorization: "Bearer valid-token" },
        body: JSON.stringify(payloadValido),
      }
    );

    const res = await POST(req, contextValido);
    expect(res.status).toBe(500);
  });
});
