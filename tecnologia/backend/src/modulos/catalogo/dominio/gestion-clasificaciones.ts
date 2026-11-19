import { ErrorAplicacion, type DetalleError } from '../../../compartido/dominio/errores.js';
import { textoPlano } from '../../../compartido/dominio/texto-plano.js';
import type { Clasificacion } from './clasificacion.js';

export const limiteNombreClasificacion = 120;

/** Clave de comparación de nombres: sin mayúsculas, tildes ni espacios repetidos. */
export function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
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
