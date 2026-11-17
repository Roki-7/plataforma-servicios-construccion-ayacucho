import type { PerfilHabilitado } from './identificadores.js';
import { datosInvalidos } from './errores.js';
export function perfilesIniciales(valor: unknown): PerfilHabilitado[] {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > 2 || new Set(valor).size !== valor.length || valor.some((p) => p !== 'cliente' && p !== 'prestador')) throw datosInvalidos('Seleccione cliente, prestador o ambos.');
  return [...valor].sort() as PerfilHabilitado[];
}
export function agregarPerfil(actuales: readonly PerfilHabilitado[], perfil: unknown, confirmacion: unknown): PerfilHabilitado[] {
  if (confirmacion !== true || (perfil !== 'cliente' && perfil !== 'prestador')) throw datosInvalidos('Confirme explícitamente la incorporación del perfil.');
  return perfilesIniciales([...new Set([...actuales, perfil])]);
}
