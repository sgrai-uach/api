import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, NotFoundError } from "@/modules/seguridad/errors";
import { subirEvidenciaService, listarEvidenciaService } from "../evidencia.service";
import * as storage from "../evidencia.storage";
import * as repository from "../evidencia.repository";
import * as socket from "@/lib/socket";

vi.mock("../evidencia.storage", () => ({
  validarArchivoEvidencia: vi.fn(),
  guardarArchivoEvidencia: vi.fn(),
}));

vi.mock("../evidencia.repository", () => ({
  validarAsociacionYAutorizacionAdjuntoRepo: vi.fn(),
  insertarAdjuntoRepository: vi.fn(),
  listarAdjuntosRepository: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarAdjuntoCreado: vi.fn(),
}));

describe("evidencia.service (HU-43)", () => {
  const usuarioDemo = {
    id: "00000000-0000-4000-8000-000000000005",
    rol: "Delegado de Cuadrilla",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.validarArchivoEvidencia).mockReturnValue("image/jpeg");
    vi.mocked(repository.validarAsociacionYAutorizacionAdjuntoRepo).mockResolvedValue({
      incidenteId: "50000000-0000-4000-8000-000000000001",
      misionId: "d1000000-0000-4000-8000-000000000002",
    });
  });

  it("debe validar autorización/existencia antes de guardar en disco, insertar en adjunto y emitir adjunto:creado", async () => {
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
      usuario: usuarioDemo,
    });

    expect(resultado).toEqual({
      id: "80000000-0000-4000-8000-000000000001",
      nombreArchivo: "evidencia.jpg",
      url: "/uploads/evidencia/abc123.webp",
      tipoMime: "image/webp",
      tamanoBytes: 12345,
      incidenteId: "50000000-0000-4000-8000-000000000001",
      reporteTerrenoId: null,
      misionId: "d1000000-0000-4000-8000-000000000002",
      creadoEn: "2026-11-17T20:00:00.000Z",
    });

    expect(socket.notificarAdjuntoCreado).toHaveBeenCalledWith(resultado);
  });

  it("no debe escribir archivo en disco si falla la existencia (404) o autorización (403) en BD (BUG-H43-API-04)", async () => {
    vi.mocked(repository.validarAsociacionYAutorizacionAdjuntoRepo).mockRejectedValueOnce(
      new NotFoundError("No existe incidente")
    );

    await expect(
      subirEvidenciaService({
        buffer: Buffer.from("fake"),
        originalName: "evidencia.jpg",
        declaredMime: "image/jpeg",
        size: 4,
        fields: { incidente_id: "99999999-9999-4999-8999-999999999999" },
        usuario: usuarioDemo,
      })
    ).rejects.toThrow(NotFoundError);

    expect(storage.guardarArchivoEvidencia).not.toHaveBeenCalled();

    vi.mocked(repository.validarAsociacionYAutorizacionAdjuntoRepo).mockRejectedValueOnce(
      new ForbiddenError("Otra unidad")
    );

    await expect(
      subirEvidenciaService({
        buffer: Buffer.from("fake"),
        originalName: "evidencia.jpg",
        declaredMime: "image/jpeg",
        size: 4,
        fields: { incidente_id: "50000000-0000-4000-8000-000000000001" },
        usuario: usuarioDemo,
      })
    ).rejects.toThrow(ForbiddenError);

    expect(storage.guardarArchivoEvidencia).not.toHaveBeenCalled();
  });

  it("no debe fallar con 500 si notificarAdjuntoCreado lanza una excepción", async () => {
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
      creado_en: "2026-11-17T20:00:00.000Z",
    });
    vi.mocked(socket.notificarAdjuntoCreado).mockImplementationOnce(() => {
      throw new Error("Redis desconectado");
    });

    const res = await subirEvidenciaService({
      buffer: Buffer.from("fake"),
      originalName: "evidencia.jpg",
      declaredMime: "image/jpeg",
      size: 4,
      fields: { incidente_id: "50000000-0000-4000-8000-000000000001" },
      usuario: usuarioDemo,
    });

    expect(res.id).toBe("80000000-0000-4000-8000-000000000001");
  });

  it("debe listar adjuntos mapeados cronológicamente vía listarEvidenciaService", async () => {
    vi.mocked(repository.listarAdjuntosRepository).mockResolvedValueOnce([
      {
        id: "80000000-0000-4000-8000-000000000001",
        nombre_archivo: "foto.jpg",
        url: "uploads/evidencia/foto.webp",
        tipo_mime: "image/webp",
        tamano_bytes: 1024,
        incidente_id: "50000000-0000-4000-8000-000000000001",
        reporte_terreno_id: null,
        creado_en: "2026-11-17T20:00:00.000Z",
      },
    ]);

    const lista = await listarEvidenciaService({
      incidente_id: "50000000-0000-4000-8000-000000000001",
    });
    expect(lista).toHaveLength(1);
    expect(lista[0].url).toBe("/uploads/evidencia/foto.webp");
  });
});
