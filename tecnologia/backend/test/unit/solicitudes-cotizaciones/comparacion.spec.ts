import { describe, expect, test } from '@jest/globals';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import * as comparacion from '../../../src/modulos/cotizaciones/dominio/comparacion.js';
import { idsDeComparacion, MAXIMO_COMPARACION, NO_INDICADO, vistaDeComparacion, type EntradaDeComparacion } from '../../../src/modulos/cotizaciones/dominio/comparacion.js';

// T082 · vista de comparación (FR-343, CA-COT-08, CA-COT-12, CA-RF17-04): «No indicado», rótulo de estimada, sin sumas, sin «mejor» y con las señales de estado.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const futuro = new Date('2031-12-31T00:00:00.000Z');
const entrada = (n: number, extra: Partial<EntradaDeComparacion> = {}, version: Partial<EntradaDeComparacion['version']> = {}): EntradaDeComparacion => ({
  cotizacionId: uuid(n), prestadorNombre: `Prestador ${n}`, estado: 'VIGENTE', vencida: false, requiereRevision: false, solicitudCerrada: false,
  version: { numero: 1, tipo: 'DEFINITIVA', alcance: 'Levantar el muro', precioCentimos: 250050, plazoDias: 6, condicionesPago: '50 % al inicio', vigenteHasta: futuro, ...version }, ...extra,
});

describe('ids de comparación (CA-COT-12)', () => {
  test('acepta hasta 10 identificadores distintos, en el orden indicado y en minúsculas', () => {
    const ids = Array.from({ length: MAXIMO_COMPARACION }, (_, i) => uuid(i + 1));
    expect(idsDeComparacion(ids.join(','))).toEqual(ids);
    expect(idsDeComparacion('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA')).toEqual(['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  });
  test('quita los repetidos antes de contar y rechaza más de 10 con 422 LIMITE_COMPARACION', () => {
    expect(idsDeComparacion(`${uuid(1)},${uuid(1)},${uuid(2)}`)).toEqual([uuid(1), uuid(2)]);
    const once = Array.from({ length: MAXIMO_COMPARACION + 1 }, (_, i) => uuid(i + 1)).join(',');
    try { idsDeComparacion(once); throw new Error('debió fallar'); } catch (e) { expect(e).toBeInstanceOf(ErrorAplicacion); expect(e).toMatchObject({ http: 422, codigo: 'LIMITE_COMPARACION' }); }
    expect(() => idsDeComparacion(`${uuid(1)},${uuid(1)},${uuid(1)},${uuid(1)},${uuid(1)},${uuid(1)},${uuid(1)},${uuid(1)},${uuid(1)},${uuid(1)},${uuid(1)}`)).not.toThrow();
  });
  test('un identificador mal formado o una lista vacía se rechazan con 400 DATOS_INVALIDOS', () => {
    for (const malo of ['no-es-uuid', '', `${uuid(1)},`, `${uuid(1)},xyz`]) expect(() => idsDeComparacion(malo)).toThrow(expect.objectContaining({ http: 400, codigo: 'DATOS_INVALIDOS' }));
  });
});

describe('«No indicado» y rótulos (CA-RF17-04)', () => {
  test('todos los campos de RF17 están siempre presentes y los ausentes dicen «No indicado»', () => {
    const { columnas } = vistaDeComparacion([entrada(1, {}, { tipo: 'ESTIMADA', precioCentimos: undefined, plazoDias: undefined, condicionesPago: undefined, formaCalculo: 'S/ 85 por m2' })]);
    expect(Object.keys(columnas[0]!.campos)).toEqual(['tipo', 'precio', 'plazo', 'vigencia', 'alcance', 'exclusiones', 'materiales', 'manoDeObra', 'formaCalculo', 'condicionesPago']);
    expect(columnas[0]!.campos).toMatchObject({ precio: NO_INDICADO, plazo: NO_INDICADO, condicionesPago: NO_INDICADO, exclusiones: NO_INDICADO, materiales: NO_INDICADO, manoDeObra: NO_INDICADO, formaCalculo: 'S/ 85 por m2', alcance: 'Levantar el muro' });
  });
  test('el precio se muestra en soles y el plazo en días', () => {
    const { campos } = vistaDeComparacion([entrada(1)]).columnas[0]!;
    expect(campos.precio).toMatch(/^S\/\s2[\s\u00a0.,]?500[.,]50$/);
    expect(campos.plazo).toBe('6 días');
    expect(vistaDeComparacion([entrada(2, {}, { plazoDias: 1 })]).columnas[0]!.campos.plazo).toBe('1 día');
  });
  test('una estimada se rotula como tal y no se presenta como definitiva, ni siquiera con precio', () => {
    const { columnas, advertencias } = vistaDeComparacion([entrada(1, {}, { tipo: 'ESTIMADA' }), entrada(2)]);
    expect(columnas.map(c => [c.rotuloDeTipo, c.esEstimada, c.precioEsFinal])).toEqual([['Estimada', true, false], ['Definitiva', false, true]]);
    expect(columnas[0]!.campos.tipo).toBe('Estimada');
    expect(advertencias).toContain('Las cotizaciones estimadas no son un precio final y no son comparables con las definitivas.');
  });
  test('sin estimadas no hay advertencia de comparabilidad', () => {
    expect(vistaDeComparacion([entrada(1), entrada(2)]).advertencias).toEqual([]);
  });
  test('sin nombre autorizado el autor se muestra sin inventarlo', () => {
    expect(vistaDeComparacion([entrada(1, { prestadorNombre: undefined })]).columnas[0]!.prestador).toBe(NO_INDICADO);
  });
});

describe('sin sumas ni clasificación de «mejor»', () => {
  test('el módulo no ofrece sumar, totalizar, puntuar ni ordenar', () => {
    expect(Object.keys(comparacion).filter(n => /sum|total|mejor|rank|punt|ordenar|mejores|promedio/i.test(n))).toEqual([]);
  });
  test('la vista no contiene totales, puntajes ni posiciones, y conserva el orden recibido aunque no sea el de precio', () => {
    const vista = vistaDeComparacion([entrada(3, {}, { precioCentimos: 900000 }), entrada(1, {}, { precioCentimos: 100 }), entrada(2, {}, { precioCentimos: 500000 })]);
    expect(vista.columnas.map(c => c.cotizacionId)).toEqual([uuid(3), uuid(1), uuid(2)]);
    expect(JSON.stringify(vista)).not.toMatch(/total|suma|mejor|ranking|puntaje|posicion|recomend/i);
    expect(Object.keys(vista).sort()).toEqual(['advertencias', 'columnas']);
  });
});

describe('señales de estado (FR-339)', () => {
  test('señala las vencidas, las pendientes de revisión, las de solicitud cerrada y las retiradas, todas a la vez si coinciden', () => {
    const { columnas } = vistaDeComparacion([
      entrada(1), entrada(2, { estado: 'VENCIDA', vencida: true }), entrada(3, { estado: 'PENDIENTE_REVISION', requiereRevision: true }),
      entrada(4, { solicitudCerrada: true }), entrada(5, { estado: 'RETIRADA', vencida: true, requiereRevision: true, solicitudCerrada: true }),
    ]);
    expect(columnas.map(c => c.senales)).toEqual([[], ['VENCIDA'], ['PENDIENTE_REVISION'], ['SOLICITUD_CERRADA'], ['RETIRADA', 'VENCIDA', 'PENDIENTE_REVISION', 'SOLICITUD_CERRADA']]);
    expect(columnas.map(c => c.estado)).toEqual(['VIGENTE', 'VENCIDA', 'PENDIENTE_REVISION', 'VIGENTE', 'RETIRADA']);
  });
  test('las señales no alteran el orden ni excluyen cotizaciones de la vista', () => {
    expect(vistaDeComparacion([entrada(2, { estado: 'VENCIDA', vencida: true }), entrada(1)]).columnas.map(c => c.cotizacionId)).toEqual([uuid(2), uuid(1)]);
  });
});
