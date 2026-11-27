/**
 * Fechas de calendario en America/Lima (UTC-5 todo el año, sin horario de verano). La fecha o el periodo deseado son fechas de calendario, no instantes:
 * se comparan como texto `AAAA-MM-DD`. Los instantes (creación, publicación, vencimientos) se guardan y se exponen en UTC.
 */
export const zonaDeCalendario = 'America/Lima';

const formateador = new Intl.DateTimeFormat('en-CA', { timeZone: zonaDeCalendario, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Fecha de calendario de hoy en Lima para un instante dado, como `AAAA-MM-DD`. */
export function hoyEnLima(ahora: Date): string {
  const partes = Object.fromEntries(formateador.formatToParts(ahora).map(p => [p.type, p.value]));
  return `${partes['year']}-${partes['month']}-${partes['day']}`;
}

/** `true` solo para una fecha real con la forma `AAAA-MM-DD` (rechaza 2026-02-30 y formatos con hora). */
export function esFechaDeCalendario(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/** Comparación de fechas de calendario (el orden alfabético de `AAAA-MM-DD` coincide con el cronológico). */
export const esAnterior = (a: string, b: string): boolean => a < b;
