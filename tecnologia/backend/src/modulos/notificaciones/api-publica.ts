import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';
export interface CorreoSeguridad {
  readonly tipo: 'recuperación' | 'verificar_correo' | 'contraseña_recuperada'; readonly destinatario: string;
  readonly asunto: string; readonly texto: string; readonly claveLogica: string;
  readonly desafioId?: string; readonly venceEn?: Date;
}
export interface NotificacionesApi { programar(correo: CorreoSeguridad, tx: ContextoTransaccion): Promise<void> }

/** Tipos de aviso de negocio de la 003 (FR-344). La entrega, la visualización y la lectura son de la 006. */
export const tiposAvisoNegocio = ['SOLICITUD_DIRIGIDA_PUBLICADA', 'SOLICITUD_CAMBIADA', 'SOLICITUD_CERRADA'] as const;
export type TipoAvisoNegocio = typeof tiposAvisoNegocio[number];
/** Solo identificadores: ningún texto libre, correo ni dato personal. `versionTrabajo` es `null` solo para el cierre. */
export interface AvisoNegocio {
  readonly cuentaDestinatarioId: string; readonly tipo: TipoAvisoNegocio; readonly solicitudId: string; readonly versionTrabajo: number | null;
}
export interface AvisosNegocioApi {
  /**
   * Registra los avisos en la transacción del llamador (se revierten con ella) y es idempotente por clave lógica `tipo:solicitudId:versión:cuentaId`.
   * Devuelve cuántos avisos nuevos se insertaron. No envía nada y no usa `avisos_pendientes`.
   */
  registrar(avisos: readonly AvisoNegocio[], tx: ContextoTransaccion): Promise<number>;
}
