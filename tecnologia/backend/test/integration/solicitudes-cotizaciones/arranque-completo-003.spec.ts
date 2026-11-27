import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { crearAplicacion } from '../../../src/composicion/app.module.js';
import { crearAplicacionCompleta002 } from '../../../src/composicion/aplicacion-002.js';
import { crearAplicacionCompleta003, crearAplicacionConHistorias003 } from '../../../src/composicion/aplicacion-003.js';
import { inventarioOpenApi, type DocumentoOpenApi } from '../../../src/composicion/componer-openapi.js';
import { aplicarMigraciones003 } from '../../../src/composicion/migraciones-003.js';
import { registroOferta002 } from '../../../src/composicion/oferta-002.js';
import { registroOferta003 } from '../../../src/composicion/oferta-003.js';
import { SolicitudesS3 } from '../../../src/modulos/solicitudes/infraestructura/archivos/solicitudes-s3.js';
import { almacenamientoAislado003 } from '../../soporte/solicitudes-cotizaciones/almacenamiento.js';
import { iniciarSesion003, sembrarDatos003 } from '../../soporte/solicitudes-cotizaciones/datos.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';
import { almacenEnMemoria003, configuracionDePrueba003, controladorSimulado003, operaciones003 } from '../../soporte/solicitudes-cotizaciones/entorno.js';

/**
 * CP-308 sobre la aplicación real (T011 y T088). Arranca Nest con la composición de la 001, la 002 y la 003 sobre bases descartables `ayacucho_003_test_*`.
 * Los bloques de los modos `prueba` y `completa` usan controladores simulados (solo registran las rutas del contrato) para ensayar los casos NEGATIVOS de la tabla de
 * rutas de `configurarApi` y de `verificarRouter`. El último bloque de arranque (T088) usa el ensamblador REAL, `crearAplicacionCompleta003`, con los controladores y el
 * almacén de Garage reales y sin subconjuntos ni dobles.
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

  test('sin las opciones de las historias no hay controladores de la 003 y la aplicación completa no arranca: el router no coincide con las 58', async () => {
    await expect(crearAplicacionCompleta003(await configuracionDePrueba003(base.url), { prestadores: { almacen: almacenEnMemoria003() }, worker: false }))
      .rejects.toThrow('El router no coincide');
  }, 120000);
});

describe('T088 · ensamblador y arranque REAL: crearAplicacionCompleta003 con las 58 operaciones (CP-308, R-27)', () => {
  const protegida = (o: Record<string, unknown>) => ((o['security'] as Record<string, unknown>[] | undefined) ?? []).some(x => Object.hasOwn(x, 'bearerAuth'));
  let garage: Awaited<ReturnType<typeof almacenamientoAislado003>>;
  let real: Aplicacion;
  let datos: Awaited<ReturnType<typeof sembrarDatos003>>;
  let origen: string;
  let http: ReturnType<typeof request>;
  const contratos = async () => {
    const leer = async (archivo: string) => JSON.parse(await readFile(resolve('contracts', archivo), 'utf8')) as DocumentoOpenApi;
    return { c001: await leer('openapi.json'), c002: await leer('prestadores-catalogo.openapi.json'), c003: await leer('solicitudes-cotizaciones.openapi.json') };
  };
  const identificada = (metodo: string, ruta: string) => `${metodo.toUpperCase()} ${ruta.replace(/\{[^}]+\}/g, '{}')}`;

  beforeAll(async () => {
    garage = await almacenamientoAislado003();
    const config = await configuracionDePrueba003(base.url);
    origen = config.origen;
    // Sin controladores simulados ni subconjuntos: el ensamblador definitivo con el almacén real de Garage.
    real = await crearAplicacionCompleta003(config, { prestadores: { almacen: almacenEnMemoria003() }, solicitudes: { almacen: new SolicitudesS3(garage.cliente, garage.bucket, garage.prefijo) }, worker: false });
    abiertas.push(real);
    datos = await sembrarDatos003(real, origen);
    http = request(real.app.getHttpServer());
  }, 240000);
  afterAll(async () => { await garage?.cerrar(); });

  test('el inventario de contratoDeOferta es 17 + 23 + 18 = 58 y el espejo de la 003 es idéntico a la fuente aprobada', async () => {
    const { c001, c002, c003 } = await contratos();
    expect([inventarioOpenApi(c001).length, inventarioOpenApi(c002).length, inventarioOpenApi(c003).length]).toEqual([17, 23, 18]);
    expect(Buffer.compare(await readFile(resolve('contracts/solicitudes-cotizaciones.openapi.json')), await readFile(resolve('../../specs/003-solicitudes-y-cotizaciones/contracts/openapi.json')))).toBe(0);
    // La aplicación completa solo arranca si `contratoDeOferta` valida esos inventarios: llegar aquí lo demuestra; se comprueba además el total registrado.
    expect(rutas(real)).toHaveLength(58);
  });

  test('el router de Nest coincide exactamente con la unión de las 58 operaciones, sin rutas de más ni de menos', async () => {
    const { c001, c002, c003 } = await contratos();
    const esperadas = [c001, c002, c003].flatMap(c => inventarioOpenApi(c).map(({ metodo, ruta }) => `${metodo.toUpperCase()} ${ruta}`)).sort();
    expect(rutas(real)).toEqual(esperadas);
    expect(new Set(rutas(real)).size).toBe(58);
    expect(rutas(real).filter(r => r.includes('/solicitudes') || r.includes('/cotizaciones'))).toHaveLength(18);
  });

  test('no hay colisiones: ni operationId repetidos, ni método y ruta repetidos, ni rutas equivalentes que solo difieran en el nombre del parámetro', async () => {
    const { c001, c002, c003 } = await contratos();
    const todas = [c001, c002, c003].flatMap(c => inventarioOpenApi(c));
    expect(todas).toHaveLength(58);
    const repetidos = (valores: string[]) => valores.filter((v, i) => valores.indexOf(v) !== i);
    expect(repetidos(todas.map(o => o.operacion.operationId))).toEqual([]);
    expect(repetidos(todas.map(o => `${o.metodo.toUpperCase()} ${o.ruta}`))).toEqual([]);
    expect(repetidos(todas.map(o => identificada(o.metodo, o.ruta)))).toEqual([]);
    // Una ruta con parámetro no oculta a una literal del mismo método: en el ORDEN REAL de registro de Express la literal va antes (`verificarRouter` lo impide al arrancar).
    const orden = ((real.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router.stack
      .flatMap(({ route }) => route ? Object.keys(route.methods).map(m => `${m.toUpperCase()} ${route.path.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')}`) : []));
    let ocultables = 0;
    for (const a of todas) for (const bb of todas) {
      if (a === bb || a.metodo !== bb.metodo) continue;
      const pa = a.ruta.split('/'); const pb = bb.ruta.split('/');
      if (pa.length === pb.length && pa.some((p, k) => p.startsWith('{') && !pb[k]!.startsWith('{')) && pa.every((p, k) => p.startsWith('{') || p === pb[k])) {
        ocultables += 1;
        expect(orden.indexOf(`${bb.metodo.toUpperCase()} ${bb.ruta}`)).toBeLessThan(orden.indexOf(`${a.metodo.toUpperCase()} ${a.ruta}`));
      }
    }
    expect(ocultables).toBeGreaterThan(0); // p. ej. `solicitudes/oportunidades` frente a `solicitudes/{solicitudId}`: el caso que importa existe y está bien ordenado.
  });

  test('la tabla de rutas de configurarApi cubre las 58: ninguna operación protegida responde 404 y todas exigen Bearer antes de tocar datos', async () => {
    const { c001, c002, c003 } = await contratos();
    const idsDe = (n: number) => `123e4567-e89b-42d3-a456-${String(n).padStart(12, '0')}`;
    const c003Ids = new Set(inventarioOpenApi(c003).map(o => o.operacion.operationId));
    let protegidas = 0; let publicas = 0; let exactas401 = 0; let lecturas003 = 0;
    for (const doc of [c001, c002, c003]) for (const { metodo, ruta, operacion } of inventarioOpenApi(doc)) {
      let i = 0; const url = '/api/v1' + ruta.replace(/\{[^}]+\}/g, () => idsDe(++i));
      const pedido = (http as unknown as Record<string, (u: string) => request.Test>)[metodo]!(url).set('Origin', origen).set('Idempotency-Key', randomUUID().repeat(2));
      const r = await (['get', 'delete'].includes(metodo) ? pedido : pedido.send({}));
      if (protegida(operacion)) {
        protegidas += 1;
        // Sin credenciales: nunca 404 (ruta ausente de la tabla), 403, 2xx ni 5xx. La validación del contrato precede a la identidad en el middleware (también en la 001):
        // un cuerpo vacío, una cabecera o una consulta obligatoria ausentes dan 400; el resto, 401.
        expect([operacion.operationId, [400, 401].includes(r.status)]).toEqual([operacion.operationId, true]);
        if (r.status === 401) exactas401 += 1;
        // Las lecturas de la 003 sin entradas obligatorias deben dar exactamente 401; el historial exige `tipo`, que se indica.
        if (metodo === 'get' && c003Ids.has(operacion.operationId)) {
          const conConsulta = operacion.operationId === 'consultarHistorialSolicitud003' ? await (http as unknown as Record<string, (u: string) => request.Test>)['get']!(`${url}?tipo=versiones`) : r;
          expect([operacion.operationId, conConsulta.status]).toEqual([operacion.operationId, 401]);
          lecturas003 += 1;
        }
      }
      else { publicas += 1; expect([operacion.operationId, r.status < 500]).toEqual([operacion.operationId, true]); }
    }
    expect(protegidas + publicas).toBe(58);
    expect(protegidas).toBeGreaterThanOrEqual(18);
    expect(lecturas003).toBe(9); // las 9 lecturas (GET) de las 18 operaciones de la 003
    expect(exactas401).toBeGreaterThanOrEqual(lecturas003);
  }, 180000);

  test('las 18 operaciones de la 003 están atendidas por controladores REALES: crear y listar una solicitud, y leer cotizaciones con cuentas ficticias', async () => {
    const ia = async (c: Parameters<typeof iniciarSesion003>[2]) => iniciarSesion003(real, origen, c);
    const cliente = await ia(datos.clientes.clienteUno); const prestador = await ia(datos.prestadores.beto);
    const autenticada = (t: request.Test, tk: string) => t.set('Authorization', `Bearer ${tk}`).set('Origin', origen).set('Idempotency-Key', randomUUID());
    const creada = await autenticada(http.post('/api/v1/solicitudes'), cliente).send({ tipo: 'PUBLICADA' }).expect(201);
    expect(creada.body).toMatchObject({ estado: 'BORRADOR', tipo: 'PUBLICADA', version: 1, versionTrabajo: 0 });
    expect((await autenticada(http.get('/api/v1/solicitudes'), cliente).expect(200)).body).toMatchObject({ total: 1, pagina: 1, tamano: 20 });
    expect((await autenticada(http.get('/api/v1/solicitudes/oportunidades'), prestador).expect(200)).body).toMatchObject({ pagina: 1 });
    expect((await autenticada(http.get('/api/v1/cotizaciones'), prestador).expect(200)).body).toEqual({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    expect((await autenticada(http.get(`/api/v1/solicitudes/${creada.body.solicitudId}/cotizaciones`), cliente).expect(200)).body).toEqual({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    // Un controlador simulado respondería `{}`: los reales validan y devuelven los errores del contrato.
    expect((await autenticada(http.post('/api/v1/solicitudes'), cliente).send({ tipo: 'OTRA' }).expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
    expect((await autenticada(http.get('/api/v1/cotizaciones/00000000-0000-4000-8000-000000000999'), prestador).expect(404)).body.codigo).toBe('RECURSO_NO_DISPONIBLE');
  }, 180000);

  test('la composición con historias y la completa exponen el mismo conjunto de rutas de la 003 y el mismo inventario de operaciones', async () => {
    const config = await configuracionDePrueba003(base.url);
    const parcial = await crearAplicacionConHistorias003(config, { prestadores: { almacen: almacenEnMemoria003() }, solicitudes: { almacen: new SolicitudesS3(garage.cliente, garage.bucket, garage.prefijo) }, worker: false });
    abiertas.push(parcial);
    expect(rutas(parcial)).toEqual(rutas(real));
  }, 180000);
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
