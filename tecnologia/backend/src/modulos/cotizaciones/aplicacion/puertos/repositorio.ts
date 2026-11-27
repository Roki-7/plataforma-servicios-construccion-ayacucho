import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { DatosCotizacion } from '../../dominio/cotizacion.js';

export interface VersionGuardada {
  readonly numero: number;
  readonly versionTrabajoSolicitud: number;
  readonly datos: DatosCotizacion;
  readonly creadaEn: Date;
}
export interface CotizacionGuardada {
  readonly id: string;
  readonly solicitudId: string;
  readonly prestadorId: string;
  readonly prestadorCuentaId: string;
  readonly estado: 'ACTIVA' | 'RETIRADA';
  /** Versión de control: cambia con cada actualización y con el retiro. */
  readonly version: number;
  readonly creadaEn: Date;
  readonly retiradaEn: Date | null;
  /** Versión vigente de la cotización (la de mayor número). */
  readonly vigente: VersionGuardada;
}
export interface NuevaCotizacion { readonly id: string; readonly solicitudId: string; readonly prestadorId: string; readonly prestadorCuentaId: string }
export interface NuevaVersionDeCotizacion { readonly versionTrabajoSolicitud: number; readonly datos: DatosCotizacion }
export interface PaginaDeCotizaciones { readonly elementos: readonly CotizacionGuardada[]; readonly total: number }

/** Persistencia de Cotizaciones. Solo tablas propias; nunca consulta tablas de otro módulo. Con `tx` participa en la unidad de trabajo del llamador. */
export interface RepositorioCotizaciones {
  /** Identidad inmutable de la cotización, sin bloqueo (el orden de bloqueos exige conocer su solicitud antes de bloquearla). */
  referencia(id: string, tx?: ContextoTransaccion): Promise<{ readonly solicitudId: string; readonly prestadorCuentaId: string } | null>;
  /** `FOR UPDATE` de la cotización, con su versión vigente. */
  bloquear(id: string, tx: ContextoTransaccion): Promise<CotizacionGuardada | null>;
  obtener(id: string, tx?: ContextoTransaccion): Promise<CotizacionGuardada | null>;
  /** Todas las versiones, de la más reciente a la más antigua. */
  versiones(id: string, tx?: ContextoTransaccion): Promise<readonly VersionGuardada[]>;
  /** Crea la cotización con su versión 1. La violación del índice único de no retiradas se traduce a `COTIZACION_EXISTENTE`. */
  insertar(tx: ContextoTransaccion, cotizacion: NuevaCotizacion, version: NuevaVersionDeCotizacion): Promise<void>;
  /** Añade la versión siguiente y sube la versión de control. */
  agregarVersion(tx: ContextoTransaccion, id: string, version: NuevaVersionDeCotizacion): Promise<void>;
  /** Marca la cotización como RETIRADA (terminal) y sube la versión de control. */
  retirar(tx: ContextoTransaccion, id: string): Promise<void>;
  /** Cotizaciones de una solicitud, en orden de llegada (sin clasificación), con el total de la misma lectura. Solo para el cliente dueño. */
  listarDeSolicitud(solicitudId: string, pagina: number, tamano: number): Promise<PaginaDeCotizaciones>;
  /** Las cotizaciones indicadas que pertenecen a la solicitud, en UNA sentencia. Las que no existen o son de otra solicitud no aparecen. */
  obtenerVarias(solicitudId: string, ids: readonly string[]): Promise<readonly CotizacionGuardada[]>;
  /** Cotizaciones de una cuenta de prestador, de la más reciente a la más antigua, con el total de la misma lectura. */
  listarDeCuenta(cuentaId: string, pagina: number, tamano: number): Promise<PaginaDeCotizaciones>;
}
