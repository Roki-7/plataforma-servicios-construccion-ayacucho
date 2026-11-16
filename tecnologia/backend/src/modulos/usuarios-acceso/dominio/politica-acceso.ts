import { ErrorAplicacion } from './errores.js';
import type { IdCuenta, PerfilHabilitado } from './identificadores.js';

export function exigirTitularidad(actor: IdCuenta, titular: IdCuenta, perfiles: readonly PerfilHabilitado[], requerido?: PerfilHabilitado): void {
  if (actor !== titular || perfiles.length === 0 || perfiles.some((p) => p !== 'cliente' && p !== 'prestador') || (requerido !== undefined && !perfiles.includes(requerido))) {
    throw new ErrorAplicacion(403, 'SIN_PERMISO', 'No dispone de permiso para esta operación.');
  }
}
export function exigirRecursoVisible(actor: IdCuenta, titular: IdCuenta): void {
  if (actor !== titular) throw new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.');
}
