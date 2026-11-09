import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  actualizarEstadoNotificacionService,
  listarMisionesPendientesTerrenoService,
} from "../notificacion-mision.service";
import * as notifRepo from "../notificacion-mision.repository";
import * as socketLib from "@/lib/socket";
import { ForbiddenError } from "@/modules/seguridad/errors";

vi.mock("../notificacion-mision.repository", () => ({
  actualizarEstadoNotificacionIdempotenteRepo: vi.fn(),
  listarMisionesPendientesTerrenoRepo: vi.fn(),
  obtenerPatrullaDeUsuarioRepo: vi.fn(),
}));

vi.mock("@/lib/socket", () => ({
  notificarTrazabilidadActualizada: vi.fn(),
}));

describe("Notificacion Mision Service (HU-35)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("actualizarEstadoNotificacionService", () => {
    it("debe actualizar el estado a RECIBIDA y emitir trazabilidad a la Central", async () => {
      const mockDetalle = {
        id: "70000000-0000-4000-8000-000000000001",
        misionId: "60000000-0000-4000-8000-000000000001",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
        estado: "RECIBIDA" as const,
        intentosEnvio: 1,
        creadaAt: "2026-11-09T17:00:00.000Z",
        enviadaAt: "2026-11-09T17:00:01.000Z",
        recibidaAt: "2026-11-09T17:00:03.000Z",
        leidaAt: null,
      };

      vi.mocked(notifRepo.actualizarEstadoNotificacionIdempotenteRepo).mockResolvedValueOnce(mockDetalle);

      const res = await actualizarEstadoNotificacionService(
        mockDetalle.id,
        "RECIBIDA",
        "00000000-0000-4000-8000-000000000010"
      );

      expect(notifRepo.actualizarEstadoNotificacionIdempotenteRepo).toHaveBeenCalledWith(
        mockDetalle.id,
        "RECIBIDA",
        "00000000-0000-4000-8000-000000000010",
        false
      );
      expect(socketLib.notificarTrazabilidadActualizada).toHaveBeenCalledWith(
        expect.objectContaining({
          notificacionId: mockDetalle.id,
          estado: "RECIBIDA",
          patrullaId: mockDetalle.patrullaId,
        })
      );
      expect(res.data.estado).toBe("RECIBIDA");
      expect(res.data.recibidaAt).toBe(mockDetalle.recibidaAt);
    });

    it("debe actualizar el estado a LEIDA y emitir trazabilidad a la Central", async () => {
      const mockDetalle = {
        id: "70000000-0000-4000-8000-000000000001",
        misionId: "60000000-0000-4000-8000-000000000001",
        patrullaId: "f1000000-0000-4000-8000-000000000001",
        estado: "LEIDA" as const,
        intentosEnvio: 1,
        creadaAt: "2026-11-09T17:00:00.000Z",
        enviadaAt: "2026-11-09T17:00:01.000Z",
        recibidaAt: "2026-11-09T17:00:03.000Z",
        leidaAt: "2026-11-09T17:00:10.000Z",
      };

      vi.mocked(notifRepo.actualizarEstadoNotificacionIdempotenteRepo).mockResolvedValueOnce(mockDetalle);

      const res = await actualizarEstadoNotificacionService(
        mockDetalle.id,
        "LEIDA",
        "00000000-0000-4000-8000-000000000010"
      );

      expect(socketLib.notificarTrazabilidadActualizada).toHaveBeenCalledWith(
        expect.objectContaining({
          notificacionId: mockDetalle.id,
          estado: "LEIDA",
        })
      );
      expect(res.data.estado).toBe("LEIDA");
      expect(res.data.leidaAt).toBe(mockDetalle.leidaAt);
    });
  });

  describe("listarMisionesPendientesTerrenoService", () => {
    it("debe retornar misiones pendientes para la patrulla del usuario autenticado", async () => {
      vi.mocked(notifRepo.obtenerPatrullaDeUsuarioRepo).mockResolvedValueOnce({
        id: "f1000000-0000-4000-8000-000000000001",
        nombre: "Patrulla Norte 1",
      });

      const pendientesMock = [
        {
          notificacionId: "70000000-0000-4000-8000-000000000001",
          misionId: "60000000-0000-4000-8000-000000000001",
          codigoMision: "MIS-2026-0001",
          titulo: "Verificación de Aniego",
          descripcion: null,
          tipoMision: "VERIFICACION",
          prioridad: "ALTA",
          estadoMision: "DESPACHADA",
          estadoNotificacion: "PENDIENTE_ENVIO" as const,
          patrullaId: "f1000000-0000-4000-8000-000000000001",
          incidenteId: "50000000-0000-4000-8000-000000000001",
          incidenteCodigo: "INC-2026-8869",
          incidenteFolio: "FOL-8869",
          tipoAfectacion: "Anegamiento",
          direccion: "Calle Errázuriz 400",
          latitud: -39.815,
          longitud: -73.242,
          creadaAt: "2026-11-09T17:00:00.000Z",
          enviadaAt: null,
        },
      ];

      vi.mocked(notifRepo.listarMisionesPendientesTerrenoRepo).mockResolvedValueOnce(pendientesMock);

      const res = await listarMisionesPendientesTerrenoService("00000000-0000-4000-8000-000000000010");

      expect(res.total).toBe(1);
      expect(res.data[0].codigoMision).toBe("MIS-2026-0001");
      expect(res.data[0].estadoNotificacion).toBe("PENDIENTE_ENVIO");
    });

    it("debe lanzar ForbiddenError si el usuario no pertenece a ninguna patrulla activa", async () => {
      vi.mocked(notifRepo.obtenerPatrullaDeUsuarioRepo).mockResolvedValueOnce(null);

      await expect(
        listarMisionesPendientesTerrenoService("00000000-0000-4000-8000-000000000099", false)
      ).rejects.toThrow(ForbiddenError);
    });

    it("debe permitir a Administrador filtrar por patrullaIdQuery", async () => {
      const patrullaTarget = "f2000000-0000-4000-8000-000000000002";
      vi.mocked(notifRepo.listarMisionesPendientesTerrenoRepo).mockResolvedValueOnce([]);

      const res = await listarMisionesPendientesTerrenoService(
        "00000000-0000-4000-8000-000000000001",
        true,
        patrullaTarget
      );

      expect(notifRepo.listarMisionesPendientesTerrenoRepo).toHaveBeenCalledWith(patrullaTarget);
      expect(res.total).toBe(0);
    });
  });
});
