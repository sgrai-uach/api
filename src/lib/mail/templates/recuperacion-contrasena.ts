export interface DatosTemplateRecuperacion {
  nombreUsuario: string;
  enlaceRecuperacion: string;
  minutosExpiracion: number;
}

export function generarEmailRecuperacion(datos: DatosTemplateRecuperacion): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Recuperación de contraseña - SGRAI Municipalidad de Valdivia";

  const text = `Estimado(a) ${datos.nombreUsuario}:

Hemos recibido una solicitud para restablecer la contraseña de su cuenta en el Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI).

Para continuar con el restablecimiento, acceda al siguiente enlace:
${datos.enlaceRecuperacion}

Este enlace es de un solo uso y expirará en ${datos.minutosExpiracion} minutos.

Si usted no ha solicitado restablecer su contraseña, puede ignorar este mensaje; su cuenta continuará segura y no se realizarán modificaciones.

Atentamente,
Dirección de Gestión de Riesgos de Desastres
Ilustre Municipalidad de Valdivia`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #2d3748; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); }
    .header { background-color: #0b4f6c; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .content { padding: 32px 24px; line-height: 1.6; font-size: 15px; }
    .button-container { text-align: center; margin: 32px 0; }
    .button { display: inline-block; background-color: #0b4f6c; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; }
    .warning { background-color: #fffaf0; border-left: 4px solid #dd6b20; padding: 12px 16px; margin: 24px 0; font-size: 13px; color: #7b341e; }
    .footer { background-color: #edf2f7; padding: 16px 24px; text-align: center; font-size: 12px; color: #718096; }
    .link-alt { word-break: break-all; font-size: 13px; color: #4a5568; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SGRAI — Municipalidad de Valdivia</h1>
    </div>
    <div class="content">
      <p>Estimado(a) <strong>${datos.nombreUsuario}</strong>,</p>
      <p>Se ha recibido una solicitud para restablecer las credenciales de acceso a su cuenta institucional en el <em>Sistema de Gestión de Recursos para Atención de Incidentes (SGRAI)</em>.</p>
      
      <div class="button-container">
        <a href="${datos.enlaceRecuperacion}" class="button" target="_blank" rel="noopener noreferrer">Restablecer mi contraseña</a>
      </div>

      <div class="warning">
        Este enlace es de uso único y tiene una vigencia máxima de <strong>${datos.minutosExpiracion} minutos</strong>. Tras ser utilizado o expirado el plazo, quedará invalidado automáticamente.
      </div>

      <p>Si el botón anterior no funciona, puede copiar y pegar la siguiente URL en su navegador:</p>
      <p class="link-alt">${datos.enlaceRecuperacion}</p>

      <p>Si usted no realizó esta solicitud, desestime este correo. Sus credenciales se mantendrán seguras y no se aplicará ningún cambio en su cuenta.</p>
    </div>
    <div class="footer">
      Dirección de Gestión de Riesgos de Desastres &bull; Ilustre Municipalidad de Valdivia<br>
      Este es un correo automático del sistema, por favor no responda a este mensaje.
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
