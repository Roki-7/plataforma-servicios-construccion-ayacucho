import type { ContextoTransaccion, ValorJson } from './transaccion.js';
export interface SolicitudIdempotente {
  readonly ambito: { tipo: 'usuario' | 'registro' | 'recuperacion'; id: string };
  readonly metodo: 'POST' | 'PATCH'; readonly rutaLogica: string; readonly clave: string;
  readonly cuerpo: ValorJson; readonly token?: string;
  /** Debe comprobar sesión, permisos y titularidad vigentes ANTES del replay. */
  readonly autorizar?: () => Promise<string>;
}
export interface ResultadoIdempotente { readonly http: number; readonly cuerpo: ValorJson }
export interface SolicitudIdempotente002 {
  readonly actor: string;
  readonly metodo: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly rutaLogica: string;
  readonly clave: string;
  readonly ids: Readonly<Record<string, string>>;
  readonly version?: number;
  readonly cuerpo: ValorJson;
  readonly fotografia?: Uint8Array;
  /** Comprueba el actor y la autorización vigente. Puede bloquear el permiso RF39 en esta unidad de trabajo. */
  readonly autorizar: (tx: ContextoTransaccion) => Promise<string>;
}
export interface Idempotencia002 {
  ejecutar002(solicitud: SolicitudIdempotente002, trabajo: (tx: ContextoTransaccion) => Promise<ResultadoIdempotente>): Promise<ResultadoIdempotente>;
}
export interface Idempotencia {
  ejecutar(solicitud: SolicitudIdempotente, trabajo: (tx: ContextoTransaccion) => Promise<ResultadoIdempotente>): Promise<ResultadoIdempotente>;
}
/** Permite preparar fuera del lock una mutación autenticada que todavía no tiene resultado. */
export interface IdempotenciaUsuario extends Idempotencia {
  consultarUsuario(solicitud: SolicitudIdempotente): Promise<ResultadoIdempotente | null>;
}
/** Consulta anticipada sin locks de negocio para preparar el hash fuera de la transacción. */
export interface IdempotenciaRecuperacion extends Idempotencia {
  consultarRecuperacion(solicitud: SolicitudIdempotente): Promise<ResultadoIdempotente | null>;
}
