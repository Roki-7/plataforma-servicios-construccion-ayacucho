import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import request from 'supertest';
import { crearAplicacionCompleta002 } from '../../../src/composicion/aplicacion-002.js';
import { CatalogoCache, type AlmacenCache } from '../../../src/modulos/catalogo/infraestructura/cache/catalogo-cache.js';
import { ClienteRedis002 } from '../../../src/modulos/catalogo/infraestructura/cache/cliente-redis.js';
import { RevisionDeOfertaPostgres } from '../../../src/modulos/catalogo/infraestructura/persistencia/revision-de-oferta.js';
import { ConsultasPublicasPostgres } from '../../../src/modulos/catalogo/infraestructura/persistencia/consultas-publicas.js';
import type { ConsultasPublicas } from '../../../src/modulos/catalogo/aplicacion/puertos/consultas-publicas.js';
import { baseAislada002 } from '../../soporte/prestadores-catalogo/postgres.js';
import { almacenDePrueba002 } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';
import { cat, serv } from '../../soporte/prestadores-catalogo/fixtures-hu05.js';
import { montarHu25, type EntornoHu25 } from '../../soporte/prestadores-catalogo/fixtures-hu25.js';
import type { CuentaPrueba } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

/**
 * Redis y la revisión de Catálogo con dos réplicas de la aplicación compuesta y PostgreSQL real.
 * Es opt-in: requiere REDIS_AISLADO_URL (redis://127.0.0.1:63850), el Redis del proyecto Docker propio `ayacucho-redis002-aislado`. La prueba lo detiene y lo
 * inicia: solo actúa sobre ese contenedor y nunca sobre el Redis de validación 002.
 */
const urlRedis = process.env['REDIS_AISLADO_URL'];
const suite = urlRedis ? describe : describe.skip;
const contenedor = 'ayacucho-redis002-aislado-redis-1';
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const cli = (...args: string[]) => docker('exec', contenedor, 'redis-cli', ...args);

class CacheObservada implements AlmacenCache {
  aciertos = 0; escrituras = 0;
  constructor(private readonly real: ClienteRedis002) {}
  async obtener(clave: string) { const v = await this.real.obtener(clave); if (v) this.aciertos++; return v; }
  async guardar(clave: string, valor: string, ttl: number) { await this.real.guardar(clave, valor, ttl); this.escrituras++; }
  cerrar() { this.real.cerrar(); }
}
const esperar = async (condicion: () => boolean | Promise<boolean>, ms = 15000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await condicion()) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('Tiempo de espera agotado.'); };

suite('revisión de Catálogo, Redis y dos réplicas', () => {
  let e: EntornoHu25; let replicaB: Awaited<ReturnType<typeof crearAplicacionCompleta002>>; let httpB: ReturnType<typeof request>;
  let cacheA: CacheObservada; let cacheB: CacheObservada; let op: CuentaPrueba; let almacenB: Awaited<ReturnType<typeof almacenDePrueba002>>;
  const espacio = `ayacucho:002:rev-${randomUUID().slice(0, 8)}`;
  const cliente = (ns = espacio) => new ClienteRedis002({ REDIS_URL: urlRedis, REDIS_NAMESPACE: ns, REDIS_TIMEOUT_MS: '300' });
  const claves = () => cli('--scan', '--pattern', `${espacio}:*`).split('\n').filter(Boolean).sort();
  const consulta = `?categoria=${cat.R2}`;
  const totalA = async (ruta = '/servicios') => (await e.http.get(`/api/v1${ruta}${consulta}`).expect(200)).body.total as number;
  const totalB = async (ruta = '/servicios') => (await httpB.get(`/api/v1${ruta}${consulta}`).expect(200)).body.total as number;
  const categorias = async (http: ReturnType<typeof request>) => ((await http.get('/api/v1/categorias').expect(200)).body.categorias as { categoriaId: string }[]).map(c => c.categoriaId);
  const version = async (id: string) => (await e.filaCategoria(id))['version'] as number;
  const desactivar = async (id: string) => {
    const v = await version(id);
    const p = (await e.previsualizar(op.token, id, { version: v }).expect(201)).body as { confirmacionId: string };
    return (await e.desactivar(op.token, id, { confirmacionId: p.confirmacionId, version: v, motivo: 'Prueba de revisión' }).expect(200)).body as { version: number };
  };

  beforeAll(async () => {
    const u = new URL(urlRedis!);
    if (u.hostname !== '127.0.0.1' || u.port !== '63850') throw new Error('Destino no permitido: no es el Redis aislado de la prueba.');
    expect(cli('ping')).toBe('PONG');
    cacheA = new CacheObservada(cliente()); cacheB = new CacheObservada(cliente());
    e = await montarHu25({ busqueda: { cache: { almacen: cacheA, entorno: 'rev' } }, categorias: { cache: { almacen: cacheA, entorno: 'rev' } } });
    almacenB = await almacenDePrueba002();
    replicaB = await crearAplicacionCompleta002(e.config, { prestadores: { almacen: almacenB.almacen }, worker: false,
      busqueda: { cache: { almacen: cacheB, entorno: 'rev' } }, categorias: { cache: { almacen: cacheB, entorno: 'rev' } } });
    httpB = request(replicaB.app.getHttpServer());
    op = await e.cuenta(); await e.habilitar(op);
  }, 240000);
  afterAll(async () => {
    try { if (docker('inspect', '-f', '{{.State.Running}}', contenedor) !== 'true') docker('start', contenedor); } catch { /* sin acción */ }
    try { await replicaB?.app.close(); await e?.cerrar(); await almacenB?.limpiar(); } finally { cacheA?.cerrar(); cacheB?.cerrar(); }
  }, 60000);

  test('dos réplicas comparten la caché con la misma revisión y el TTL acota la ocupación', async () => {
    expect(await totalA()).toBe(1);
    const aciertos = cacheB.aciertos;
    expect(await totalB()).toBe(1);
    expect(cacheB.aciertos).toBe(aciertos + 1);
    const guardadas = claves();
    expect(guardadas.length).toBeGreaterThan(0);
    for (const k of guardadas) { const ttl = Number(cli('ttl', k)); expect(ttl).toBeGreaterThan(0); expect(ttl).toBeLessThanOrEqual(60); }
    await categorias(e.http); expect(await categorias(httpB)).toContain(cat.H2a);
  }, 60000);

  test('CA-CAT-10: con Redis detenido la desactivación excluye de inmediato en ambas réplicas y las entradas antiguas recuperadas no se sirven', async () => {
    await totalA('/prestadores'); await totalB('/prestadores'); await categorias(e.http);
    const antes = Object.fromEntries(claves().map(k => [k, cli('get', k)]));
    expect(Object.keys(antes).length).toBeGreaterThanOrEqual(3);
    docker('stop', '-t', '1', contenedor);
    try {
      // Redis caído: las lecturas se resuelven en PostgreSQL y la desactivación no depende de Redis.
      expect(await totalA()).toBe(1); expect(await totalB()).toBe(1);
      await desactivar(cat.R2);
      expect([await totalA(), await totalB()]).toEqual([0, 0]);
      expect([await totalA('/prestadores'), await totalB('/prestadores')]).toEqual([0, 0]);
      for (const http of [e.http, httpB]) { const ids = await categorias(http); expect(ids).not.toContain(cat.R2); expect(ids).not.toContain(cat.H2a); }
      await e.servicio(serv.s6).expect(404);
    } finally { docker('start', contenedor); }
    await esperar(() => { try { return cli('ping') === 'PONG'; } catch { return false; } });
    // Un Redis recuperado con entradas antiguas (restauración de una instantánea previa a la desactivación).
    for (const [k, v] of Object.entries(antes)) cli('set', k, v, 'EX', '60');
    expect(claves()).toEqual(Object.keys(antes).sort());
    // Ninguna réplica sirve la entrada antigua: la revisión vigente es distinta y la clave no coincide.
    expect([await totalA(), await totalB()]).toEqual([0, 0]);
    expect([await totalA('/prestadores'), await totalB('/prestadores')]).toEqual([0, 0]);
    for (const http of [e.http, httpB]) expect(await categorias(http)).not.toContain(cat.H2a);
    // La revisión vigente se repuebla con datos correctos y las claves antiguas no se sobrescriben.
    const despues = claves();
    const nuevas = despues.filter(k => !(k in antes));
    expect(nuevas.length).toBeGreaterThanOrEqual(3);
    for (const k of nuevas.filter(n => n.includes(':servicios:') || n.includes(':prestadores:'))) expect(JSON.parse(cli('get', k)).total).toBe(0);
    for (const k of Object.keys(antes)) expect(cli('get', k)).toBe(antes[k]);
  }, 120000);

  test('repoblación tardía: una lectura que empezó antes del cambio no escribe en la caché cuando la revisión ya avanzó', async () => {
    const ns = `${espacio}:tardia`; const almacen = new CacheObservada(cliente(ns));
    const revision = new RevisionDeOfertaPostgres(e.uow); const origen = new ConsultasPublicasPostgres(e.uow);
    let liberar!: () => void; const compuerta = new Promise<void>(r => { liberar = r; }); let empezo!: () => void; const arranco = new Promise<void>(r => { empezo = r; });
    const lenta: ConsultasPublicas = { buscarServicios: async f => { const r = await origen.buscarServicios(f); empezo(); await compuerta; return r; },
      buscarPrestadores: f => origen.buscarPrestadores(f), servicioVisible: id => origen.servicioVisible(id), serviciosVisiblesDe: (p, a, t) => origen.serviciosVisiblesDe(p, a, t) };
    const cache = new CatalogoCache(lenta, revision, almacen, { entorno: 'rev', versionRepresentacion: 'v1', ttlSegundos: 60 });
    const filtros = { categoria: cat.H1b, pagina: 1, tamano: 20 };
    const tarea = cache.buscarServicios(filtros);
    await arranco;
    await desactivar(cat.H1b);
    liberar(); await tarea;
    expect(almacen.escrituras).toBe(0);
    expect(cli('--scan', '--pattern', `${ns}:*`)).toBe('');
    // La lectura siguiente calcula con la revisión nueva y sí se almacena.
    const fresca = await cache.buscarServicios(filtros);
    expect(fresca.total).toBe(0); expect(almacen.escrituras).toBe(1);
    almacen.cerrar();
  }, 90000);

  test('revisión inaccesible: las consultas públicas responden 503 sin servir la caché y se recuperan al volver la revisión', async () => {
    const antes = await totalA();
    await e.db.query('ALTER TABLE catalogo_revision_oferta RENAME TO catalogo_revision_oferta_inaccesible');
    try {
      for (const http of [e.http, httpB]) {
        const r = await http.get(`/api/v1/servicios${consulta}`).expect(503);
        expect(r.body.codigo).toBe('DEPENDENCIA_NO_DISPONIBLE');
        await http.get('/api/v1/categorias').expect(503);
      }
    } finally { await e.db.query('ALTER TABLE catalogo_revision_oferta_inaccesible RENAME TO catalogo_revision_oferta'); }
    expect(await totalA()).toBe(antes); expect(await totalB()).toBe(antes);
  }, 60000);

  test('restaurar una base descartable exige rotar el espacio Redis: con el mismo espacio se servirían entradas de otra línea de tiempo', async () => {
    const pg = 'ayacucho-002-validacion-postgres-1';
    const usuario = docker('exec', pg, 'sh', '-c', 'echo $POSTGRES_USER');
    const origen = new URL(e.config.databaseUrl).pathname.slice(1);
    expect(origen).toMatch(/^ayacucho_002_test_[0-9a-f]{32}$/);
    // Instantánea lógica de la base descartable (equivale a restaurar una copia de seguridad) en otra base descartable.
    const volcado = execFileSync('docker', ['exec', pg, 'pg_dump', '-U', usuario, '--no-owner', origen], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const copia = await baseAislada002(); const nombreCopia = new URL(copia.url).pathname.slice(1);
    expect(nombreCopia).toMatch(/^ayacucho_002_test_[0-9a-f]{32}$/);
    execFileSync('docker', ['exec', '-i', pg, 'psql', '-U', usuario, '-d', nombreCopia, '-v', 'ON_ERROR_STOP=1', '-q'], { input: volcado, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const copiaRevision = async (q: (s: string) => Promise<unknown>) => BigInt(((await q('SELECT revision::text AS r FROM catalogo_revision_oferta')) as { r: string }[])[0]!.r);
    const r0 = await e.revision();
    expect(await copiaRevision(s => e.db.query(s))).toBe(r0);
    // Tras la instantánea, la línea de tiempo original avanza dos revisiones con una categoría que solo existe allí.
    const solaA = (await e.crear(op.token, { nombre: 'Solo en la original', motivo: 'M' }).expect(201)).body as { categoriaId: string };
    await e.activar(op.token, solaA.categoriaId, { version: 1, motivo: 'M' }).expect(200);
    expect(await e.revision()).toBe(r0 + 2n);
    await categorias(e.http);
    // La copia restaurada avanza dos revisiones con datos distintos: llega a la misma revisión con otro contenido.
    const idC = randomUUID(); const clienteCopia: ClienteRedis002[] = []; let replicaC: Awaited<ReturnType<typeof crearAplicacionCompleta002>> | undefined; let replicaD: typeof replicaC;
    try {
      const configCopia = { ...e.config, databaseUrl: copia.url };
      const prepara = await crearAplicacionCompleta002(configCopia, { prestadores: { almacen: almacenB.almacen }, worker: false });
      await prepara.db.query("INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,activa) VALUES($1,'Solo en la copia','solo en la copia',1,true)", [idC]);
      await prepara.db.query('UPDATE catalogo_revision_oferta SET revision = revision + 2');
      await prepara.app.close();
      const mismoEspacio = cliente(); clienteCopia.push(mismoEspacio);
      replicaC = await crearAplicacionCompleta002(configCopia, { prestadores: { almacen: almacenB.almacen }, worker: false,
        categorias: { cache: { almacen: mismoEspacio, entorno: 'rev' } } });
      const sinRotar = ((await request(replicaC.app.getHttpServer()).get('/api/v1/categorias').expect(200)).body.categorias as { nombre: string }[]).map(c => c.nombre);
      // Peligro demostrado: con el mismo espacio y la misma revisión, la copia sirve el listado de la otra línea de tiempo.
      expect(sinRotar).toContain('Solo en la original'); expect(sinRotar).not.toContain('Solo en la copia');
      const rotado = cliente(`${espacio}:restaurada`); clienteCopia.push(rotado);
      replicaD = await crearAplicacionCompleta002(configCopia, { prestadores: { almacen: almacenB.almacen }, worker: false, categorias: { cache: { almacen: rotado, entorno: 'rev' } } });
      const rotando = ((await request(replicaD.app.getHttpServer()).get('/api/v1/categorias').expect(200)).body.categorias as { nombre: string }[]).map(c => c.nombre);
      expect(rotando).toContain('Solo en la copia'); expect(rotando).not.toContain('Solo en la original');
    } finally {
      await replicaC?.app.close(); await replicaD?.app.close(); for (const c of clienteCopia) c.cerrar(); await copia.cerrar();
    }
  }, 120000);
});
