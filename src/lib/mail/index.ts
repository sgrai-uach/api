import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface EnviarEmailOpciones {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(opciones: EnviarEmailOpciones): Promise<void>;
}

/**
 * Adaptador de envío para entornos de desarrollo y pruebas locales.
 * Muestra el contenido del correo en la consola sin requerir servidor SMTP activo.
 */
export class ConsoleEmailSender implements EmailSender {
  async send(opciones: EnviarEmailOpciones): Promise<void> {
    console.info("=================================================");
    console.info("📧 [SGRAI - CORREO SALIENTE]");
    console.info(`Destinatario : ${opciones.to}`);
    console.info(`Asunto       : ${opciones.subject}`);
    console.info("-------------------------------------------------");
    console.info(opciones.text);
    console.info("=================================================");
  }
}

/**
 * Adaptador de envío para entornos con servidor SMTP real o emulador (Mailpit).
 */
export class SmtpEmailSender implements EmailSender {
  private transporter: Transporter;
  private from: string;

  constructor() {
    const host = process.env.SMTP_HOST || "localhost";
    const port = Number(process.env.SMTP_PORT || "1025");
    const secure = process.env.SMTP_SECURE === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    this.from =
      process.env.SMTP_FROM ||
      "Dirección de Gestión de Riesgos <no-reply@valdivia.cl>";

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async send(opciones: EnviarEmailOpciones): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: opciones.to,
      subject: opciones.subject,
      text: opciones.text,
      html: opciones.html,
    });
  }
}

let senderInstance: EmailSender | null = null;

/**
 * Obtiene la instancia activa de EmailSender según la variable de entorno MAIL_TRANSPORT.
 * Si MAIL_TRANSPORT es 'smtp', usa el transporte SMTP configurado; en caso contrario, usa la consola.
 */
export function getEmailSender(): EmailSender {
  if (senderInstance) {
    return senderInstance;
  }

  const transportType = (process.env.MAIL_TRANSPORT || "console").toLowerCase();

  if (transportType === "smtp") {
    senderInstance = new SmtpEmailSender();
  } else {
    senderInstance = new ConsoleEmailSender();
  }

  return senderInstance;
}

/**
 * Permite inyectar un adaptador de prueba en suites de Vitest.
 */
export function setEmailSenderForTest(sender: EmailSender | null): void {
  senderInstance = sender;
}
