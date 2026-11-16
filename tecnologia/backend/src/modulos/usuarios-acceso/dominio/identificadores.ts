import { datosInvalidos } from './errores.js';

/** Identificadores UUID; fechas timestamptz UTC; versiones enteras positivas. */
export type IdCuenta = string & { readonly __cuenta: unique symbol };
export type PerfilHabilitado = 'cliente' | 'prestador';
export function idCuenta(valor: string): IdCuenta {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) throw datosInvalidos('Identificador no válido.');
  return valor as IdCuenta;
}
export function versionPositiva(valor: bigint): bigint { if (valor < 1n) throw datosInvalidos('Versión no válida.'); return valor; }
export function textoUnicode(valor: string, maximo: number): void {
  if (!valor.isWellFormed() || [...valor].length > maximo) throw datosInvalidos('Texto no válido o demasiado largo.');
}
