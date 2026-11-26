import { datosInvalidos } from './errores.js';

/**
 * Enmienda controlada de 001 (T080, revisión manual): reglas de nombre para mostrar, teléfono y distrito de cuenta.
 *  - Nombre: obligatorio, hasta 200 puntos de código, sin caracteres de control; admite personas y empresas, tildes y signos habituales.
 *  - Teléfono: opcional; solo dígitos, espacios y `+ - . ( )`; entre 6 y 15 dígitos; hasta 32 caracteres; sin formato nacional.
 *  - Distrito: opcional; texto libre de hasta 100 puntos de código; sin caracteres de control.
 *  - Teléfono y distrito vacíos o con solo espacios se normalizan a null.
 * «Carácter de control» es la categoría Unicode Cc (NUL, saltos de línea, tabuladores, DEL y los controles C1) más los separadores de línea y de párrafo (U+2028 y U+2029).
 */
export const MAX_NOMBRE = 200;
export const MAX_TELEFONO = 32;
export const MAX_DISTRITO = 100;
export const MIN_DIGITOS_TELEFONO = 6;
export const MAX_DIGITOS_TELEFONO = 15;
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/u;
const CARACTERES_TELEFONO = /^[0-9 +().-]+$/;

export interface DetalleCampo { campo: string; motivo: string }

const largo = (v: string): number => [...v].length;
const sinControl = (etiqueta: string): string => `${etiqueta} no puede incluir saltos de línea, tabuladores ni otros caracteres de control.`;

/** Motivo de rechazo del nombre para mostrar, o null si es válido. */
export function motivoNombre(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.isWellFormed()) return 'Ingrese un nombre válido.';
  if (CONTROL.test(valor)) return sinControl('El nombre');
  if (!valor.trim()) return 'Ingrese su nombre para mostrar.';
  if (largo(valor) > MAX_NOMBRE) return `Use hasta ${MAX_NOMBRE} caracteres.`;
  return null;
}

/** Motivo de rechazo del teléfono (un valor vacío o de solo espacios se admite: se normaliza a null), o null si es válido. */
export function motivoTelefono(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.isWellFormed()) return 'Ingrese un teléfono válido.';
  if (CONTROL.test(valor)) return sinControl('El teléfono');
  if (!valor.trim()) return null;
  if (largo(valor) > MAX_TELEFONO) return `Use hasta ${MAX_TELEFONO} caracteres.`;
  if (!CARACTERES_TELEFONO.test(valor.trim())) return 'Use solo dígitos, espacios y los signos + - . ( ).';
  const digitos = (valor.match(/[0-9]/g) ?? []).length;
  if (digitos < MIN_DIGITOS_TELEFONO || digitos > MAX_DIGITOS_TELEFONO) return `Ingrese entre ${MIN_DIGITOS_TELEFONO} y ${MAX_DIGITOS_TELEFONO} dígitos.`;
  return null;
}

/** Motivo de rechazo del distrito de cuenta (texto libre), o null si es válido. */
export function motivoDistrito(valor: unknown): string | null {
  if (typeof valor !== 'string' || !valor.isWellFormed()) return 'Ingrese un distrito válido.';
  if (CONTROL.test(valor)) return sinControl('El distrito');
  if (largo(valor) > MAX_DISTRITO) return `Use hasta ${MAX_DISTRITO} caracteres.`;
  return null;
}

/** Valida los tres campos presentes (undefined y null se omiten donde corresponde) y devuelve todos los motivos, uno por campo. */
export function detallesContacto(v: { nombreMostrar?: unknown; telefono?: unknown; distrito?: unknown }, nombreObligatorio: boolean): DetalleCampo[] {
  const detalles: DetalleCampo[] = [];
  const nombre = v.nombreMostrar === undefined && !nombreObligatorio ? null : motivoNombre(v.nombreMostrar);
  if (nombre) detalles.push({ campo: 'nombreMostrar', motivo: nombre });
  const telefono = v.telefono === undefined || v.telefono === null ? null : motivoTelefono(v.telefono);
  if (telefono) detalles.push({ campo: 'telefono', motivo: telefono });
  const distrito = v.distrito === undefined || v.distrito === null ? null : motivoDistrito(v.distrito);
  if (distrito) detalles.push({ campo: 'distrito', motivo: distrito });
  return detalles;
}

export function exigirContactoValido(v: { nombreMostrar?: unknown; telefono?: unknown; distrito?: unknown }, nombreObligatorio: boolean): void {
  const detalles = detallesContacto(v, nombreObligatorio);
  if (detalles.length) throw datosInvalidos('Revise los campos indicados.', detalles);
}

/** Vacío o solo espacios pasa a null; undefined (no enviado) y null se conservan; cualquier otro valor se guarda tal como se envió. */
export function normalizarOpcional<T extends string | null | undefined>(valor: T): T | null {
  return typeof valor === 'string' && !valor.trim() ? null : valor;
}
