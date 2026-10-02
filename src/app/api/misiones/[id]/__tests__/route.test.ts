import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";
import { UnauthorizedError, ForbiddenError } from "@/modules/seguridad/auth.errors";
import * as authService from "@/modules/seguridad/auth.service";
import * as misionService from "@/modules/misiones/mision.service";
import type { MisionDetalleCompleto } from "@/modules/misiones/mision.schema";

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/misiones/mision.service", () => ({
  obtenerDetalleMisionService: vi.fn(),
}));

describe("Route Handler GET /api/misiones/[id] (HU-17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe retornar 401 si falta cabecera de autenticación X-User-Id", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new UnauthorizedError("Se requiere cabecera de autenticación X-User-Id.")
    );

    const req = new NextRequest("http://localhost:3000/api/misiones/60000000-0000-4000-8000-000000000001");
    const res = await GET(req, {
      params: Promise.resolve({ id: "60000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toContain("X-User-Id");
  });

  it("debe retornar 403 si el rol no posee el permiso misiones:leer", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError("No cuenta con el permiso requerido: misiones:leer")
    );

    const req = new NextRequest("http://localhost:3000/api/misiones/60000000-0000-4000-8000-000000000001", {
      headers: { "x-user-id": "22222222-2222-4222-8222-222222222222" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "60000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toContain("misiones:leer");
  });

  it("debe retornar 400 si el parámetro id no es un UUID válido", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      nombre: "Encargado Operaciones",
      rol: "Encargado",
    });

    const req = new NextRequest("http://localhost:3000/api/misiones/id-invalido-123", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000003" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "id-invalido-123" }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.message).toContain("no es un UUID válido");
  });

  it("debe retornar 404 si la misión no existe", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      nombre: "Encargado Operaciones",
      rol: "Encargado",
    });

    vi.mocked(misionService.obtenerDetalleMisionService).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/misiones/60000000-0000-4000-8000-000000000099", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000003" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "60000000-0000-4000-8000-000000000099" }),
    });

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.message).toContain("No se encontró ninguna misión");
  });

  it("debe retornar 200 con el detalle exhaustivo cuando la misión existe", async () => {
    vi.mocked(authService.verificarPermiso).mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000003",
      nombre: "Encargado Operaciones",
      rol: "Encargado",
    });

    const mockDetalle: MisionDetalleCompleto = {
      id: "60000000-0000-4000-8000-000000000001",
      codigo: "MIS-2026-001",
      titulo: "Despeje de vía por caída de árbol",
      descripcion: "Retirar ramas y asegurar vía",
      tipoMision: "ATENCION_CUADRILLA",
      estado: "EN_CURSO",
      prioridad: "ALTA",
      justificacionRechazo: null,
      fechaInicio: "2026-10-02T10:00:00.000Z",
      fechaCierre: null,
      creadoEn: "2026-10-02T09:30:00.000Z",
      actualizadoEn: "2026-10-02T10:00:00.000Z",
      creadoPor: null,
      encargado: null,
      incidente: {
        id: "a0000000-0000-4000-8000-000000000001",
        codigo: "INC-2026-001",
        codigoSeguimiento: "12345678",
        tipoAfectacion: "Caída de Árbol",
        descripcion: "Árbol sobre vía",
        direccion: "Picarte 1200",
        latitud: -39.82,
        longitud: -73.24,
        estado: "EN_ATENCION",
        prioridad: "ALTA",
        requiereAsistenciaSocial: false,
        delegacionNombre: "Sur",
      },
      prevencion: null,
      cuadrilla: {
        id: "50000000-0000-4000-8000-000000000001",
        nombre: "Cuadrilla Vías 1",
        estado: "EN_MISION",
        delegacionNombre: "Sur",
        delegado: null,
        recursos: [],
      },
      patrulla: null,
      bitacoraTiempos: [
        {
          hito: "CREACION",
          fecha: "2026-10-02",
          hora: "09:30:00",
          timestamp: "2026-10-02T09:30:00.000Z",
          descripcion: "Misión registrada",
        },
      ],
      reportesTerreno: [],
    };

    vi.mocked(misionService.obtenerDetalleMisionService).mockResolvedValueOnce(mockDetalle);

    const req = new NextRequest("http://localhost:3000/api/misiones/60000000-0000-4000-8000-000000000001", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000003" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "60000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe("Detalle de misión obtenido exitosamente.");
    expect(json.data.codigo).toBe("MIS-2026-001");
    expect(json.data.incidente.codigo).toBe("INC-2026-001");
    expect(json.data.reportesTerreno).toEqual([]);
  });

  it("debe retornar 500 si ocurre un error inesperado", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(new Error("Database connection lost"));

    const req = new NextRequest("http://localhost:3000/api/misiones/60000000-0000-4000-8000-000000000001", {
      headers: { "x-user-id": "00000000-0000-4000-8000-000000000003" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "60000000-0000-4000-8000-000000000001" }),
    });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.message).toContain("Error interno del servidor");
  });
});
