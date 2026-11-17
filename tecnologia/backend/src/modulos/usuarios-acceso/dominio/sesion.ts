import type { IdCuenta } from './identificadores.js';
export interface Sesion {
  id: string; usuarioId: IdCuenta; accesoDigest: Uint8Array; renovacionDigest: Uint8Array;
  accesoVenceEn: Date; renovacionVenceEn: Date; autenticadaConContrasenaEn: Date | null;
  creadaEn: Date; renovadaEn: Date; revocadaEn: Date | null; version: bigint;
}
export const accesoVigente = (s: Pick<Sesion, 'accesoVenceEn' | 'revocadaEn'>, ahora: Date): boolean => s.revocadaEn === null && +ahora < +s.accesoVenceEn;
export const renovacionVigente = (s: Pick<Sesion, 'renovacionVenceEn' | 'revocadaEn'>, ahora: Date): boolean => s.revocadaEn === null && +ahora < +s.renovacionVenceEn;
