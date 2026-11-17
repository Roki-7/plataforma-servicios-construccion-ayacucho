import { validarCuentaNueva, type RegistroCuenta } from '../dominio/cuenta.js';
import { datosInvalidos } from '../dominio/errores.js';
import type { PerfilHabilitado } from '../dominio/identificadores.js';
export function registroDto(valor: unknown): RegistroCuenta { validarCuentaNueva(valor); return valor; }
export interface Habilitacion { version: number; perfil: PerfilHabilitado; confirmacionExplicita: true }
export function habilitacionDto(valor: unknown): Habilitacion {
  const v = valor as Partial<Habilitacion> | null;
  if (!v || !Number.isSafeInteger(v.version) || (v.version ?? 0) < 1 || !['cliente', 'prestador'].includes(v.perfil ?? '') || v.confirmacionExplicita !== true || Object.keys(v).some((k) => !['version', 'perfil', 'confirmacionExplicita'].includes(k))) throw datosInvalidos('Confirme el perfil y su versión.');
  return v as Habilitacion;
}
