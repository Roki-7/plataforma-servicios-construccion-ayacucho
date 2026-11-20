import { describe, expect, test } from '@jest/globals';
import { composicionSolicitada } from '../../../src/composicion/main.js';

describe('composición que arranca el punto de entrada', () => {
  test('por omisión es la base de 17 operaciones, también con la variable vacía o igual a base', () => {
    for (const env of [{}, { COMPOSICION: '' }, { COMPOSICION: 'base' }]) expect(composicionSolicitada(env)).toBe('base');
  });
  test('la composición completa solo se activa de forma explícita', () => {
    expect(composicionSolicitada({ COMPOSICION: 'oferta-002' })).toBe('oferta-002');
  });
  test('cualquier otro valor se rechaza: no hay una composición implícita', () => {
    for (const valor of ['completa', 'OFERTA-002', ' base', 'oferta-002 ', 'true', '1', 'oferta', '002']) {
      expect(() => composicionSolicitada({ COMPOSICION: valor })).toThrow('COMPOSICION no es válida');
    }
  });
});
