import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';
export interface CorreoSeguridad {
  readonly tipo: 'recuperación' | 'verificar_correo' | 'contraseña_recuperada'; readonly destinatario: string;
  readonly asunto: string; readonly texto: string; readonly claveLogica: string;
  readonly desafioId?: string; readonly venceEn?: Date;
}
export interface NotificacionesApi { programar(correo: CorreoSeguridad, tx: ContextoTransaccion): Promise<void> }
