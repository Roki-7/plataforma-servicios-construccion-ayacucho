import { describe, expect, test } from 'vitest';
import { campoConError, grupoConError, idError } from '../../../src/features/prestadores-catalogo/presentacion/errores-campo.js';

describe('T080 · asociación de los errores de validación con su campo', () => {
  test('un campo con error declara aria-invalid y aria-describedby hacia el id del texto del error', () => {
    const errores = { titulo: 'Indique el título del servicio.' };
    expect(campoConError(errores, 'nuevo', 'titulo')).toEqual({ 'aria-invalid': true, 'aria-describedby': idError('nuevo', 'titulo') });
    expect(idError('nuevo', 'titulo')).toBe('error-nuevo-titulo');
  });
  test('un campo sin error no declara nada, y un grupo solo declara la descripción', () => {
    expect(campoConError({}, 'nuevo', 'titulo')).toEqual({});
    expect(grupoConError({ distritos: 'Seleccione entre uno y cinco distritos.' }, 'perfil', 'distritos')).toEqual({ 'aria-describedby': 'error-perfil-distritos' });
    expect(grupoConError({}, 'perfil', 'distritos')).toEqual({});
  });
});
