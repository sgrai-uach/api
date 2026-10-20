import crypto from "crypto";
import bcrypt from "bcryptjs";
import { BadRequestError } from "./errors";
import {
  RecuperarContrasenaRequest,
  RestablecerContrasenaRequest,
  MensajeGenericoResponse,
} from "./schema";
import {
  RecuperacionContrasenaRepository,
  recuperacionContrasenaRepository,
} from "./recuperacion-contrasena.repository";
import {
  SeguridadRepository,
  seguridadRepository,
} from "./repository";
import { EmailSender, getEmailSender } from "@/lib/mail";
import { generarEmailRecuperacion } from "@/lib/mail/templates/recuperacion-contrasena";

export const MENSAJE_RECUPERACION_GENERICO =
  "Si el identificador corresponde a una cuenta registrada, se enviará un enlace de recuperación.";

export const MENSAJE_RESTABLECIMIENTO_EXITOSO =
  "Contraseña restablecida correctamente. Ya puede iniciar sesión.";

export const MENSAJE_TOKEN_INVALIDO =
  "El enlace de recuperación es inválido o ha expirado.";

export class RecuperacionContrasenaService {
  constructor(
    private readonly repo: RecuperacionContrasenaRepository = recuperacionContrasenaRepository,
    private readonly userRepo: SeguridadRepository = seguridadRepository,
    private readonly getSender: () => EmailSender = getEmailSender
  ) {}

  /**
   * Genera un hash criptográfico SHA-256 en formato hexadecimal.
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Procesa la solicitud de recuperación de contraseña con estricta protección anti-enumeración de cuentas.
   * Siempre responde con el mismo mensaje genérico 200 OK independientemente de la existencia o estado del usuario.
   */
  async solicitarRecuperacion(
    input: RecuperarContrasenaRequest
  ): Promise<MensajeGenericoResponse> {
    const usuario = await this.userRepo.obtenerUsuarioParaLogin(
      input.identificador
    );

    // Si el usuario no existe o está deshabilitado administrativamente, no se genera token ni correo,
    // pero se retorna exactamente la misma respuesta para evitar ataques de enumeración.
    if (!usuario || !usuario.activo) {
      return { message: MENSAJE_RECUPERACION_GENERICO };
    }

    const ttlMinutos = Number(
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || "30"
    );
    const maxSolicitudes = Number(
      process.env.PASSWORD_RESET_MAX_REQUESTS || "3"
    );
    const ventanaMinutos = Number(
      process.env.PASSWORD_RESET_WINDOW_MINUTES || "15"
    );

    // Control de tasa (Rate Limiting) por usuario
    const ventanaInicio = new Date(Date.now() - ventanaMinutos * 60 * 1000);
    const solicitudesRecientes = await this.repo.contarSolicitudesRecientes(
      usuario.id,
      ventanaInicio
    );

    if (solicitudesRecientes >= maxSolicitudes) {
      // Tasa excedida: responder el mismo mensaje genérico sin emitir nuevo token ni correo
      return { message: MENSAJE_RECUPERACION_GENERICO };
    }

    // Generar token criptográfico seguro de un solo uso (32 bytes = 256 bits de entropía)
    const tokenPlano = crypto.randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(tokenPlano);
    const expiraEn = new Date(Date.now() + ttlMinutos * 60 * 1000);

    // Persistir el token de forma transaccional invalidando tokens anteriores no consumidos
    await this.repo.crearTokenInvalidandoPrevios({
      usuarioId: usuario.id,
      tokenHash,
      expiraEn,
    });

    // Construir enlace de recuperación dirigido al frontend institucional sgrai-web
    const appWebUrl = process.env.APP_WEB_URL || "http://localhost:3001";
    const enlaceRecuperacion = `${appWebUrl}/restablecer-contrasena?token=${encodeURIComponent(
      tokenPlano
    )}`;

    // Generar y despachar el correo (en segundo plano / no bloqueante para evitar canal lateral de tiempo)
    const emailData = generarEmailRecuperacion({
      nombreUsuario: usuario.nombre || "Funcionario(a)",
      enlaceRecuperacion,
      minutosExpiracion: ttlMinutos,
    });

    const sender = this.getSender();
    sender
      .send({
        to: usuario.email,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
      })
      .catch((error) => {
        console.error(
          `[RecuperacionContrasenaService] Error al despachar correo a ${usuario.email}:`,
          error
        );
      });

    return { message: MENSAJE_RECUPERACION_GENERICO };
  }

  /**
   * Restablece la contraseña utilizando un token válido, no usado y no expirado.
   * Aplica bcrypt factor 10, reinicia contadores de bloqueo e invalida el token.
   */
  async restablecerContrasena(
    input: RestablecerContrasenaRequest
  ): Promise<MensajeGenericoResponse> {
    const tokenHash = this.hashToken(input.token);
    const registroToken = await this.repo.obtenerTokenParaRestablecer(tokenHash);

    // Validación unificada para no revelar causas específicas de fallo
    if (!registroToken) {
      throw new BadRequestError(MENSAJE_TOKEN_INVALIDO);
    }

    if (registroToken.usadoEn !== null) {
      throw new BadRequestError(MENSAJE_TOKEN_INVALIDO);
    }

    if (registroToken.expiraEn.getTime() <= Date.now()) {
      throw new BadRequestError(MENSAJE_TOKEN_INVALIDO);
    }

    if (!registroToken.usuarioActivo) {
      throw new BadRequestError(MENSAJE_TOKEN_INVALIDO);
    }

    // Validar que la nueva contraseña sea distinta de la actual
    if (registroToken.usuarioPasswordHash) {
      const esMismaPassword = await bcrypt.compare(
        input.nuevaPassword,
        registroToken.usuarioPasswordHash
      );
      if (esMismaPassword) {
        throw new BadRequestError(
          "La nueva contraseña debe ser distinta a la contraseña actual."
        );
      }
    }

    // Hashear con bcrypt factor 10
    const nuevoPasswordHash = await bcrypt.hash(input.nuevaPassword, 10);

    // Consumir token y actualizar usuario en transacción atómica
    await this.repo.consumirTokenYRestablecerContrasena({
      tokenId: registroToken.tokenId,
      usuarioId: registroToken.usuarioId,
      nuevoPasswordHash,
    });

    return { message: MENSAJE_RESTABLECIMIENTO_EXITOSO };
  }
}

export const recuperacionContrasenaService =
  new RecuperacionContrasenaService();
