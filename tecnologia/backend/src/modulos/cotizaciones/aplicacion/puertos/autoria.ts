import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';

/** Persistencia de solo lectura de la autoría de cotizaciones. Con `tx` participa en la unidad de trabajo del llamador; sin ella lee del primario. */
export interface RepositorioDeAutoria {
  autoresNoRetirados(solicitudId: string, tx?: ContextoTransaccion): Promise<readonly string[]>;
  solicitudesConNoRetirada(cuentaId: string, tx?: ContextoTransaccion): Promise<readonly string[]>;
  tieneNoRetirada(solicitudId: string, cuentaId: string, tx?: ContextoTransaccion): Promise<boolean>;
}
