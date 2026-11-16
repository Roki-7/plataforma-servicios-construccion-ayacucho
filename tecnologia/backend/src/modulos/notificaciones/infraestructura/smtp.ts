import nodemailer from 'nodemailer';
import type { EnvioCorreo, TransporteCorreo } from '../aplicacion/puertos/correo-seguridad.js';
import { dependenciaNoDisponible } from '../../../compartido/dominio/errores.js';

export class SmtpNodemailer implements TransporteCorreo {
  private readonly transporte: ReturnType<typeof nodemailer.createTransport>;
  constructor(config: { host: string; port: number; secure: boolean; from: string; validacion: boolean; usuario?: string; contrasena?: string }, private readonly remitente = config.from) {
    this.transporte = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, requireTLS: !config.validacion && !config.secure,
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000, disableFileAccess: true, disableUrlAccess: true,
      ...(config.usuario && config.contrasena ? { auth: { user: config.usuario, pass: config.contrasena } } : {}) });
  }
  async enviar(correo: EnvioCorreo): Promise<void> {
    try { await this.transporte.sendMail({ from: this.remitente, to: correo.destinatario, subject: correo.asunto, text: correo.texto, messageId: `<${correo.id}@seguridad.invalid>` }); }
    catch { throw dependenciaNoDisponible(); }
  }
  cerrar(): void { this.transporte.close(); }
}
