import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { AutorDeAclaracion } from '../../dominio/aclaracion.js';

export interface AclaracionGuardada {
  readonly id: string;
  readonly numero: number;
  readonly autor: AutorDeAclaracion;
  readonly texto: string;
  /** Número de la versión vigente de la cotización cuando se escribió el mensaje. */
  readonly versionCotizacion: number;
  readonly creadaEn: Date;
}
export interface NuevaAclaracion {
  readonly id: string;
  readonly cotizacionId: string;
  readonly numero: number;
  readonly autorCuentaId: string;
  readonly autor: AutorDeAclaracion;
  readonly texto: string;
  readonly versionCotizacion: number;
}

/** Persistencia del hilo de aclaraciones. El hilo cuelga de la identidad de la cotización: las versiones no lo afectan. Mensajes inmutables (sin actualizar ni borrar). */
export interface RepositorioAclaraciones {
  contar(cotizacionId: string, tx: ContextoTransaccion): Promise<number>;
  insertar(tx: ContextoTransaccion, aclaracion: NuevaAclaracion): Promise<AclaracionGuardada>;
  /** Mensajes por número ascendente, con el total de la misma lectura. */
  listar(cotizacionId: string, pagina: number, tamano: number): Promise<{ readonly elementos: readonly AclaracionGuardada[]; readonly total: number }>;
}
