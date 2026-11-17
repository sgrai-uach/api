import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import * as authGuard from "@/modules/seguridad/auth.guard";
import * as authService from "@/modules/seguridad/auth.service";
import * as evidenciaService from "@/modules/evidencia/evidencia.service";
import { ForbiddenError, UnauthorizedError } from "@/modules/seguridad/errors";
import {
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from "@/modules/evidencia/evidencia.schema";

vi.mock("@/modules/seguridad/auth.guard", () => ({
  extraerUsuarioId: vi.fn(),
}));

vi.mock("@/modules/seguridad/auth.service", () => ({
  verificarPermiso: vi.fn(),
}));

vi.mock("@/modules/evidencia/evidencia.service", () => ({
  subirEvidenciaService: vi.fn(),
}));

describe("POST /api/evidencia/adjuntos (HU-43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authGuard.extraerUsuarioId).mockResolvedValue("00000000-0000-4000-8000-000000000005");
    vi.mocked(authService.verificarPermiso).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000005",
      nombre: "Delegado",
      apellido: "Terreno",
      email: "delegado@valdivia.cl",
      rolId: "20000000-0000-4000-8000-000000000005",
      rolCodigo: "DELEGADO_CUADRILLA",
      rolNombre: "Delegado de Cuadrilla",
      permisos: ["reportes:crear"],
    } as never);
  });

  function crearMultipartRequest(formData: FormData): NextRequest {
    return new NextRequest("http://localhost:3000/api/evidencia/adjuntos", {
      method: "POST",
      body: formData,
    });
  }

  it("debe retornar 401 si no hay usuario autenticado", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(new UnauthorizedError());

    const formData = new FormData();
    const res = await POST(crearMultipartRequest(formData));
    expect(res.status).toBe(401);
  });

  it("debe retornar 403 si el usuario no posee el permiso reportes:crear", async () => {
    vi.mocked(authService.verificarPermiso).mockRejectedValueOnce(
      new ForbiddenError("Acceso denegado.")
    );

    const formData = new FormData();
    const res = await POST(crearMultipartRequest(formData));
    expect(res.status).toBe(403);
  });

  it("debe retornar 400 si falta incidente_id y reporte_terreno_id", async () => {
    const formData = new FormData();
    formData.append("file", new File(["%PDF-1.7"], "doc.pdf", { type: "application/pdf" }));

    const res = await POST(crearMultipartRequest(formData));
    expect(res.status).toBe(400);
  });

  it("debe retornar 413 cuando el archivo supera 10 MB", async () => {
    vi.mocked(evidenciaService.subirEvidenciaService).mockRejectedValueOnce(
      new PayloadTooLargeError()
    );

    const formData = new FormData();
    formData.append("file", new File(["%PDF-1.7"], "grande.pdf", { type: "application/pdf" }));
    formData.append("incidente_id", "50000000-0000-4000-8000-000000000001");

    const res = await POST(crearMultipartRequest(formData));
    expect(res.status).toBe(413);
  });

  it("debe retornar 415 cuando el MIME o firma binaria no está permitida", async () => {
    vi.mocked(evidenciaService.subirEvidenciaService).mockRejectedValueOnce(
      new UnsupportedMediaTypeError()
    );

    const formData = new FormData();
    formData.append("file", new File(["MZ..."], "virus.exe", { type: "application/x-msdownload" }));
    formData.append("reporte_terreno_id", "70000000-0000-4000-8000-000000000001");

    const res = await POST(crearMultipartRequest(formData));
    expect(res.status).toBe(415);
  });

  it("debe retornar 201 Created cuando la evidencia se sube correctamente", async () => {
    const esperado = {
      id: "80000000-0000-4000-8000-000000000001",
      nombreArchivo: "foto.jpg",
      url: "/uploads/evidencia/hash.webp",
      tipoMime: "image/webp",
      tamanoBytes: 2048,
      incidenteId: "50000000-0000-4000-8000-000000000001",
      reporteTerrenoId: null,
      creadoEn: "2026-11-17T20:00:00.000Z",
    };

    vi.mocked(evidenciaService.subirEvidenciaService).mockResolvedValueOnce(esperado);

    const formData = new FormData();
    formData.append("file", new File(["data"], "foto.jpg", { type: "image/jpeg" }));
    formData.append("incidente_id", "50000000-0000-4000-8000-000000000001");

    const res = await POST(crearMultipartRequest(formData));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual(esperado);
  });
});
