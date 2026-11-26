import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { crearAplicacion } from '../../../src/composicion/app.module.js';
import { crearAplicacionCompleta002 } from '../../../src/composicion/aplicacion-002.js';
import { crearAplicacionCompleta003 } from '../../../src/composicion/aplicacion-003.js';
import { aplicarMigraciones003 } from '../../../src/composicion/migraciones-003.js';
import { registroOferta002 } from '../../../src/composicion/oferta-002.js';
import { registroOferta003 } from '../../../src/composicion/oferta-003.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';
import { almacenEnMemoria003, configuracionDePrueba003, controladorSimulado003, operaciones003 } from '../../soporte/solicitudes-cotizaciones/entorno.js';

/**
 * CP-308 sobre la aplicación real (T011). Arranca Nest con la composición de la 001, la 002 y la 003 sobre bases descartables `ayacucho_003_test_*`.
 * Los controladores de la 003 aún no existen: se usan controladores simulados que solo registran las rutas del contrato, para ensayar la tabla de rutas
 * de `configurarApi`, `verificarRouter` y los modos `prueba` y `completa`. El arranque definitivo con los controladores reales se valida en T088.
 */
type Aplicacion = Awaited<ReturnType<typeof crearAplicacion>>;
const rutas = (app: Aplicacion) => ((app.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router.stack
  .flatMap(({ route }) => route ? Object.keys(route.methods).map(m => `${m.toUpperCase()} ${route.path.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')}`) : [])).sort();
const operaciones = async (archivo: string) => { const o = JSON.parse(await readFile(resolve('contracts', archivo), 'utf8')) as { paths: Record<string, Record<string, unknown>> };
  return Object.entries(o.paths).flatMap(([p, ms]) => Object.keys(ms).filter(m => ['get', 'post', 'put', 'patch', 'delete'].includes(m)).map(m => `${m.toUpperCase()} ${p}`)).sort(); };
const propias003 = () => operaciones003().map(o => o.operationId);
const de003 = (ids: readonly string[]) => operaciones003().filter(o => ids.includes(o.operationId)).map(o => `${o.metodo.toUpperCase()} ${o.ruta}`).sort();

let base: Awaited<ReturnType<typeof baseAislada003>>;
const abiertas: Aplicacion[] = [];
const montar = async (opciones: Parameters<typeof crearAplicacion>[1]): Promise<Aplicacion> => {
  const app = await crearAplicacion(await configuracionDePrueba003(base.url), { worker: false, ...opciones });
  abiertas.push(app);
  return app;
};
const con002 = () => ({ ...registroOferta002({ prestadores: { almacen: almacenEnMemoria003() } }), modo: 'completa' as const });

beforeAll(async () => { base = await baseAislada003(); await aplicarMigraciones003(base.url); }, 180000);
afterAll(async () => {
  for (const app of abiertas) await app.app.close().catch(() => undefined);
  await base?.cerrar();
});

describe('migraciones de la composición con la 003', () => {
  test('son idempotentes sobre la base ya migrada', async () => {
    expect(await aplicarMigraciones003(base.url)).toBe(0);
  }, 120000);
});

describe('modo prueba: un subconjunto de operaciones de la 003', () => {
  const subconjunto = ['listarOportunidades003', 'obtenerSolicitud003', 'listarMisCotizaciones003'];

  test('registra las 40 operaciones de la 001 y la 002 y solo las seleccionadas de la 003', async () => {
    const e = await montar({ oferta002: con002(), oferta003: { ...registroOferta003(), controladores: [controladorSimulado003(subconjunto)], modo: 'prueba', operaciones: subconjunto } });
    const esperadas = [...await operaciones('openapi.json'), ...await operaciones('prestadores-catalogo.openapi.json'), ...de003(subconjunto)].sort();
    expect(rutas(e)).toEqual(esperadas);
    expect(rutas(e)).toHaveLength(43);
  }, 120000);

  test('las rutas seleccionadas exigen identidad (la tabla de configurarApi las marca como protegidas) y las no seleccionadas no existen', async () => {
    const e = await montar({ oferta002: con002(), oferta003: { ...registroOferta003(), controladores: [controladorSimulado003(subconjunto)], modo: 'prueba', operaciones: subconjunto } });
    const http = request(e.app.getHttpServer());
    await http.get('/api/v1/solicitudes/oportunidades').expect(401);
    await http.get('/api/v1/solicitudes/123e4567-e89b-42d3-a456-426614174000').expect(401);
    await http.get('/api/v1/cotizaciones').expect(401);
    // No seleccionadas en este subconjunto: el contrato compuesto no las incluye y no responden como operaciones propias.
    await http.get('/api/v1/solicitudes').expect(404);
    await http.get('/api/v1/solicitudes/123e4567-e89b-42d3-a456-426614174000/historial').expect(404);
    // Las de la 001 y la 002 siguen respondiendo.
    await http.get('/api/v1/salud').expect(200);
    await http.get('/api/v1/categorias').expect(200);
  }, 120000);

  test.each([
    ['sin la 002', () => ({ oferta003: { ...registroOferta003(), modo: 'prueba' as const, operaciones: ['listarOportunidades003'] } }), /requiere la composición de la 002/],
    ['vacío', () => ({ oferta002: con002(), oferta003: { ...registroOferta003(), modo: 'prueba' as const, operaciones: [] } }), /Subconjunto 003 vacío, duplicado o desconocido/],
    ['duplicado', () => ({ oferta002: con002(), oferta003: { ...registroOferta003(), modo: 'prueba' as const, operaciones: ['obtenerSolicitud003', 'obtenerSolicitud003'] } }), /Subconjunto 003/],
    ['desconocido', () => ({ oferta002: con002(), oferta003: { ...registroOferta003(), modo: 'prueba' as const, operaciones: ['inexistente003'] } }), /Subconjunto 003/],
    ['con una operación de la 002', () => ({ oferta002: con002(), oferta003: { ...registroOferta003(), modo: 'prueba' as const, operaciones: ['listarMisServicios002'] } }), /Subconjunto 003/],
  ])('rechaza el subconjunto %s antes de abrir ninguna conexión', async (_nombre, opciones, mensaje) => {
    await expect(crearAplicacion(await configuracionDePrueba003(base.url), { worker: false, ...opciones() })).rejects.toThrow(mensaje);
  });

  test('un controlador simulado de una ruta no seleccionada hace fallar la comprobación del router', async () => {
    await expect(montar({ oferta002: con002(), oferta003: { ...registroOferta003(), controladores: [controladorSimulado003(['listarOportunidades003', 'listarMisSolicitudes003'])],
      modo: 'prueba', operaciones: ['listarOportunidades003'] } })).rejects.toThrow('El router no coincide');
  }, 120000);
});

describe('modo completa: las 58 operaciones', () => {
  test('con un controlador por operación registra exactamente las 58 del contrato compuesto, sin rutas adicionales', async () => {
    const e = await montar({ oferta002: con002(), oferta003: { ...registroOferta003(), controladores: [controladorSimulado003()], modo: 'completa' } });
    const esperadas = [...await operaciones('openapi.json'), ...await operaciones('prestadores-catalogo.openapi.json'), ...await operaciones('solicitudes-cotizaciones.openapi.json')].sort();
    expect(esperadas).toHaveLength(58);
    expect(rutas(e)).toEqual(esperadas);
    expect(rutas(e)).toEqual([...rutas(e)].sort());
    expect(new Set(rutas(e)).size).toBe(58);
  }, 120000);

  test('una ruta parametrizada registrada antes que una literal se detecta al arrancar', async () => {
    const restantes = propias003().filter(id => id !== 'obtenerSolicitud003');
    await expect(montar({ oferta002: con002(), oferta003: { ...registroOferta003(), modo: 'completa',
      controladores: [controladorSimulado003(['obtenerSolicitud003']), controladorSimulado003(restantes)] } })).rejects.toThrow('Una ruta parametrizada oculta una ruta literal');
  }, 120000);

  test('faltan operaciones: la aplicación completa sin controladores reales no arranca (se completa con las historias, T088)', async () => {
    await expect(crearAplicacionCompleta003(await configuracionDePrueba003(base.url), { prestadores: { almacen: almacenEnMemoria003() }, worker: false }))
      .rejects.toThrow('El router no coincide');
  }, 120000);
});

describe('no regresión de los arranques anteriores', () => {
  test('la composición base, sin extensiones, conserva sus 17 operaciones', async () => {
    const e = await montar({});
    expect(rutas(e)).toEqual(await operaciones('openapi.json'));
    expect(rutas(e)).toHaveLength(17);
  }, 120000);

  test('la composición de la 002 sigue arrancando exactamente 40 operaciones y no incluye ninguna de la 003', async () => {
    const e002 = await crearAplicacionCompleta002(await configuracionDePrueba003(base.url), { prestadores: { almacen: almacenEnMemoria003() }, worker: false });
    abiertas.push(e002);
    expect(rutas(e002)).toEqual([...await operaciones('openapi.json'), ...await operaciones('prestadores-catalogo.openapi.json')].sort());
    expect(rutas(e002)).toHaveLength(40);
    for (const ruta of de003(propias003())) expect(rutas(e002)).not.toContain(ruta);
  }, 120000);
});
