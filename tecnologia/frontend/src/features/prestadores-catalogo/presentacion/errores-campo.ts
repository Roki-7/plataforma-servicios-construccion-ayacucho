/**
 * Asocia el error de validación de un campo con el propio campo: el texto lleva un `id` y el campo declara `aria-invalid` y `aria-describedby` hacia él,
 * de modo que un lector de pantalla lo anuncia al enfocar el campo y no solo al aparecer el aviso.
 */
export const idError = (prefijo: string, clave: string): string => `error-${prefijo}-${clave}`;
export function campoConError(errores: Readonly<Record<string, string>>, prefijo: string, clave: string): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
  return errores[clave] ? { 'aria-invalid': true, 'aria-describedby': idError(prefijo, clave) } : {};
}
/** Grupos (fieldset): admiten la descripción, pero no `aria-invalid`. */
export function grupoConError(errores: Readonly<Record<string, string>>, prefijo: string, clave: string): { 'aria-describedby'?: string } {
  return errores[clave] ? { 'aria-describedby': idError(prefijo, clave) } : {};
}
