import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { componerOpenApi, inventarioOpenApi, type DocumentoOpenApi } from '../../../src/composicion/componer-openapi.js';

const baseBytes = readFileSync('contracts/openapi.json');
const ofertaBytes = readFileSync('../../specs/002-prestadores-y-catalogo/contracts/openapi.json');
const base: DocumentoOpenApi = JSON.parse(baseBytes.toString());
const oferta: DocumentoOpenApi = JSON.parse(ofertaBytes.toString());
/** Copia JSON en el mismo realm que JSON.parse. structuredClone de Jest crea prototipos de otro realm que isDeepStrictEqual distingue. */
const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;

test('protege las dos copias 001 y sus 17 operaciones', () => {
  expect(baseBytes.equals(readFileSync('../../specs/001-usuarios-y-acceso/contracts/openapi.json'))).toBe(true);
  expect(inventarioOpenApi(base)).toHaveLength(17);
});

test('une 40 operaciones sin cambiar las fuentes y deduplica por igualdad estructural', () => {
  const ambas = componerOpenApi(base, oferta);
  expect(inventarioOpenApi(ambas)).toHaveLength(40);
  expect(inventarioOpenApi(oferta)).toHaveLength(23);
  for (const [ruta, item] of [...Object.entries(base.paths), ...Object.entries(oferta.paths)]) expect(ambas.paths[ruta]).toEqual(item);
  expect(JSON.stringify(ambas)).toBe(JSON.stringify(componerOpenApi(base, oferta)));
  expect(base).toEqual(JSON.parse(baseBytes.toString()));
  expect(oferta).toEqual(JSON.parse(ofertaBytes.toString()));
});

test('la fuente 002 empaquetada coincide exactamente con la versión normativa', () => {
  expect(readFileSync('contracts/prestadores-catalogo.openapi.json').equals(ofertaBytes)).toBe(true);
});

describe('colisiones que impiden cargar el documento', () => {
  const primera = () => clonar(oferta.paths['/servicios/mios']!.get!);
  test.each([
    ['método y ruta', (d: DocumentoOpenApi) => { d.paths['/salud'] = { get: { ...primera(), operationId: 'duplicada' } }; }, /método y ruta/],
    ['operationId', (d: DocumentoOpenApi) => { d.paths['/otro'] = { get: primera() }; }, /operationId/],
    ['parámetros que compiten', (d: DocumentoOpenApi) => { d.paths['/servicios/{otro}'] = { get: { ...primera(), operationId: 'otra' } }; }, /ambiguas/],
    ['prioridades cruzadas', (d: DocumentoOpenApi) => {
      d.paths['/ejemplo/fijo/{id}'] = { get: { ...primera(), operationId: 'primera' } };
      d.paths['/ejemplo/{id}/otro'] = { get: { ...primera(), operationId: 'segunda' } };
    }, /ambiguas/],
    ['referencia sin resolución', (d: DocumentoOpenApi) => { d.components!['schemas']!['Rota'] = { $ref: '#/components/schemas/Ausente' }; }, /Referencia OpenAPI sin resolución: #\/components\/schemas\/Ausente/],
    ['componente homónimo incompatible', (d: DocumentoOpenApi) => { d.components!['parameters']!['Origin'] = { name: 'cambiado' }; }, /Componente OpenAPI incompatible: parameters\/Origin/],
  ] as const)('rechaza %s', (_nombre, cambiar, mensaje) => {
    const copia = clonar(oferta);
    cambiar(copia);
    expect(() => componerOpenApi(base, copia)).toThrow(mensaje);
  });
});

test('acepta componentes homónimos estructuralmente equivalentes aunque difieran en el orden de claves', () => {
  const copia = clonar(oferta);
  const original = base.components!['parameters']!['IdempotencyKey'] as Record<string, unknown>;
  copia.components!['parameters']!['IdempotencyKey'] = Object.fromEntries(Object.entries(original).reverse());
  const ambas = componerOpenApi(base, copia);
  expect(ambas.components!['parameters']!['IdempotencyKey']).toEqual(original);
  expect(inventarioOpenApi(ambas)).toHaveLength(40);
});
