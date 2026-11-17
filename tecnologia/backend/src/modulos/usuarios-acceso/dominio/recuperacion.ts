import type { IdCuenta } from './identificadores.js';
import { ErrorAplicacion } from './errores.js';
export interface Recuperacion {
  id: string; usuarioId: IdCuenta; proposito: string; tokenDigest: Uint8Array;
  emitidaEn: Date; venceEn: Date; consumidaEn: Date | null; invalidadaEn: Date | null; version: number;
}
export const recuperacionNoValida = () => new ErrorAplicacion(422, 'RECUPERACION_NO_VALIDA', 'El enlace no es válido. Solicite uno nuevo.');
export function validarRecuperacion(r: Recuperacion | null, usuarioId: IdCuenta, version: number, ahora: Date): asserts r is Recuperacion {
  if (!r || r.usuarioId !== usuarioId || r.proposito !== 'recuperacion' || r.version !== version || r.consumidaEn !== null || r.invalidadaEn !== null || +ahora >= +r.venceEn) throw recuperacionNoValida();
}
