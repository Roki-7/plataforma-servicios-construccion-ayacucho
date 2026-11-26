import type { ContextoTransaccion } from '../../../compartido/aplicacion/transaccion.js';

export const PERMISO_RF39 = 'RF39_CATEGORIAS' as const;

export interface PermisoRf39 { readonly cuentaId: string; readonly estado: 'VIGENTE' | 'REVOCADO'; readonly version: number }
export interface PermisosRf39 {
  /** Lectura sin bloqueo para consultas. */
  vigente(cuentaId: string): Promise<boolean>;
  /** Bloquea la fila del permiso hasta el fin de la transacción. Devuelve `null` si la cuenta nunca tuvo permiso. */
  bloquear(tx: ContextoTransaccion, cuentaId: string): Promise<PermisoRf39 | null>;
  /** Crea o restituye el permiso. La fila se conserva al revocar. */
  conceder(tx: ContextoTransaccion, cuentaId: string): Promise<void>;
  revocar(tx: ContextoTransaccion, cuentaId: string): Promise<void>;
}

export interface Constancia { readonly id: string; readonly cuentaId: string; readonly entorno: string; readonly vigente: boolean; readonly consumida: boolean }
export interface AprobacionConsumida {
  readonly id: string; readonly firmante: string; readonly ejecutor: string; readonly accion: 'CONCEDER' | 'REVOCAR'; readonly cuentaId: string;
  readonly entorno: string; readonly emitidaEn: Date; readonly venceEn: Date; readonly motivo: string; readonly constanciaId: string | null;
}
export interface RegistroOperativo {
  crearConstancia(cuentaId: string, entorno: string, minutosVigencia: number): Promise<string>;
  /** Bloquea la constancia hasta el fin de la transacción. */
  bloquearConstancia(tx: ContextoTransaccion, id: string): Promise<Constancia | null>;
  consumirConstancia(tx: ContextoTransaccion, id: string): Promise<void>;
  /** Registra la aprobación como consumida. Devuelve `false` si ya existía (reutilización). */
  consumirAprobacion(tx: ContextoTransaccion, a: AprobacionConsumida): Promise<boolean>;
}

export interface RegistroAuditoria {
  readonly responsable: string; readonly aprobacionId?: string; readonly accion: string; readonly recursoTipo: string; readonly recursoId: string; readonly motivo: string;
}
export interface AuditoriaRf39 {
  registrar(tx: ContextoTransaccion, registro: RegistroAuditoria): Promise<void>;
}
