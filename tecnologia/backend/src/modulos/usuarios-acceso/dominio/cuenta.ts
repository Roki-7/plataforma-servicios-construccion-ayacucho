import { datosInvalidos, ErrorAplicacion } from './errores.js';
import { perfilesIniciales } from './perfiles-habilitados.js';
import { validarNuevaContrasena } from './politica-contrasena.js';
import type { PerfilHabilitado } from './identificadores.js';
// Versión presentada en la web y aceptada explícitamente; nunca elegida por el cliente.
export const PRIVACIDAD_VERSION = '001-v1';
export interface RegistroCuenta {
  nombreMostrar: string; correo: string; contrasena: string; confirmacionContrasena: string;
  perfiles: PerfilHabilitado[]; politicaPrivacidadAceptada: true; politicaPrivacidadVersion: string;
  telefono?: string | null; distrito?: string | null; fotografia?: { tipoContenido: string; contenidoBase64: string };
}
function texto(valor: unknown, campo: string, max: number, opcional = false): void {
  if (opcional && (valor === undefined || valor === null)) return;
  if (typeof valor !== 'string' || !valor.isWellFormed() || [...valor].length > max || (!opcional && !valor.trim())) throw datosInvalidos('Revise los campos indicados.', [{ campo, motivo: `Ingrese un valor válido de hasta ${max} caracteres.` }]);
}
export function validarCuentaNueva(valor: unknown): asserts valor is RegistroCuenta {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw datosInvalidos();
  const v = valor as Record<string, unknown>;
  const permitidos = ['nombreMostrar', 'correo', 'contrasena', 'confirmacionContrasena', 'perfiles', 'politicaPrivacidadAceptada', 'politicaPrivacidadVersion', 'telefono', 'distrito', 'fotografia'];
  if (Object.keys(v).some((k) => !permitidos.includes(k))) throw new ErrorAplicacion(400, 'PROPIEDAD_NO_ADMITIDA', 'Se envió un campo no permitido.');
  texto(v['nombreMostrar'], 'nombreMostrar', 200); texto(v['correo'], 'correo', 320); texto(v['telefono'], 'telefono', 32, true); texto(v['distrito'], 'distrito', 100, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v['correo']))) throw datosInvalidos('Ingrese un correo válido.', [{ campo: 'correo', motivo: 'Ingrese un correo válido.' }]);
  perfilesIniciales(v['perfiles']); validarNuevaContrasena(v['contrasena'], v['confirmacionContrasena']);
  if (v['politicaPrivacidadAceptada'] !== true || v['politicaPrivacidadVersion'] !== PRIVACIDAD_VERSION) throw datosInvalidos('Acepte la política de privacidad vigente.', [{ campo: 'politicaPrivacidadAceptada', motivo: 'Debe aceptar la versión vigente.' }]);
  if (v['fotografia'] !== undefined) {
    const f = v['fotografia']; if (!f || typeof f !== 'object' || Array.isArray(f)) throw datosInvalidos('Imagen no válida.');
    const foto = f as Record<string, unknown>;
    if (Object.keys(foto).some((k) => !['tipoContenido', 'contenidoBase64'].includes(k)) || !['image/jpeg', 'image/png', 'image/webp'].includes(String(foto['tipoContenido'])) || typeof foto['contenidoBase64'] !== 'string' || !foto['contenidoBase64'].isWellFormed()) throw datosInvalidos('Imagen no válida.');
  }
}
export interface PerfilCuenta {
  cuentaId: string; nombreMostrar: string; correo: string; telefono: string | null; distrito: string | null;
  fotografiaId: string | null; perfiles: PerfilHabilitado[]; telefonoCompartible: boolean; version: number;
}
