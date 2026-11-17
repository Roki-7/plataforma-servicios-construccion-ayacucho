import type { ContextoTransaccion, ValorJson } from './transaccion.js';
export interface SolicitudIdempotente {
  readonly ambito: { tipo: 'usuario' | 'registro' | 'recuperacion'; id: string };
  readonly metodo: 'POST' | 'PATCH'; readonly rutaLogica: string; readonly clave: string;
  readonly cuerpo: ValorJson; readonly token?: string;
  /** Debe comprobar sesión, permisos y titularidad vigentes ANTES del replay. */
  readonly autorizar?: () => Promise<string>;
}
export interface ResultadoIdempotente { readonly http: number; readonly cuerpo: ValorJson }
export interface Idempotencia {
  ejecutar(solicitud: SolicitudIdempotente, trabajo: (tx: ContextoTransaccion) => Promise<ResultadoIdempotente>): Promise<ResultadoIdempotente>;
}
/** Consulta anticipada sin locks de negocio para preparar el hash fuera de la transacción. */
export interface IdempotenciaRecuperacion extends Idempotencia {
  consultarRecuperacion(solicitud: SolicitudIdempotente): Promise<ResultadoIdempotente | null>;
}
