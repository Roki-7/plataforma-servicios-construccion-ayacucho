import { ErrorAplicacion, type DetalleError } from '../../../compartido/dominio/errores.js';
import { textoPlano } from '../../../compartido/dominio/texto-plano.js';
import type { Clasificacion } from './clasificacion.js';

export const limiteNombreClasificacion = 120;

/**
 * Espacios que se reducen a un espacio convencional (INC-002-01). Conjunto explícito, no `\s`: la misma lista está en la función SQL
 * `catalogo_clave_nombre`. U+0009 a U+000D (tabulador, saltos, avance de página), U+0020, U+0085, U+00A0, U+1680, U+2000 a U+200A,
 * U+2028, U+2029, U+202F, U+205F y U+3000. No incluye U+200B ni U+FEFF (no son espacios: se conservan).
 */
// eslint-disable-next-line no-control-regex -- el conjunto de espacios equivalentes incluye U+0009 a U+000D a propósito
const ESPACIOS_EQUIVALENTES = /[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;

/**
 * Clave de comparación de nombres entre hermanas. Debe producir lo mismo que `catalogo_clave_nombre` de PostgreSQL, que es la autoridad.
 * 1. Descompone en NFD. 2. Conserva la distinción entre ñ y n (n + tilde combinante pasa a ñ). 3. Elimina las marcas combinantes
 * U+0300 a U+036F (tildes de las vocales, diéresis, etc.); los signos de espaciado ^ ` ¨ · NO son marcas combinantes y se conservan.
 * 4. Reduce los espacios equivalentes a uno y recorta. 5. Minúsculas (Σ siempre a σ, como PostgreSQL).
 */
export function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/[Nn]\u0303/g, '\u00f1').replace(/[\u0300-\u036f]/g, '')
    .replace(ESPACIOS_EQUIVALENTES, ' ').replace(/^ | $/g, '').replace(/\u03a3/g, '\u03c3').toLowerCase();
}

function nombreValido(nombre: unknown): string {
  const errores: DetalleError[] = [];
  const valor = textoPlano('nombre', nombre, limiteNombreClasificacion, errores);
  if (errores.length) throw new ErrorAplicacion(400, 'DATOS_INVALIDOS', 'Revise los datos enviados.', errores);
  return valor.trim();
}

/** Toda clasificación nace inactiva. Una subcategoría exige una raíz como padre y el vínculo no cambia después. */
export function crearClasificacion(entrada: { id: string; nombre: unknown; padre?: Clasificacion }): Clasificacion {
  const nombre = nombreValido(entrada.nombre);
  if (!entrada.padre) return { id: entrada.id, nombre, nivel: 1, categoriaPadreId: null, activa: false, version: 1 };
  if (entrada.padre.nivel !== 1) {
    throw new ErrorAplicacion(422, 'JERARQUIA_CATEGORIA_NO_VALIDA', 'La jerarquía admite solo dos niveles.', [{ campo: 'categoriaPadreId', motivo: 'El padre debe ser una categoría raíz.' }]);
  }
  return { id: entrada.id, nombre, nivel: 2, categoriaPadreId: entrada.padre.id, activa: false, version: 1 };
}

/** Cambia solo el nombre. Jerarquía, identidad y estado se conservan. */
export function editarNombreClasificacion(actual: Clasificacion, nombre: unknown): Clasificacion {
  return { ...actual, nombre: nombreValido(nombre), version: actual.version + 1 };
}

/** Activa o desactiva el estado propio. Repetir el estado vigente es un conflicto. */
export function cambiarEstadoClasificacion(actual: Clasificacion, activa: boolean): Clasificacion {
  if (actual.activa === activa) {
    throw new ErrorAplicacion(422, 'TRANSICION_NO_ADMITIDA', activa ? 'La clasificación ya está activa.' : 'La clasificación ya está inactiva.', [{ campo: 'activa', motivo: 'La clasificación ya tiene ese estado.' }]);
  }
  return { ...actual, activa, version: actual.version + 1 };
}
