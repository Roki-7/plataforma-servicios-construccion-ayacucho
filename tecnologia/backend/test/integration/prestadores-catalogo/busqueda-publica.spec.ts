import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ClienteRedis002 } from '../../../src/modulos/catalogo/infraestructura/cache/cliente-redis.js';
import { sqlBuscarPrestadores, sqlBuscarServicios } from '../../../src/modulos/catalogo/infraestructura/persistencia/consultas-publicas.js';
import type { AlmacenCache } from '../../../src/modulos/catalogo/infraestructura/cache/catalogo-cache.js';
import { leerConfiguracion002 } from '../../../scripts/entorno-002.js';
import { cat, montarHu05, prest, serv, type EntornoHu05 } from '../../soporte/prestadores-catalogo/fixtures-hu05.js';
import { servicioValido as _no } from '../../soporte/prestadores-catalogo/fixtures-hu04.js';

void _no;
/** Caché real de Redis con contadores y fallos inyectables. */
class CacheObservada implements AlmacenCache {
  lecturas: string[] = []; aciertos = 0; escrituras = 0; modo: 'normal' | 'caido' | 'basura' = 'normal';
  constructor(private readonly real: ClienteRedis002) {}
  async obtener(clave: string) {
    this.lecturas.push(clave);
    if (this.modo === 'caido') throw new Error('Redis no disponible');
    if (this.modo === 'basura') return '{"elementos": "no es una página"';
    const valor = await this.real.obtener(clave);
    if (valor) this.aciertos++;
    return valor;
  }
  async guardar(clave: string, valor: string, ttl: number) { if (this.modo === 'caido') throw new Error('Redis no disponible'); this.escrituras++; await this.real.guardar(clave, valor, ttl); }
  cerrar() { this.real.cerrar(); }
}

let e: EntornoHu05;
let cache: CacheObservada;
let baseline: EntornoHu05 | undefined;
beforeAll(async () => {
  const env = await leerConfiguracion002();
  cache = new CacheObservada(new ClienteRedis002({ REDIS_URL: env['REDIS_URL'], REDIS_NAMESPACE: `ayacucho:002:prueba-${randomUUID().slice(0, 8)}`, REDIS_TIMEOUT_MS: '300' }));
  e = await montarHu05({ cache: { almacen: cache, entorno: 'validacion' } });
}, 180000);
afterAll(async () => { try { await e?.cerrar(); await baseline?.cerrar(); } finally { cache?.cerrar(); } });

const ids = (r: { body: { elementos: Record<string, string>[] } }, campo = 'servicioId') => r.body.elementos.map(x => x[campo]!);
const titular = () => e.datos.titular.token;
/** Equivale a una mutación de Catálogo: cambia el dato y avanza la revisión pública en el mismo paso, como hacen las operaciones de negocio. */
const avanzarRevision = () => e.db.query('UPDATE catalogo_revision_oferta SET revision = revision + 1');
const activarClasificacion = async (id: string, activa: boolean) => { await e.db.query('UPDATE catalogo_clasificaciones SET activa=$2 WHERE id=$1', [id, activa]); await avanzarRevision(); };

describe('filtros combinados, jerarquía, proyección y privacidad con PostgreSQL real', () => {
  test('el orden es estable entre consultas y páginas, y el total pertenece a la misma instantánea que la página', async () => {
    const a = await e.servicios('?tamano=50').expect(200); const b = await e.servicios('?tamano=50').expect(200);
    expect(ids(a)).toEqual(ids(b));
    expect(ids(a)).toEqual([...ids(a)].sort());
    const porNombre = await e.prestadores('?tamano=50').expect(200);
    expect(porNombre.body.elementos.map((x: { nombrePublico: string }) => x.nombrePublico)).toEqual([...porNombre.body.elementos.map((x: { nombrePublico: string }) => x.nombrePublico)].sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase())));
    // Con mutaciones concurrentes, cada respuesta es internamente coherente: total y elementos (tamaño 50) provienen de una sola lectura.
    const tareas: Promise<{ body: { total: number; elementos: unknown[] } }>[] = [];
    for (let i = 0; i < 12; i++) {
      tareas.push(e.servicios(`?tamano=50&categoria=${cat.H1b}`) as never);
      if (i % 3 === 0) void e.publicar(titular(), { titulo: `Concurrente ${i}`, descripcion: 'D', categoriaId: cat.H1b });
    }
    for (const r of await Promise.all(tareas)) expect(r.body.elementos).toHaveLength(Math.min(50, r.body.total));
  }, 60000);

  test('los resultados reflejan de inmediato publicar, pausar, retirar y reactivar, aun con el UUID conocido (CA-SER-08)', async () => {
    const nuevo = (await e.publicar(titular(), { titulo: 'Servicio de ciclo', descripcion: 'D', categoriaId: cat.H2a }).expect(201)).body as { servicioId: string; version: number };
    const enBusqueda = async () => ids(await e.servicios(`?categoria=${cat.H2a}&tamano=50`)).includes(nuevo.servicioId);
    const enPerfil = async () => ids({ body: (await e.perfilPublico(prest.A, '?tamano=50')).body.servicios }).includes(nuevo.servicioId);
    expect([await enBusqueda(), await enPerfil(), (await e.servicio(nuevo.servicioId)).status]).toEqual([true, true, 200]);
    await e.transicionar(titular(), nuevo.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    expect([await enBusqueda(), await enPerfil(), (await e.servicio(nuevo.servicioId)).status]).toEqual([false, false, 404]);
    await e.transicionar(titular(), nuevo.servicioId, { version: 2, destino: 'PUBLICADO' }).expect(200);
    expect([await enBusqueda(), await enPerfil(), (await e.servicio(nuevo.servicioId)).status]).toEqual([true, true, 200]);
    await e.transicionar(titular(), nuevo.servicioId, { version: 3, destino: 'RETIRADO' }).expect(200);
    expect([await enBusqueda(), await enPerfil(), (await e.servicio(nuevo.servicioId)).status]).toEqual([false, false, 404]);
    expect((await e.prestadores(`?categoria=${cat.H2a}`)).body.elementos.map((x: { prestadorId: string }) => x.prestadorId)).toEqual([prest.C]);
  }, 60000);

  test('una clasificación inactiva por estado propio o por su padre excluye el servicio y se recupera al reactivarla', async () => {
    const visibleS1 = async () => ids(await e.servicios(`?categoria=${cat.H1a}`)).includes(serv.s1);
    expect(await visibleS1()).toBe(true);
    await activarClasificacion(cat.R1, false);
    try {
      expect(await visibleS1()).toBe(false);
      expect((await e.servicio(serv.s1)).status).toBe(404);
      expect((await e.servicios(`?categoria=${cat.R1}`)).body.total).toBe(0);
      expect((await e.prestadores(`?categoria=${cat.R1}`)).body.total).toBe(0);
    } finally { await activarClasificacion(cat.R1, true); }
    await activarClasificacion(cat.H1a, false);
    try { expect(await visibleS1()).toBe(false); } finally { await activarClasificacion(cat.H1a, true); }
    expect(await visibleS1()).toBe(true);
  });

  test('un perfil que deja de ser publicable desaparece de búsquedas, perfil y servicios, y vuelve al reactivarse', async () => {
    const fila = (publicable: boolean) => Promise.all([
      e.db.query('UPDATE prestadores_perfiles SET publicable=$2 WHERE id=$1', [prest.C, publicable]),
      e.db.query('UPDATE catalogo_proyeccion_prestadores SET publicable=$2 WHERE prestador_id=$1', [prest.C, publicable]),
    ]).then(avanzarRevision);
    await fila(false);
    try {
      expect(ids(await e.servicios(`?categoria=${cat.H2a}`))).toEqual([]);
      expect((await e.prestadores('?tamano=50')).body.elementos.map((x: { prestadorId: string }) => x.prestadorId)).not.toContain(prest.C);
      expect((await e.perfilPublico(prest.C)).status).toBe(404);
      expect((await e.servicio(serv.s6)).status).toBe(404);
    } finally { await fila(true); }
    expect((await e.perfilPublico(prest.C)).status).toBe(200);
  });

  test('las consultas usan parámetros enlazados: valores con SQL no se interpretan', async () => {
    for (const q of [`?distrito=${encodeURIComponent("ayacucho' OR '1'='1")}`, `?categoria=${encodeURIComponent("' OR 1=1 --")}`, `?especialidad=${encodeURIComponent('1; DROP TABLE catalogo_servicios')}`]) await e.servicios(q).expect(400);
    expect((await e.servicios('?tamano=50')).body.total).toBeGreaterThan(0);
  });

  test('los índices de búsqueda se usan y el plan queda documentado', async () => {
    const q = e.db.createQueryRunner();
    await q.connect(); await q.startTransaction();
    try {
      await q.query('SET LOCAL enable_seqscan = off');
      const plan = async (sql: string, params: unknown[]) => ((await q.query(`EXPLAIN (COSTS OFF) ${sql}`, params)) as Record<string, string>[]).map(f => f['QUERY PLAN']).join('\n');
      const servicios = await plan(sqlBuscarServicios, [cat.H1b, cat.H1b, 'ayacucho', true, 20, 0]);
      const prestadores = await plan(sqlBuscarPrestadores, [null, cat.H1a, 'ayacucho', true, 20, 0]);
      console.log('PLAN servicios\n' + servicios + '\nPLAN prestadores\n' + prestadores);
      expect(servicios).toMatch(/Index|Bitmap/);
      expect(prestadores).toMatch(/Index|Bitmap/);
      expect(servicios + prestadores).toMatch(/catalogo_servicios_publicados|catalogo_proyeccion_(especialidades|distritos|disponibilidad|orden)|catalogo_servicios_pkey/);
    } finally { await q.rollbackTransaction(); await q.release(); }
  });
});

describe('caché de lectura con respaldo en PostgreSQL (CA-BUS-06)', () => {
  const consulta = '?categoria=' + cat.H1b + '&distrito=ayacucho&pagina=2&tamano=10';
  test('una consulta repetida se sirve de Redis y la revisión nueva la invalida de inmediato', async () => {
    const antes = { aciertos: cache.aciertos, escrituras: cache.escrituras };
    const primera = await e.servicios(consulta).expect(200);
    expect(cache.escrituras).toBe(antes.escrituras + 1);
    const segunda = await e.servicios(consulta).expect(200);
    expect(cache.aciertos).toBe(antes.aciertos + 1);
    expect(segunda.body).toEqual(primera.body);
    // Cambia un dato sin avanzar la revisión: se sigue sirviendo la entrada de la revisión vigente (prueba de que viene de Redis).
    await e.db.query("UPDATE catalogo_servicios SET titulo='Título cambiado por SQL' WHERE id=$1", [serv.s4]);
    const sinRevision = await e.servicios(`?categoria=${cat.H1b}&distrito=ayacucho&pagina=1&tamano=50`).expect(200);
    const cacheado = await e.servicios(`?categoria=${cat.H1b}&distrito=ayacucho&pagina=1&tamano=50`).expect(200);
    expect(cacheado.body).toEqual(sinRevision.body);
    // Una mutación de negocio avanza la revisión: la lectura siguiente refleja el cambio sin esperar al TTL.
    const r0 = await e.revision();
    const s = (await e.publicar(titular(), { titulo: 'Después de la revisión', descripcion: 'D', categoriaId: cat.H1b }).expect(201)).body.servicioId as string;
    expect(await e.revision()).toBe(r0 + 1n);
    const fresca = await e.servicios(`?categoria=${cat.H1b}&distrito=ayacucho&pagina=1&tamano=50`).expect(200);
    expect(ids(fresca)).toContain(s);
    expect(fresca.body.elementos.find((x: { servicioId: string }) => x.servicioId === serv.s4).titulo).toBe('Título cambiado por SQL');
    expect(fresca.body.total).toBe(sinRevision.body.total + 1);
  }, 60000);

  test('con Redis vacío, caído o con datos inválidos las respuestas son las de PostgreSQL, con sus filtros y paginación', async () => {
    const esperado = (await e.servicios(consulta).expect(200)).body;
    const esperadoPrestadores = (await e.prestadores(`?categoria=${cat.R1}&tamano=2&pagina=2`).expect(200)).body;
    for (const modo of ['caido', 'basura'] as const) {
      cache.modo = modo;
      try {
        expect((await e.servicios(consulta).expect(200)).body).toEqual(esperado);
        expect((await e.prestadores(`?categoria=${cat.R1}&tamano=2&pagina=2`).expect(200)).body).toEqual(esperadoPrestadores);
        expect((await e.servicios(`?especialidad=${randomUUID()}`).expect(200)).body.total).toBe(0);
        await e.servicios('?calificacion=5').expect(400);
      } finally { cache.modo = 'normal'; }
    }
    // Redis vacío: un espacio de claves nuevo equivale a una caché recién creada.
    const env = await leerConfiguracion002();
    const vacio = new CacheObservada(new ClienteRedis002({ REDIS_URL: env['REDIS_URL'], REDIS_NAMESPACE: `ayacucho:002:vacio-${randomUUID().slice(0, 8)}`, REDIS_TIMEOUT_MS: '300' }));
    baseline = await montarHu05({ cache: { almacen: vacio, entorno: 'validacion' } });
    try {
      const r = await baseline.servicios('?tamano=50&categoria=' + cat.R1).expect(200);
      expect(vacio.aciertos).toBe(0);
      expect(r.body.total).toBe(28);
      await baseline.servicios('?tamano=50&categoria=' + cat.R1).expect(200);
      expect(vacio.aciertos).toBe(1);
    } finally { vacio.cerrar(); }
  }, 180000);

  test('un Redis inalcanzable no afecta a las escrituras ni a los detalles, que no pasan por la caché', async () => {
    cache.modo = 'caido';
    try {
      const r0 = await e.revision();
      await e.publicar(titular(), { titulo: 'Con Redis caído', descripcion: 'D', categoriaId: cat.H1a }).expect(201);
      expect(await e.revision()).toBe(r0 + 1n);
      expect((await e.servicio(serv.s1)).status).toBe(200);
      expect((await e.perfilPublico(prest.A)).status).toBe(200);
    } finally { cache.modo = 'normal'; }
  }, 60000);
});
