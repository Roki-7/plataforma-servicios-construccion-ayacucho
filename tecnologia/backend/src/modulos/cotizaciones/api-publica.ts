import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';
import type { RepositorioDeAutoria } from './aplicacion/puertos/autoria.js';

/**
 * Lecturas de autoría de Cotizaciones para Solicitudes (003). Solo lectura sobre tablas propias; con `tx` participan en la transacción del llamador y sin ella
 * leen del primario. Cada llamada es UNA sola sentencia. No exponen precios, textos ni datos de contacto: solo identificadores.
 */
export interface AutoriaDeCotizaciones {
  /** Cuentas distintas de los autores de cotizaciones no retiradas de la solicitud, en orden estable. Los «interesados» (research R-04). */
  autoresNoRetirados(solicitudId: string, tx?: ContextoTransaccion): Promise<readonly string[]>;
  /** Solicitudes donde la cuenta tiene una cotización no retirada, en orden estable. Para `GET /solicitudes?rol=prestador`. */
  solicitudesConCotizacionNoRetirada(cuentaId: string, tx?: ContextoTransaccion): Promise<readonly string[]>;
  /** Título (c) de acceso: la cuenta tiene una cotización no retirada sobre la solicitud. */
  tieneNoRetirada(solicitudId: string, cuentaId: string, tx?: ContextoTransaccion): Promise<boolean>;
}

/** Implementación de las lecturas de autoría. No registra rutas HTTP ni expone el repositorio. */
export class ApiCotizaciones implements AutoriaDeCotizaciones {
  constructor(private readonly repositorio: RepositorioDeAutoria) {}
  autoresNoRetirados(solicitudId: string, tx?: ContextoTransaccion): Promise<readonly string[]> { return this.repositorio.autoresNoRetirados(solicitudId, tx); }
  solicitudesConCotizacionNoRetirada(cuentaId: string, tx?: ContextoTransaccion): Promise<readonly string[]> { return this.repositorio.solicitudesConNoRetirada(cuentaId, tx); }
  tieneNoRetirada(solicitudId: string, cuentaId: string, tx?: ContextoTransaccion): Promise<boolean> { return this.repositorio.tieneNoRetirada(solicitudId, cuentaId, tx); }
}

/** Cotización vigente que la 004 necesita para contratar. Se implementa con la historia que la usa; aquí solo se fija el contrato. */
export interface CotizacionVigente {
  readonly cotizacionId: string;
  readonly solicitudId: string;
  readonly prestadorId: string;
  readonly estado: 'ACTIVA' | 'RETIRADA';
  readonly version: number;
  readonly versionActual: number;
  readonly versionTrabajoSolicitud: number;
  readonly tipo: 'ESTIMADA' | 'DEFINITIVA';
  readonly precioCentimos: number | null;
  readonly vigenteHasta: string;
}
export interface LecturaDeCotizacionVigente {
  /** `null` si la cotización no existe. */
  obtenerVigente(cotizacionId: string, tx?: ContextoTransaccion): Promise<CotizacionVigente | null>;
}
