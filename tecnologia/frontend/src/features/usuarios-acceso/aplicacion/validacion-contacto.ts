/**
 * Enmienda controlada de 001 (T080): reglas de nombre para mostrar, teléfono y distrito de cuenta. Son las mismas que valida el servidor, que decide por sí mismo:
 * esta validación solo evita viajes inútiles y muestra los mensajes junto al campo. «Carácter de control» = categoría Unicode Cc más los separadores de línea y de párrafo (U+2028, U+2029).
 *  - Nombre: obligatorio, hasta 200 puntos de código, sin caracteres de control (categoría Unicode Cc).
 *  - Teléfono: opcional; solo dígitos, espacios y `+ - . ( )`; entre 6 y 15 dígitos; hasta 32 caracteres; sin formato nacional.
 *  - Distrito: opcional; texto libre de hasta 100 puntos de código; sin caracteres de control.
 *  - Teléfono y distrito vacíos o de solo espacios se envían como null.
 */
export const MAX_NOMBRE = 200;
export const MAX_TELEFONO = 32;
export const MAX_DISTRITO = 100;
export const MIN_DIGITOS_TELEFONO = 6;
export const MAX_DIGITOS_TELEFONO = 15;
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/u;
const CARACTERES_TELEFONO = /^[0-9 +().-]+$/;
const BIEN_FORMADO = (v: string): boolean => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v);
const largo = (v: string): number => [...v].length;
const sinControl = (etiqueta: string): string => `${etiqueta} no puede incluir saltos de línea, tabuladores ni otros caracteres de control.`;

export function motivoNombre(valor: string): string | null {
  if (!BIEN_FORMADO(valor)) return 'Ingrese un nombre válido.';
  if (CONTROL.test(valor)) return sinControl('El nombre');
  if (!valor.trim()) return 'Ingrese su nombre para mostrar.';
  if (largo(valor) > MAX_NOMBRE) return `Use hasta ${MAX_NOMBRE} caracteres.`;
  return null;
}

/** Un valor vacío o de solo espacios es válido: se envía como null. */
export function motivoTelefono(valor: string): string | null {
  if (!BIEN_FORMADO(valor)) return 'Ingrese un teléfono válido.';
  if (CONTROL.test(valor)) return sinControl('El teléfono');
  if (!valor.trim()) return null;
  if (largo(valor) > MAX_TELEFONO) return `Use hasta ${MAX_TELEFONO} caracteres.`;
  if (!CARACTERES_TELEFONO.test(valor.trim())) return 'Use solo dígitos, espacios y los signos + - . ( ).';
  const digitos = (valor.match(/[0-9]/g) ?? []).length;
  if (digitos < MIN_DIGITOS_TELEFONO || digitos > MAX_DIGITOS_TELEFONO) return `Ingrese entre ${MIN_DIGITOS_TELEFONO} y ${MAX_DIGITOS_TELEFONO} dígitos.`;
  return null;
}

export function motivoDistrito(valor: string): string | null {
  if (!BIEN_FORMADO(valor)) return 'Ingrese un distrito válido.';
  if (CONTROL.test(valor)) return sinControl('El distrito');
  if (largo(valor) > MAX_DISTRITO) return `Use hasta ${MAX_DISTRITO} caracteres.`;
  return null;
}

/** Vacío o solo espacios pasa a null; cualquier otro valor se envía tal como se escribió. */
export const aOpcional = (valor: string): string | null => (valor.trim() ? valor : null);

/** Ayuda visible del campo teléfono (se enlaza con aria-describedby). */
export const AYUDA_TELEFONO = 'Opcional. Entre 6 y 15 dígitos; puede usar espacios y los signos + - . ( ).';
