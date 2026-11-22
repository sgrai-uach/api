import { describe, it, expect, vi, beforeEach } from "vitest";
import { subirEvidenciaService } from "../evidencia.service";
import * as storage from "../evidencia.storage";
import * as repository from "../evidencia.repository";
import * as socket from "@/lib/socket";

vi.mock("../evidencia.storage", () => ({
  guardarArchivoEvidencia: vi.fn(),
}));

vi.mock("../evidencia.repository", () => ({
  insertarAdjuntoRepository: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarAdjuntoCreado: vi.fn(),
}));

describe("evidencia.service (HU-43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debe guardar archivo, insertar en adjunto y emitir adjunto:creado", async () => {
    const fakeDate = new Date("2026-11-17T20:00:00.000Z");

    vi.mocked(storage.guardarArchivoEvidencia).mockResolvedValue({
      nombreArchivo: "evidencia.jpg",
      url: "/uploads/evidencia/abc123.webp",
      tipoMime: "image/webp",
      tamanoBytes: 12345,
      sha256Hash: "abc123",
    });

    vi.mocked(repository.insertarAdjuntoRepository).mockResolvedValue({
      id: "80000000-0000-4000-8000-000000000001",
      nombre_archivo: "evidencia.jpg",
      url: "/uploads/evidencia/abc123.webp",
      tipo_mime: "image/webp",
      tamano_bytes: 12345,
      incidente_id: "50000000-0000-4000-8000-000000000001",
      reporte_terreno_id: null,
      creado_en: fakeDate,
    });

    const resultado = await subirEvidenciaService({
      buffer: Buffer.from("fake"),
      originalName: "evidencia.jpg",
      declaredMime: "image/jpeg",
      size: 4,
      fields: {
        incidente_id: "50000000-0000-4000-8000-000000000001",
      },
    });

    expect(resultado).toEqual({
      id: "80000000-0000-4000-8000-000000000001",
      nombreArchivo: "evidencia.jpg",
      url: "/uploads/evidencia/abc123.webp",
      tipoMime: "image/webp",
      tamanoBytes: 12345,
      incidenteId: "50000000-0000-4000-8000-000000000001",
      reporteTerrenoId: null,
      creadoEn: "2026-11-17T20:00:00.000Z",
    });

    expect(socket.notificarAdjuntoCreado).toHaveBeenCalledWith(resultado);
  });
});
