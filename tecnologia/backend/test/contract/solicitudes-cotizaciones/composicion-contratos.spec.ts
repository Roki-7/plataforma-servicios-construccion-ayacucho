import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { componerExtensiones, componerOpenApi, inventarioOpenApi, type DocumentoOpenApi } from '../../../src/composicion/componer-openapi.js';

// CP-308: la composición de los tres contratos. Verifica documentos con el ensamblador real del repositorio. No sustituye al arranque real
// (T011 y T088): aquí no se arranca ninguna aplicación.
const baseBytes = readFileSync('contracts/openapi.json');
const ofertaBytes = readFileSync('contracts/prestadores-catalogo.openapi.json');
const fuenteBytes = readFileSync('../../specs/003-solicitudes-y-cotizaciones/contracts/openapi.json');
const espejoBytes = readFileSync('contracts/solicitudes-cotizaciones.openapi.json');
const base: DocumentoOpenApi = JSON.parse(baseBytes.toString());
const oferta: DocumentoOpenApi = JSON.parse(ofertaBytes.toString());
const solicitudes: DocumentoOpenApi = JSON.parse(espejoBytes.toString());
/** Copia JSON en el mismo realm que JSON.parse (structuredClone de Jest crea prototipos de otro realm que isDeepStrictEqual distingue). */
const clonar = <T>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;
const compuesto = () => componerExtensiones(base, [oferta, solicitudes]);

describe('espejo ejecutable de la 003', () => {
  test('es idéntico, byte a byte, al contrato fuente de la especificación', () => {
    expect(espejoBytes.equals(fuenteBytes)).toBe(true);
  });
  test('las copias de 001 y 002 siguen idénticas a sus fuentes normativas', () => {
    expect(baseBytes.equals(readFileSync('../../specs/001-usuarios-y-acceso/contracts/openapi.json'))).toBe(true);
    expect(ofertaBytes.equals(readFileSync('../../specs/002-prestadores-y-catalogo/contracts/openapi.json'))).toBe(true);
  });
});

describe('inventarios', () => {
  test('17 operaciones de la 001, 23 de la 002 y 18 de la 003', () => {
    expect(inventarioOpenApi(base)).toHaveLength(17);
    expect(inventarioOpenApi(oferta)).toHaveLength(23);
    expect(inventarioOpenApi(solicitudes)).toHaveLength(18);
  });
  test('todas las operaciones de la 003 terminan en 003, exigen Bearer y las mutaciones exigen Origin e Idempotency-Key', () => {
    for (const { metodo, operacion } of inventarioOpenApi(solicitudes)) {
      expect(operacion.operationId).toMatch(/003$/);
      expect(JSON.stringify(operacion['security'])).toContain('bearerAuth');
      const refs = JSON.stringify(operacion['parameters'] ?? []);
      if (metodo !== 'get') { expect(refs).toContain('#/components/parameters/Origin'); expect(refs).toContain('#/components/parameters/IdempotencyKey'); }
    }
  });
});

describe('composición de los tres documentos', () => {
  test('une 58 operaciones sin colisión de ruta ni ambigüedad y con operationId únicos', () => {
    const todo = compuesto();
    const inventario = inventarioOpenApi(todo);
    expect(inventario).toHaveLength(58);
    expect(new Set(inventario.map(({ operacion }) => operacion.operationId)).size).toBe(58);
    expect(new Set(inventario.map(({ metodo, ruta }) => `${metodo} ${ruta}`)).size).toBe(58);
  });

  test('no modifica ninguna de las fuentes y conserva cada ruta tal como la definió su documento', () => {
    const todo = compuesto();
    for (const [ruta, item] of [...Object.entries(base.paths), ...Object.entries(oferta.paths), ...Object.entries(solicitudes.paths)]) expect(todo.paths[ruta]).toEqual(item);
    expect(base).toEqual(JSON.parse(baseBytes.toString()));
    expect(oferta).toEqual(JSON.parse(ofertaBytes.toString()));
    expect(solicitudes).toEqual(JSON.parse(espejoBytes.toString()));
  });

  test('es determinista y no depende del orden en que se compongan las extensiones', () => {
    expect(JSON.stringify(compuesto())).toBe(JSON.stringify(compuesto()));
    const alReves = componerExtensiones(base, [solicitudes, oferta]);
    const claves = (d: DocumentoOpenApi) => inventarioOpenApi(d).map(({ metodo, ruta, operacion }) => `${metodo} ${ruta} ${operacion.operationId}`).sort();
    expect(claves(alReves)).toEqual(claves(compuesto()));
    expect(alReves.components).toEqual(compuesto().components);
  });

  test('ninguna operación de la 003 repite método y ruta de la 001 o de la 002', () => {
    const ocupadas = new Set([...inventarioOpenApi(base), ...inventarioOpenApi(oferta)].map(({ metodo, ruta }) => `${metodo} ${ruta}`));
    for (const { metodo, ruta } of inventarioOpenApi(solicitudes)) expect(ocupadas.has(`${metodo} ${ruta}`)).toBe(false);
  });

  test('la composición de 001 y 002 sigue siendo de 40 operaciones y la base de 17', () => {
    expect(inventarioOpenApi(componerOpenApi(base, oferta))).toHaveLength(40);
    expect(inventarioOpenApi(componerExtensiones(base, [oferta]))).toHaveLength(40);
    expect(inventarioOpenApi(base)).toHaveLength(17);
  });

  test('los componentes compartidos IdempotencyKey, Origin y bearerAuth son idénticos en los tres documentos', () => {
    const todo = compuesto();
    for (const nombre of ['IdempotencyKey', 'Origin']) {
      const referencia = base.components!['parameters']![nombre];
      expect(oferta.components!['parameters']![nombre]).toEqual(referencia);
      expect(solicitudes.components!['parameters']![nombre]).toEqual(referencia);
      expect(todo.components!['parameters']![nombre]).toEqual(referencia);
    }
    const bearer = base.components!['securitySchemes']!['bearerAuth'];
    expect(oferta.components!['securitySchemes']!['bearerAuth']).toEqual(bearer);
    expect(solicitudes.components!['securitySchemes']!['bearerAuth']).toEqual(bearer);
    expect(todo.components!['securitySchemes']!['bearerAuth']).toEqual(bearer);
  });
});

describe('colisiones que impiden cargar el documento', () => {
  const primera = () => clonar(solicitudes.paths['/solicitudes']!.get!);
  const sobre = (cambiar: (d: DocumentoOpenApi) => void) => { const copia = clonar(solicitudes); cambiar(copia); return () => componerExtensiones(base, [oferta, copia]); };
  test.each([
    ['método y ruta de la 001', (d: DocumentoOpenApi) => { d.paths['/salud'] = { get: { ...primera(), operationId: 'duplicadaSalud' } }; }, /método y ruta/],
    ['método y ruta de la 002', (d: DocumentoOpenApi) => { d.paths['/servicios/mios'] = { get: { ...primera(), operationId: 'duplicadaServicios' } }; }, /método y ruta/],
    ['operationId de la 002', (d: DocumentoOpenApi) => { d.paths['/otro'] = { get: { ...primera(), operationId: 'listarMisServicios002' } }; }, /operationId/],
    ['parámetros que compiten con la 002', (d: DocumentoOpenApi) => { d.paths['/servicios/{otro}'] = { get: { ...primera(), operationId: 'otraDeServicios003' } }; }, /ambiguas/],
    ['referencia sin resolución', (d: DocumentoOpenApi) => { d.components!['schemas']!['Rota'] = { $ref: '#/components/schemas/Ausente' }; }, /Referencia OpenAPI sin resolución/],
    ['componente compartido incompatible', (d: DocumentoOpenApi) => { d.components!['parameters']!['Origin'] = { name: 'cambiado' }; }, /Componente OpenAPI incompatible: parameters\/Origin/],
    ['esquema de seguridad incompatible', (d: DocumentoOpenApi) => { d.components!['securitySchemes']!['bearerAuth'] = { type: 'http', scheme: 'basic' }; }, /Componente OpenAPI incompatible: securitySchemes\/bearerAuth/],
  ] as const)('rechaza %s', (_nombre, cambiar, mensaje) => {
    expect(sobre(cambiar)).toThrow(mensaje);
  });
});
