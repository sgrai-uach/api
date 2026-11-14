import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../route";
import * as recuperacionService from "@/modules/eventos-atp/recuperacion.service";
import { NotFoundError } from "@/modules/eventos-atp/recuperacion.service";
import type { RecuperacionDetalleResponse } from "@/modules/eventos-atp/recuperacion.schema";
import * as authGuard from "@/modules/seguridad/auth.guard";
import { ForbiddenError } from "@/modules/seguridad/auth.errors";

describe("Route Handler GET /api/eventos-atp/recuperacion/[id] (HU-73 - Drawer)", () => {
  const usuarioEncargadoId = "00000000-0000-4000-8000-000000000003";
  const operativoValidoId = "70000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("debe responder 401 si no hay usuario autenticado", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(null);

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoValidoId}`);
    const res = await GET(req, { params: Promise.resolve({ id: operativoValidoId }) });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain("autenticación");
  });

  it("debe responder 400 si el parámetro id no es un UUID válido", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

    const req = new NextRequest("http://localhost:3000/api/eventos-atp/recuperacion/id-invalido", {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "id-invalido" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("UUID válido");
  });

  it("debe responder 403 si el usuario carece del permiso recuperacion:leer", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(recuperacionService, "obtenerDetalleRecuperacionService").mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: recuperacion:leer")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoValidoId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: operativoValidoId }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("recuperacion:leer");
  });

  it("debe responder 404 si el operativo no existe", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);
    vi.spyOn(recuperacionService, "obtenerDetalleRecuperacionService").mockRejectedValueOnce(
      new NotFoundError("Operativo no encontrado")
    );

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoValidoId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: operativoValidoId }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("no encontrado");
  });

  it("debe responder 200 y retornar el detalle completo para el drawer", async () => {
    vi.spyOn(authGuard, "extraerUsuarioId").mockResolvedValueOnce(usuarioEncargadoId);

    const detalleMock: RecuperacionDetalleResponse = {
      id: operativoValidoId,
      codigo: "REC-2026-0001",
      nombre: "Entrega de frazadas en Collico",
      descripcion: "Familias damnificadas",
      sector: "Collico",
      direccionTexto: "Calle Los Robles 123",
      prioridad: "ALTA",
      contactoNombre: "Don Pedro",
      contactoTelefono: "+56999887766",
      latitud: -39.8142,
      longitud: -73.2459,
      estado: "PLANIFICADA",
      familiasAfectadas: 4,
      delegacion: {
        id: "30000000-0000-4000-8000-000000000001",
        codigo: "DEL-SUR",
        nombre: "Delegación Municipal Sur",
      },
      creadoPor: {
        id: usuarioEncargadoId,
        nombre: "Encargado de Operaciones",
      },
      mision: {
        id: "60000000-0000-4000-8000-000000000001",
        codigo: "MIS-2026-0001",
        titulo: "Entrega de frazadas en Collico",
        estado: "DESPACHADA",
        tipoMision: "RECUPERACION",
      },
      patrulla: {
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Verificadora Alfa",
        estado: "EN_RECUPERACION",
      },
      recursos: [
        {
          recursoId: "80000000-0000-4000-8000-000000000001",
          nombre: "Frazadas Térmicas",
          cantidadAsignada: 10,
        },
      ],
      cantidadInsumosAsignados: 10,
      totalTiposInsumos: 1,
      historial: [
        {
          id: `rec-creacion-${operativoValidoId}`,
          tipo: "CREACION",
          titulo: "Operativo Planificado y Despachado",
          descripcion: "Familias damnificadas",
          registradoPor: {
            id: usuarioEncargadoId,
            nombre: "Encargado de Operaciones",
          },
          creadoEn: "2026-11-01T10:00:00.000Z",
        },
      ],
      creadoEn: "2026-11-01T10:00:00.000Z",
      actualizadoEn: "2026-11-01T10:00:00.000Z",
      fechaCierre: null,
      observacionesCierre: null,
    };

    vi.spyOn(recuperacionService, "obtenerDetalleRecuperacionService").mockResolvedValueOnce(detalleMock);

    const req = new NextRequest(`http://localhost:3000/api/eventos-atp/recuperacion/${operativoValidoId}`, {
      headers: { "x-user-id": usuarioEncargadoId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: operativoValidoId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.codigo).toBe("REC-2026-0001");
    expect(body.data.historial).toHaveLength(1);
    expect(body.data.recursos[0].nombre).toBe("Frazadas Térmicas");
  });
});
