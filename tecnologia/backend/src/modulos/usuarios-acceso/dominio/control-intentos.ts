export interface ControlIntentos { fallosConsecutivos: number; bloqueadaHasta: Date | null }
export function evaluarIntento(actual: ControlIntentos, correcta: boolean, ahora: Date): { permitido: boolean; espera: number; estado: ControlIntentos } {
  if (actual.bloqueadaHasta && +ahora < +actual.bloqueadaHasta) return { permitido: false, espera: Math.ceil((+actual.bloqueadaHasta - +ahora) / 1000), estado: actual };
  const fallos = correcta ? 0 : (actual.bloqueadaHasta ? 0 : actual.fallosConsecutivos) + 1;
  return { permitido: correcta, espera: fallos >= 5 ? 900 : 0, estado: { fallosConsecutivos: fallos, bloqueadaHasta: fallos >= 5 ? new Date(+ahora + 900000) : null } };
}
