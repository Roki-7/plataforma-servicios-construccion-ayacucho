import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';

// Puertos de salida de Solicitudes hacia lo que depende de las cotizaciones. Solicitudes NO importa el módulo Cotizaciones: la raíz de composición
// conecta estos puertos con `cotizaciones/api-publica` mediante adaptadores (research R-04).

/** Cuentas de los autores de cotizaciones no retiradas de una solicitud: los «interesados» a quienes se avisa de una edición o un cierre. */
export interface PrestadoresInteresados {
  de(solicitudId: string, tx: ContextoTransaccion): Promise<readonly string[]>;
}

/** Título (c) de acceso: ser autor de una cotización no retirada sobre la solicitud. */
export interface AutoriaDeCotizacion {
  tieneNoRetirada(solicitudId: string, cuentaId: string, tx?: ContextoTransaccion): Promise<boolean>;
  /** Identificadores de las solicitudes donde la cuenta tiene una cotización no retirada (listado `rol=prestador`). */
  solicitudesConNoRetirada(cuentaId: string, tx?: ContextoTransaccion): Promise<readonly string[]>;
}
