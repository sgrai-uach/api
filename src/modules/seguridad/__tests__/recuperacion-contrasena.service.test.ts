import { describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { BadRequestError } from "../errors";
import {
  RecuperacionContrasenaService,
  MENSAJE_RECUPERACION_GENERICO,
  MENSAJE_RESTABLECIMIENTO_EXITOSO,
  MENSAJE_TOKEN_INVALIDO,
} from "../recuperacion-contrasena.service";
import type { RecuperacionContrasenaRepository } from "../recuperacion-contrasena.repository";
import type { SeguridadRepository } from "../repository";
import type { EmailSender } from "@/lib/mail";

describe("RecuperacionContrasenaService (Unit Tests)", () => {
  let mockRepo: {
    contarSolicitudesRecientes: ReturnType<typeof vi.fn>;
    crearTokenInvalidandoPrevios: ReturnType<typeof vi.fn>;
    obtenerTokenParaRestablecer: ReturnType<typeof vi.fn>;
    consumirTokenYRestablecerContrasena: ReturnType<typeof vi.fn>;
  };

  let mockUserRepo: {
    obtenerUsuarioParaLogin: ReturnType<typeof vi.fn>;
  };

  let mockEmailSender: {
    send: ReturnType<typeof vi.fn>;
  };

  let service: RecuperacionContrasenaService;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockRepo = {
      contarSolicitudesRecientes: vi.fn().mockResolvedValue(0),
      crearTokenInvalidandoPrevios: vi.fn().mockResolvedValue(undefined),
      obtenerTokenParaRestablecer: vi.fn().mockResolvedValue(null),
      consumirTokenYRestablecerContrasena: vi.fn().mockResolvedValue(undefined),
    };

    mockUserRepo = {
      obtenerUsuarioParaLogin: vi.fn().mockResolvedValue(null),
    };

    mockEmailSender = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    service = new RecuperacionContrasenaService(
      mockRepo as unknown as RecuperacionContrasenaRepository,
      mockUserRepo as unknown as SeguridadRepository,
      () => mockEmailSender as unknown as EmailSender
    );
  });

  describe("1. Protección Anti-Enumeración y Solicitud de Recuperación", () => {
    it("debe retornar mensaje genérico cuando el usuario existe y está activo", async () => {
      mockUserRepo.obtenerUsuarioParaLogin.mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Carlos Miranda",
        email: "carlos.miranda@valdivia.cl",
        activo: true,
        intentos_fallidos: 0,
        bloqueado_hasta: null,
      });

      const response = await service.solicitarRecuperacion({
        identificador: "carlos.miranda@valdivia.cl",
      });

      expect(response.message).toBe(MENSAJE_RECUPERACION_GENERICO);
      expect(mockRepo.crearTokenInvalidandoPrevios).toHaveBeenCalledTimes(1);
      expect(mockEmailSender.send).toHaveBeenCalledTimes(1);

      const emailArgs = mockEmailSender.send.mock.calls[0][0];
      expect(emailArgs.to).toBe("carlos.miranda@valdivia.cl");
      expect(emailArgs.text).toContain("restablecer-contrasena?token=");
    });

    it("debe responder el idéntico mensaje genérico sin emitir token ni correo si el usuario NO existe", async () => {
      mockUserRepo.obtenerUsuarioParaLogin.mockResolvedValueOnce(null);

      const response = await service.solicitarRecuperacion({
        identificador: "noexiste@valdivia.cl",
      });

      expect(response.message).toBe(MENSAJE_RECUPERACION_GENERICO);
      expect(mockRepo.crearTokenInvalidandoPrevios).not.toHaveBeenCalled();
      expect(mockEmailSender.send).not.toHaveBeenCalled();
    });

    it("debe responder el idéntico mensaje genérico sin emitir token si la cuenta está inhabilitada administrativamente (activo = false)", async () => {
      mockUserRepo.obtenerUsuarioParaLogin.mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000002",
        rut: "22222222-2",
        nombre: "Funcionario Desactivado",
        email: "inactivo@valdivia.cl",
        activo: false,
        intentos_fallidos: 0,
        bloqueado_hasta: null,
      });

      const response = await service.solicitarRecuperacion({
        identificador: "inactivo@valdivia.cl",
      });

      expect(response.message).toBe(MENSAJE_RECUPERACION_GENERICO);
      expect(mockRepo.crearTokenInvalidandoPrevios).not.toHaveBeenCalled();
      expect(mockEmailSender.send).not.toHaveBeenCalled();
    });

    it("debe emitir token para cuentas activas temporalmente bloqueadas por reintentos (bloqueado_hasta activo)", async () => {
      const fechaBloqueoFutura = new Date(Date.now() + 10 * 60 * 1000);
      mockUserRepo.obtenerUsuarioParaLogin.mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000003",
        rut: "33333333-3",
        nombre: "Operador Penalizado",
        email: "bloqueado@valdivia.cl",
        activo: true,
        intentos_fallidos: 5,
        bloqueado_hasta: fechaBloqueoFutura,
      });

      const response = await service.solicitarRecuperacion({
        identificador: "bloqueado@valdivia.cl",
      });

      expect(response.message).toBe(MENSAJE_RECUPERACION_GENERICO);
      expect(mockRepo.crearTokenInvalidandoPrevios).toHaveBeenCalledTimes(1);
      expect(mockEmailSender.send).toHaveBeenCalledTimes(1);
    });

    it("debe aplicar Rate Limiting y no emitir token si se superó el máximo de solicitudes recientes", async () => {
      mockUserRepo.obtenerUsuarioParaLogin.mockResolvedValueOnce({
        id: "00000000-0000-4000-8000-000000000001",
        rut: "11111111-1",
        nombre: "Carlos Miranda",
        email: "carlos.miranda@valdivia.cl",
        activo: true,
        intentos_fallidos: 0,
        bloqueado_hasta: null,
      });

      // Simular que ya emitió 3 solicitudes en los últimos 15 min
      mockRepo.contarSolicitudesRecientes.mockResolvedValueOnce(3);

      const response = await service.solicitarRecuperacion({
        identificador: "carlos.miranda@valdivia.cl",
      });

      expect(response.message).toBe(MENSAJE_RECUPERACION_GENERICO);
      expect(mockRepo.crearTokenInvalidandoPrevios).not.toHaveBeenCalled();
      expect(mockEmailSender.send).not.toHaveBeenCalled();
    });
  });

  describe("2. Restablecimiento Atómico de Contraseña", () => {
    const passwordActualPlana = "Valdivia2026!";
    const passwordActualHash = bcrypt.hashSync(passwordActualPlana, 10);
    const tokenPlanoPrueba = "token-criptografico-seguro-de-prueba";
    const tokenHashPrueba = crypto
      .createHash("sha256")
      .update(tokenPlanoPrueba)
      .digest("hex");

    it("debe restablecer contraseña exitosamente, hasheando con bcrypt factor 10 e invalidando el token", async () => {
      const expiraEn = new Date(Date.now() + 20 * 60 * 1000); // Vence en 20 min

      mockRepo.obtenerTokenParaRestablecer.mockResolvedValueOnce({
        tokenId: "token-uuid-1",
        usuarioId: "user-uuid-1",
        tokenHash: tokenHashPrueba,
        expiraEn,
        usadoEn: null,
        usuarioActivo: true,
        usuarioPasswordHash: passwordActualHash,
      });

      const nuevaPassword = "NuevaClaveValdivia2027!";
      const response = await service.restablecerContrasena({
        token: tokenPlanoPrueba,
        nuevaPassword,
        confirmacionPassword: nuevaPassword,
      });

      expect(response.message).toBe(MENSAJE_RESTABLECIMIENTO_EXITOSO);
      expect(
        mockRepo.consumirTokenYRestablecerContrasena
      ).toHaveBeenCalledTimes(1);

      const callArgs =
        mockRepo.consumirTokenYRestablecerContrasena.mock.calls[0][0];
      expect(callArgs.tokenId).toBe("token-uuid-1");
      expect(callArgs.usuarioId).toBe("user-uuid-1");

      // Verificar que el hash generado es bcrypt válido factor 10
      expect(callArgs.nuevoPasswordHash).toMatch(/^\$2[aby]\$10\$/);
      expect(bcrypt.compareSync(nuevaPassword, callArgs.nuevoPasswordHash)).toBe(
        true
      );
    });

    it("debe rechazar si la nueva contraseña es exactamente igual a la actual", async () => {
      const expiraEn = new Date(Date.now() + 20 * 60 * 1000);

      mockRepo.obtenerTokenParaRestablecer.mockResolvedValueOnce({
        tokenId: "token-uuid-1",
        usuarioId: "user-uuid-1",
        tokenHash: tokenHashPrueba,
        expiraEn,
        usadoEn: null,
        usuarioActivo: true,
        usuarioPasswordHash: passwordActualHash,
      });

      await expect(
        service.restablecerContrasena({
          token: tokenPlanoPrueba,
          nuevaPassword: passwordActualPlana,
          confirmacionPassword: passwordActualPlana,
        })
      ).rejects.toThrow("La nueva contraseña debe ser distinta a la contraseña actual.");

      expect(
        mockRepo.consumirTokenYRestablecerContrasena
      ).not.toHaveBeenCalled();
    });

    it("debe rechazar con 400 genérico si el token no existe", async () => {
      mockRepo.obtenerTokenParaRestablecer.mockResolvedValueOnce(null);

      await expect(
        service.restablecerContrasena({
          token: "token-inexistente",
          nuevaPassword: "NuevaPassword2026!",
          confirmacionPassword: "NuevaPassword2026!",
        })
      ).rejects.toThrow(MENSAJE_TOKEN_INVALIDO);
    });

    it("debe rechazar con 400 genérico si el token ya fue utilizado previamente (usado_en no nulo)", async () => {
      mockRepo.obtenerTokenParaRestablecer.mockResolvedValueOnce({
        tokenId: "token-uuid-1",
        usuarioId: "user-uuid-1",
        tokenHash: tokenHashPrueba,
        expiraEn: new Date(Date.now() + 20 * 60 * 1000),
        usadoEn: new Date(Date.now() - 5 * 60 * 1000), // Usado hace 5 min
        usuarioActivo: true,
        usuarioPasswordHash: passwordActualHash,
      });

      await expect(
        service.restablecerContrasena({
          token: tokenPlanoPrueba,
          nuevaPassword: "NuevaPassword2026!",
          confirmacionPassword: "NuevaPassword2026!",
        })
      ).rejects.toThrow(MENSAJE_TOKEN_INVALIDO);

      expect(
        mockRepo.consumirTokenYRestablecerContrasena
      ).not.toHaveBeenCalled();
    });

    it("debe rechazar con 400 genérico si el token ha expirado (expira_en vencido)", async () => {
      mockRepo.obtenerTokenParaRestablecer.mockResolvedValueOnce({
        tokenId: "token-uuid-1",
        usuarioId: "user-uuid-1",
        tokenHash: tokenHashPrueba,
        expiraEn: new Date(Date.now() - 1000), // Expiró hace 1 segundo
        usadoEn: null,
        usuarioActivo: true,
        usuarioPasswordHash: passwordActualHash,
      });

      await expect(
        service.restablecerContrasena({
          token: tokenPlanoPrueba,
          nuevaPassword: "NuevaPassword2026!",
          confirmacionPassword: "NuevaPassword2026!",
        })
      ).rejects.toThrow(MENSAJE_TOKEN_INVALIDO);

      expect(
        mockRepo.consumirTokenYRestablecerContrasena
      ).not.toHaveBeenCalled();
    });

    it("debe rechazar con 400 genérico si el usuario asociado al token fue inhabilitado (activo = false)", async () => {
      mockRepo.obtenerTokenParaRestablecer.mockResolvedValueOnce({
        tokenId: "token-uuid-1",
        usuarioId: "user-uuid-1",
        tokenHash: tokenHashPrueba,
        expiraEn: new Date(Date.now() + 20 * 60 * 1000),
        usadoEn: null,
        usuarioActivo: false,
        usuarioPasswordHash: passwordActualHash,
      });

      await expect(
        service.restablecerContrasena({
          token: tokenPlanoPrueba,
          nuevaPassword: "NuevaPassword2026!",
          confirmacionPassword: "NuevaPassword2026!",
        })
      ).rejects.toThrow(MENSAJE_TOKEN_INVALIDO);

      expect(
        mockRepo.consumirTokenYRestablecerContrasena
      ).not.toHaveBeenCalled();
    });
  });
});
