import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ClienteRedis002 } from '../../../src/modulos/catalogo/infraestructura/cache/cliente-redis.js';
import type { AlmacenCache } from '../../../src/modulos/catalogo/infraestructura/cache/catalogo-cache.js';
import { leerConfiguracion002 } from '../../../scripts/entorno-002.js';
import { cat, prest, serv } from '../../soporte/prestadores-catalogo/fixtures-hu05.js';
import { montarHu25, type EntornoHu25 } from '../../soporte/prestadores-catalogo/fixtures-hu25.js';
import type { CuentaPrueba } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

/** Redis real con contadores de aciertos y escrituras para demostrar que las claves están calientes. */
class CacheObservada implements AlmacenCache {
  aciertos = 0; escrituras = 0;
  constructor(private readonly real: ClienteRedis002) {}
  async obtener(clave: string) { const v = await this.real.obtener(clave); if (v) this.aciertos++; return v; }
  async guardar(clave: string, valor: string, ttl: number) { this.escrituras++; await this.real.guardar(clave, valor, ttl); }
  cerrar() { this.real.cerrar(); }
}

let e: EntornoHu25; let cache: CacheObservada; let op: CuentaPrueba;
beforeAll(async () => {
  const env = await leerConfiguracion002();
  cache = new CacheObservada(new ClienteRedis002({ REDIS_URL: env['REDIS_URL'], REDIS_NAMESPACE: `ayacucho:002:categorias-${randomUUID().slice(0, 8)}`, REDIS_TIMEOUT_MS: '300' }));
  const opcionesCache = { almacen: cache, entorno: 'validacion' };
  e = await montarHu25({ busqueda: { cache: opcionesCache }, categorias: { cache: opcionesCache } });
  op = await e.cuenta(); await e.habilitar(op);
}, 180000);
afterAll(async () => { try { await e?.cerrar(); } finally { cache?.cerrar(); } });

const ids = (r: { body: { elementos: Record<string, string>[] } }, campo = 'servicioId') => r.body.elementos.map(x => x[campo]!);
const categoriasPublicas = async () => ((await e.publicas().expect(200)).body.categorias as { categoriaId: string }[]).map(c => c.categoriaId);
const desactivar = async (id: string, version: number) => {
  const p = (await e.previsualizar(op.token, id, { version }).expect(201)).body as { confirmacionId: string; afectados: number };
  const d = await e.desactivar(op.token, id, { confirmacionId: p.confirmacionId, version, motivo: 'Prueba de visibilidad' }).expect(200);
  return { afectados: p.afectados, version: (d.body as { version: number }).version };
};
/** Calienta las tres lecturas públicas y comprueba que la segunda lectura sale de Redis. */
const calentar = async (consulta: string) => {
  await e.servicios(consulta).expect(200); await e.prestadores(consulta).expect(200); await e.publicas().expect(200);
  const antes = cache.aciertos;
  await e.servicios(consulta).expect(200); await e.prestadores(consulta).expect(200); await e.publicas().expect(200);
  expect(cache.aciertos - antes).toBe(3);
};

describe('desactivación y reactivación con búsquedas calentadas (CA-CAT-02, CA-CAT-04, CA-CAT-07 a CA-CAT-10)', () => {
  test('desactivar una subcategoría excluye de inmediato su oferta aunque la caché esté caliente, y reactivar la restituye', async () => {
    const consulta = `?categoria=${cat.H2a}`;
    await calentar(consulta);
    expect(ids(await e.servicios(consulta))).toEqual([serv.s6]);
    expect(await categoriasPublicas()).toContain(cat.H2a);

    const { afectados, version } = await desactivar(cat.H2a, 1);
    expect(afectados).toBe(1);
    // Primera lectura tras el cambio: la revisión distinta impide servir la copia caliente anterior.
    expect((await e.servicios(consulta).expect(200)).body).toMatchObject({ total: 0, elementos: [] });
    expect((await e.prestadores(consulta).expect(200)).body.total).toBe(0);
    expect(await categoriasPublicas()).not.toContain(cat.H2a);
    await e.servicio(serv.s6).expect(404);
    await e.perfilPublico(prest.C).expect(200).then(r => expect(r.body.servicios.elementos).toHaveLength(0));

    // Conservación histórica: el servicio no cambia de estado ni de versión y su referencia sigue disponible.
    expect(((await e.db.query('SELECT estado,version FROM catalogo_servicios WHERE id=$1', [serv.s6])) as { estado: string; version: number }[])[0]).toEqual({ estado: 'PUBLICADO', version: 1 });
    expect((await e.db.query('SELECT titulo FROM catalogo_servicios WHERE id=$1', [serv.s6])).length).toBe(1);

    await calentar(consulta);
    expect((await e.servicios(consulta)).body.total).toBe(0);
    await e.activar(op.token, cat.H2a, { version, motivo: 'Se reactiva' }).expect(200);
    expect(ids(await e.servicios(consulta).expect(200))).toEqual([serv.s6]);
    expect((await e.prestadores(consulta).expect(200)).body.total).toBe(1);
    expect(await categoriasPublicas()).toContain(cat.H2a);
    await e.servicio(serv.s6).expect(200);
  }, 60000);

  test('desactivar la raíz oculta a las hijas con estado propio activo y reactivarla restituye solo servicios PUBLICADO', async () => {
    const consulta = `?categoria=${cat.R1}&tamano=50`;
    await calentar(consulta);
    const visiblesAntes = (await e.servicios(consulta).expect(200)).body.total as number;
    expect(visiblesAntes).toBeGreaterThan(25);

    const { afectados, version } = await desactivar(cat.R1, 1);
    expect(afectados).toBeGreaterThanOrEqual(visiblesAntes);
    expect((await e.servicios(consulta).expect(200)).body.total).toBe(0);
    expect((await e.servicios(`?categoria=${cat.H1b}`).expect(200)).body.total).toBe(0);
    const ocultas = await categoriasPublicas();
    for (const id of [cat.R1, cat.H1a, cat.H1b]) expect(ocultas).not.toContain(id);
    const admin = (await e.listar(op.token).expect(200)).body.categorias as { categoriaId: string; activaPropia: boolean; activaEfectiva: boolean }[];
    expect(admin.find(c => c.categoriaId === cat.H1a)).toMatchObject({ activaPropia: true, activaEfectiva: false });

    // Un servicio PAUSADO sigue pausado: reactivar la clasificación no lo publica.
    await e.activar(op.token, cat.R1, { version, motivo: 'Se reactiva' }).expect(200);
    expect((await e.servicios(consulta).expect(200)).body.total).toBe(visiblesAntes);
    expect(ids(await e.servicios(consulta))).not.toContain(serv.s2);
    expect(((await e.db.query('SELECT estado FROM catalogo_servicios WHERE id=$1', [serv.s2])) as { estado: string }[])[0]!.estado).toBe('PAUSADO');
    expect(((await e.db.query('SELECT estado FROM catalogo_servicios WHERE id=$1', [serv.s5])) as { estado: string }[])[0]!.estado).toBe('RETIRADO');
  }, 90000);

  test('mientras la categoría está inactiva no se admiten nuevas publicaciones en ella', async () => {
    const titular = e.datos.titular.token;
    const { version } = await desactivar(cat.H1b, ((await e.filaCategoria(cat.H1b))['version'] as number));
    await e.publicar(titular, { titulo: 'Nuevo en inactiva', descripcion: 'D', categoriaId: cat.H1b }).expect(422);
    await e.activar(op.token, cat.H1b, { version, motivo: 'Fin de la prueba' }).expect(200);
    await e.publicar(titular, { titulo: 'Nuevo en activa', descripcion: 'D', categoriaId: cat.H1b }).expect(201);
  }, 60000);

  test('una nueva categoría activada aparece en la consulta pública y una inactiva no', async () => {
    const c = (await e.crear(op.token, { nombre: 'Gasfitería', motivo: 'Alta' }).expect(201)).body as { categoriaId: string };
    await e.publicas().expect(200);
    expect(await categoriasPublicas()).not.toContain(c.categoriaId);
    await e.activar(op.token, c.categoriaId, { version: 1, motivo: 'M' }).expect(200);
    expect(await categoriasPublicas()).toContain(c.categoriaId);
    expect(cache.escrituras).toBeGreaterThan(0);
  });
});

describe('referencias históricas y estados propios (CA-CAT-02, 04, 07, 08)', () => {
  const version = async (id: string) => (await e.filaCategoria(id))['version'] as number;
  const referencias = async (servicioId: string) => ((await e.db.query('SELECT tipo FROM referencias_prueba_002 WHERE servicio_id=$1 ORDER BY tipo', [servicioId])) as { tipo: string }[]).map(r => r.tipo);
  const estado = async (id: string) => ((await e.db.query('SELECT estado,version FROM catalogo_servicios WHERE id=$1', [id])) as { estado: string; version: number }[])[0]!;

  test('sin confirmación no cambia nada y, al confirmar, se conservan servicio, estado y referencias de solicitudes, cotizaciones y contrataciones', async () => {
    await e.db.query(`CREATE TABLE IF NOT EXISTS referencias_prueba_002 (id uuid PRIMARY KEY, servicio_id uuid NOT NULL REFERENCES catalogo_servicios(id) ON DELETE RESTRICT,
      tipo text NOT NULL CHECK (tipo IN ('SOLICITUD','COTIZACION','CONTRATACION')))`);
    for (const tipo of ['SOLICITUD', 'COTIZACION', 'CONTRATACION']) await e.db.query('INSERT INTO referencias_prueba_002(id,servicio_id,tipo) VALUES($1,$2,$3)', [randomUUID(), serv.s6, tipo]);
    const esperadas = ['CONTRATACION', 'COTIZACION', 'SOLICITUD'];
    const antes = await estado(serv.s6);
    // CA-CAT-07: la vista previa y la solicitud sin confirmar no modifican clasificación, servicio ni referencias.
    const v = await version(cat.H2a);
    const p = (await e.previsualizar(op.token, cat.H2a, { version: v }).expect(201)).body as { afectados: number };
    expect(p.afectados).toBe(1);
    await e.desactivar(op.token, cat.H2a, { version: v, motivo: 'Sin confirmar' }).expect(400);
    expect(await e.filaCategoria(cat.H2a)).toMatchObject({ activa: true, version: v });
    expect(await estado(serv.s6)).toEqual(antes); expect(await referencias(serv.s6)).toEqual(esperadas);
    // CA-CAT-02: al confirmar, el servicio conserva estado PUBLICADO, registro y referencias, pero sale de la oferta, del detalle y del perfil.
    const d = await e.desactivar(op.token, cat.H2a, { confirmacionId: (await e.previsualizar(op.token, cat.H2a, { version: v }).expect(201)).body.confirmacionId, version: v, motivo: 'Confirmada' }).expect(200);
    expect(await estado(serv.s6)).toEqual(antes); expect(antes.estado).toBe('PUBLICADO');
    expect(await referencias(serv.s6)).toEqual(esperadas);
    await e.servicio(serv.s6).expect(404);
    expect((await e.perfilPublico(prest.C).expect(200)).body.servicios.elementos).toHaveLength(0);
    await e.activar(op.token, cat.H2a, { version: d.body.version, motivo: 'Restituir' }).expect(200);
    expect(await referencias(serv.s6)).toEqual(esperadas);
    await e.servicio(serv.s6).expect(200);
  }, 60000);

  test('no se puede reactivar un servicio PAUSADO ni publicar con información anterior de una categoría desactivada (CA-CAT-04)', async () => {
    const titular = e.datos.titular.token;
    const s = (await e.publicar(titular, { titulo: 'Para pausar', descripcion: 'D', categoriaId: cat.H2a }).expect(201)).body as { servicioId: string };
    const pausado = (await e.transicionar(titular, s.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200)).body as { version: number };
    const v = await version(cat.H2a);
    const p = (await e.previsualizar(op.token, cat.H2a, { version: v }).expect(201)).body as { confirmacionId: string };
    const d = await e.desactivar(op.token, cat.H2a, { confirmacionId: p.confirmacionId, version: v, motivo: 'M' }).expect(200);
    expect((await e.transicionar(titular, s.servicioId, { version: pausado.version, destino: 'PUBLICADO' }).expect(422)).body.codigo).toBe('CATEGORIA_NO_ACTIVA');
    expect((await e.publicar(titular, { titulo: 'Otro', descripcion: 'D', categoriaId: cat.H2a }).expect(422)).body.codigo).toBe('CATEGORIA_NO_ACTIVA');
    expect(await estado(s.servicioId)).toMatchObject({ estado: 'PAUSADO' });
    await e.activar(op.token, cat.H2a, { version: d.body.version, motivo: 'M' }).expect(200);
    await e.transicionar(titular, s.servicioId, { version: pausado.version, destino: 'PUBLICADO' }).expect(200);
  }, 60000);

  test('una subcategoría con estado propio inactivo sigue indisponible tras reactivar la raíz y no admite publicaciones (CA-CAT-08, 09)', async () => {
    const inactiva = (await e.crear(op.token, { nombre: 'Hija inactiva', categoriaPadreId: cat.R2, motivo: 'Alta' }).expect(201)).body as { categoriaId: string };
    const v = await version(cat.R2);
    const p = (await e.previsualizar(op.token, cat.R2, { version: v }).expect(201)).body as { confirmacionId: string };
    const d = await e.desactivar(op.token, cat.R2, { confirmacionId: p.confirmacionId, version: v, motivo: 'M' }).expect(200);
    await e.publicar(e.datos.titular.token, { titulo: 'X', descripcion: 'D', categoriaId: cat.H2a }).expect(422);
    await e.activar(op.token, cat.R2, { version: d.body.version, motivo: 'M' }).expect(200);
    const lista = (await e.listar(op.token).expect(200)).body.categorias as { categoriaId: string; activaPropia: boolean; activaEfectiva: boolean }[];
    expect(lista.find(c => c.categoriaId === inactiva.categoriaId)).toMatchObject({ activaPropia: false, activaEfectiva: false });
    expect(lista.find(c => c.categoriaId === cat.H2a)).toMatchObject({ activaPropia: true, activaEfectiva: true });
    expect(await categoriasPublicas()).not.toContain(inactiva.categoriaId);
    await e.publicar(e.datos.titular.token, { titulo: 'En hija inactiva', descripcion: 'D', categoriaId: inactiva.categoriaId }).expect(422);
  }, 60000);
});
