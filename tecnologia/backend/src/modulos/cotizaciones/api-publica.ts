import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';
import { evaluarContraSolicitud } from './aplicacion/cotizaciones.js';
import type { RepositorioDeAutoria } from './aplicacion/puertos/autoria.js';
import type { RepositorioCotizaciones } from './aplicacion/puertos/repositorio.js';
import type { LecturasDeSolicitudes } from './aplicacion/puertos/solicitudes.js';
import type { MotivoNoAceptable } from './dominio/cotizacion.js';

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

export type { MotivoNoAceptable } from './dominio/cotizacion.js';

/** Implementación de las lecturas de autoría. No registra rutas HTTP ni expone el repositorio. */
export class ApiCotizaciones implements AutoriaDeCotizaciones {
  constructor(private readonly repositorio: RepositorioDeAutoria) {}
  autoresNoRetirados(solicitudId: string, tx?: ContextoTransaccion): Promise<readonly string[]> { return this.repositorio.autoresNoRetirados(solicitudId, tx); }
  solicitudesConCotizacionNoRetirada(cuentaId: string, tx?: ContextoTransaccion): Promise<readonly string[]> { return this.repositorio.solicitudesConNoRetirada(cuentaId, tx); }
  tieneNoRetirada(solicitudId: string, cuentaId: string, tx?: ContextoTransaccion): Promise<boolean> { return this.repositorio.tieneNoRetirada(solicitudId, cuentaId, tx); }
}

/**
 * Cotización vigente que la 004 necesita para contratar. Solo lectura: la 003 no ofrece selección, aceptación ni contratación, ni produce los estados de la 004.
 * `motivosNoAceptable` vacío no significa «aceptable»: la aceptación es de la 004.
 */
export interface CotizacionVigente {
  readonly cotizacionId: string;
  readonly solicitudId: string;
  readonly prestadorId: string;
  readonly estado: 'ACTIVA' | 'RETIRADA';
  /** Versión de control de la cotización. */
  readonly version: number;
  /** Número de la versión vigente de la cotización. */
  readonly versionActual: number;
  /** Versión de trabajo de la solicitud sobre la que se elaboró la versión vigente. */
  readonly versionTrabajoSolicitud: number;
  readonly tipo: 'ESTIMADA' | 'DEFINITIVA';
  readonly precioCentimos: number | null;
  readonly vigenteHasta: string;
  /** `true` si la versión de control que esperaba el llamador es la vigente. Si no, el llamador debe releer antes de actuar. */
  readonly versionEsperadaCoincide: boolean;
  readonly motivosNoAceptable: readonly MotivoNoAceptable[];
}
export interface LecturaDeCotizacionVigente {
  /** `null` si la cotización no existe. Con `tx` participa en la transacción del llamador; sin ella lee del primario. */
  obtenerVigente(cotizacionId: string, versionCotizacion: number, tx?: ContextoTransaccion): Promise<CotizacionVigente | null>;
}

/** Lectura de la cotización vigente. Solo lectura sobre tablas propias y la API pública de Solicitudes; no registra rutas. */
export class ApiCotizacionesVigentes implements LecturaDeCotizacionVigente {
  constructor(private readonly repositorio: Pick<RepositorioCotizaciones, 'obtener'>, private readonly solicitudes: Pick<LecturasDeSolicitudes, 'resumenes'>, private readonly ahora: () => Date = () => new Date()) {}
  async obtenerVigente(cotizacionId: string, versionCotizacion: number, tx?: ContextoTransaccion): Promise<CotizacionVigente | null> {
    const c = await this.repositorio.obtener(cotizacionId, tx);
    if (!c) return null;
    const solicitud = (await this.solicitudes.resumenes([c.solicitudId], tx)).get(c.solicitudId);
    const e = evaluarContraSolicitud(c, solicitud, this.ahora());
    const d = c.vigente.datos;
    return {
      cotizacionId: c.id, solicitudId: c.solicitudId, prestadorId: c.prestadorId, estado: c.estado, version: c.version, versionActual: c.vigente.numero,
      versionTrabajoSolicitud: c.vigente.versionTrabajoSolicitud, tipo: d.tipo, precioCentimos: d.precioCentimos ?? null, vigenteHasta: d.vigenteHasta.toISOString(),
      versionEsperadaCoincide: versionCotizacion === c.version, motivosNoAceptable: e.motivosNoAceptable,
    };
  }
}
