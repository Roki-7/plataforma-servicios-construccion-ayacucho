import { datosInvalidos, ErrorAplicacion } from './errores.js';
import { perfilesIniciales } from './perfiles-habilitados.js';
import { validarNuevaContrasena } from './politica-contrasena.js';
import { exigirContactoValido, normalizarOpcional } from './datos-contacto.js';
import type { PerfilHabilitado } from './identificadores.js';
// Versión presentada en la web y aceptada explícitamente; nunca elegida por el cliente.
export const PRIVACIDAD_VERSION = '001-v1';
export interface RegistroCuenta {
  nombreMostrar: string; correo: string; contrasena: string; confirmacionContrasena: string;
  perfiles: PerfilHabilitado[]; politicaPrivacidadAceptada: true; politicaPrivacidadVersion: string;
  telefono?: string | null; distrito?: string | null; fotografia?: { tipoContenido: string; contenidoBase64: string };
}
function texto(valor: unknown, campo: string, max: number): void {
  if (typeof valor !== 'string' || !valor.isWellFormed() || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(valor) || [...valor].length > max || !valor.trim()) throw datosInvalidos('Revise los campos indicados.', [{ campo, motivo: `Ingrese un valor válido de hasta ${max} caracteres, sin caracteres de control.` }]);
}
export function validarCuentaNueva(valor: unknown): asserts valor is RegistroCuenta {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw datosInvalidos();
  const v = valor as Record<string, unknown>;
  const permitidos = ['nombreMostrar', 'correo', 'contrasena', 'confirmacionContrasena', 'perfiles', 'politicaPrivacidadAceptada', 'politicaPrivacidadVersion', 'telefono', 'distrito', 'fotografia'];
  if (Object.keys(v).some((k) => !permitidos.includes(k))) throw new ErrorAplicacion(400, 'PROPIEDAD_NO_ADMITIDA', 'Se envió un campo no permitido.');
  exigirContactoValido(v, true); texto(v['correo'], 'correo', 320);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v['correo']))) throw datosInvalidos('Ingrese un correo válido.', [{ campo: 'correo', motivo: 'Ingrese un correo válido.' }]);
  perfilesIniciales(v['perfiles']); validarNuevaContrasena(v['contrasena'], v['confirmacionContrasena']);
  if (v['politicaPrivacidadAceptada'] !== true || v['politicaPrivacidadVersion'] !== PRIVACIDAD_VERSION) throw datosInvalidos('Acepte la política de privacidad vigente.', [{ campo: 'politicaPrivacidadAceptada', motivo: 'Debe aceptar la versión vigente.' }]);
  if (v['fotografia'] !== undefined) {
    const f = v['fotografia']; if (!f || typeof f !== 'object' || Array.isArray(f)) throw datosInvalidos('Imagen no válida.');
    const foto = f as Record<string, unknown>;
    if (Object.keys(foto).some((k) => !['tipoContenido', 'contenidoBase64'].includes(k)) || !['image/jpeg', 'image/png', 'image/webp'].includes(String(foto['tipoContenido'])) || typeof foto['contenidoBase64'] !== 'string' || !foto['contenidoBase64'].isWellFormed()) throw datosInvalidos('Imagen no válida.');
  }
}
/** Teléfono y distrito vacíos o de solo espacios pasan a null (decisión 2 de la enmienda de 001). Se aplica después de validar. */
export function normalizarRegistro(d: RegistroCuenta): RegistroCuenta {
  return { ...d, ...(d.telefono !== undefined ? { telefono: normalizarOpcional(d.telefono) } : {}), ...(d.distrito !== undefined ? { distrito: normalizarOpcional(d.distrito) } : {}) };
}
export interface PerfilCuenta {
  cuentaId: string; nombreMostrar: string; correo: string; telefono: string | null; distrito: string | null;
  fotografiaId: string | null; perfiles: PerfilHabilitado[]; telefonoCompartible: boolean; version: number;
}
