import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { validarRespuesta002 } from '../../soporte/prestadores-catalogo/contrato-002.js';
import { cat } from '../../soporte/prestadores-catalogo/fixtures-hu05.js';
import { montarHu25, type EntornoHu25 } from '../../soporte/prestadores-catalogo/fixtures-hu25.js';
import type { CuentaPrueba } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

let e: EntornoHu25;
let op: CuentaPrueba; let sin: CuentaPrueba;
beforeAll(async () => { e = await montarHu25(); op = await e.cuenta(); await e.habilitar(op); sin = await e.cuenta(); }, 180000);
afterAll(async () => { await e?.cerrar(); });

const raiz = async (nombre = `Raíz ${randomUUID().slice(0, 6)}`) => (await e.crear(op.token, { nombre, motivo: 'Alta' }).expect(201)).body as { categoriaId: string; version: number };
const error = async (r: Promise<{ status: number; body: { codigo: string } }>, http: number, codigo: string, esquema: string) => {
  const res = await r; expect([res.status, res.body.codigo]).toEqual([http, codigo]); await validarRespuesta002(esquema, res.body);
};

describe('autenticación, permiso, Origin e idempotencia en las seis operaciones internas', () => {
  test('un visitante recibe 401 y una cuenta sin permiso 403 SIN_PERMISO', async () => {
    const id = cat.R1;
    const llamadas = (t?: string) => [e.listar(t), e.crear(t, { nombre: 'X', motivo: 'M' }), e.editar(t, id, { version: 1, nombre: 'X', motivo: 'M' }),
      e.previsualizar(t, id, { version: 1 }), e.desactivar(t, id, { confirmacionId: randomUUID(), version: 1, motivo: 'M' }), e.activar(t, id, { version: 1, motivo: 'M' })];
    for (const p of llamadas()) { const r = await p.expect(401); await validarRespuesta002('C002Error401', r.body); }
    for (const p of llamadas(sin.token)) { const r = await p.expect(403); await validarRespuesta002('C002Error403', r.body); expect(r.body.codigo).toBe('SIN_PERMISO'); }
  });

  test('exige Origin e Idempotency-Key y rechaza propiedades no admitidas, incluidas identidades', async () => {
    await e.http.post('/api/v1/admin/categorias').set('Authorization', `Bearer ${op.token}`).set('Idempotency-Key', randomUUID()).send({ nombre: 'X', motivo: 'M' }).expect(400);
    await e.crear(op.token, { nombre: 'X', motivo: 'M' }, undefined, 'https://ajeno.example.invalid').expect(403);
    await e.http.post('/api/v1/admin/categorias').set('Authorization', `Bearer ${op.token}`).set('Origin', 'https://localhost:8444').send({ nombre: 'X', motivo: 'M' }).expect(400);
    for (const extra of [{ cuentaId: randomUUID() }, { activa: true }, { version: 1 }, { responsable: 'x' }]) {
      const r = await e.crear(op.token, { nombre: 'X', motivo: 'M', ...extra }).expect(400);
      expect(r.body.codigo).toBe('PROPIEDAD_NO_ADMITIDA');
    }
  });
});

describe('crear (201)', () => {
  test('crea una raíz y una subcategoría inactivas con versión 1 y es idempotente', async () => {
    const clave = randomUUID();
    const r = await e.crear(op.token, { nombre: 'Plomería', motivo: 'Alta de prueba' }, clave).expect(201);
    await validarRespuesta002('C002CategoriaAdmin', r.body);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({ nombre: 'Plomería', categoriaPadreId: null, activaPropia: false, activaEfectiva: false, version: 1 });
    expect(JSON.stringify(r.body)).not.toContain(op.cuentaId);
    expect((await e.crear(op.token, { nombre: 'Plomería', motivo: 'Alta de prueba' }, clave).expect(201)).body).toEqual(r.body);
    await error(e.crear(op.token, { nombre: 'Otra', motivo: 'Alta de prueba' }, clave), 409, 'CLAVE_IDEMPOTENCIA_REUTILIZADA', 'C002Error409');
    const h = await e.crear(op.token, { nombre: 'Tuberías', categoriaPadreId: r.body.categoriaId, motivo: 'Subcategoría' }).expect(201);
    await validarRespuesta002('C002CategoriaAdmin', h.body);
    expect(h.body).toMatchObject({ categoriaPadreId: r.body.categoriaId, activaPropia: false, activaEfectiva: false, version: 1 });
    expect(await e.filaCategoria(h.body.categoriaId)).toMatchObject({ categoria_padre_id: r.body.categoriaId });
  });

  test('rechaza datos inválidos (400), padre inexistente (404) y jerarquía no válida (422)', async () => {
    for (const cuerpo of [{ nombre: '   ', motivo: 'M' }, { nombre: 'a'.repeat(121), motivo: 'M' }, { nombre: 'Ok', motivo: '   ' }, { nombre: 'Ok', motivo: 'm'.repeat(501) }, { motivo: 'M' }, { nombre: 'Ok' }]) {
      await error(e.crear(op.token, cuerpo), 400, 'DATOS_INVALIDOS', 'C002Error400');
    }
    await error(e.crear(op.token, { nombre: '<b>x</b>', motivo: 'M' }), 400, 'DATOS_INVALIDOS', 'C002Error400');
    await error(e.crear(op.token, { nombre: 'Huérfana', categoriaPadreId: randomUUID(), motivo: 'M' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    await error(e.crear(op.token, { nombre: 'Nieta', categoriaPadreId: cat.H1a, motivo: 'M' }), 422, 'JERARQUIA_CATEGORIA_NO_VALIDA', 'C002Error422');
  });
});

describe('listar y editar', () => {
  test('el listado interno incluye estado propio y efectivo, y el público solo las efectivamente activas', async () => {
    const r = await e.listar(op.token).expect(200);
    await validarRespuesta002('C002CategoriasAdmin', r.body);
    expect(r.headers['cache-control']).toBe('no-store');
    const hOculta = r.body.categorias.find((x: { categoriaId: string }) => x.categoriaId === cat.H3a);
    expect(hOculta).toMatchObject({ activaPropia: true, activaEfectiva: false });
    const p = await e.publicas().expect(200);
    await validarRespuesta002('C002CategoriasPublicas', p.body);
    const ids = p.body.categorias.map((x: { categoriaId: string }) => x.categoriaId);
    expect(ids).toEqual(expect.arrayContaining([cat.R1, cat.H1a, cat.H1b, cat.R2, cat.H2a]));
    expect(ids).not.toContain(cat.R3); expect(ids).not.toContain(cat.H3a);
    expect(Object.keys(p.body.categorias[0]).sort()).toEqual(['categoriaId', 'categoriaPadreId', 'nombre']);
    expect(JSON.stringify(p.body)).not.toMatch(/version|activa|cuenta|motivo/i);
    await e.http.get('/api/v1/categorias').set('Authorization', 'Bearer invalido').expect(200);
  });

  test('edita el nombre, avanza la versión y rechaza versión desactualizada (409) o recurso inexistente (404)', async () => {
    const c = await raiz();
    const r = await e.editar(op.token, c.categoriaId, { version: 1, nombre: 'Nuevo nombre', motivo: 'Corrección' }).expect(200);
    await validarRespuesta002('C002CategoriaAdmin', r.body);
    expect(r.body).toMatchObject({ nombre: 'Nuevo nombre', version: 2, activaPropia: false });
    await error(e.editar(op.token, c.categoriaId, { version: 1, nombre: 'Tarde', motivo: 'M' }), 409, 'VERSION_DESACTUALIZADA', 'C002Error409');
    await error(e.editar(op.token, randomUUID(), { version: 1, nombre: 'N', motivo: 'M' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    await error(e.editar(op.token, c.categoriaId, { version: 0, nombre: 'N', motivo: 'M' }), 400, 'DATOS_INVALIDOS', 'C002Error400');
    await error(e.editar(op.token, c.categoriaId, { version: 2, nombre: '', motivo: 'M' }), 400, 'DATOS_INVALIDOS', 'C002Error400');
  });
});

describe('activar, previsualizar y desactivar', () => {
  test('activa una categoría inactiva y rechaza repetir el estado (422) o una versión vieja (409)', async () => {
    const c = await raiz();
    const r = await e.activar(op.token, c.categoriaId, { version: 1, motivo: 'Se habilita' }).expect(200);
    await validarRespuesta002('C002CategoriaAdmin', r.body);
    expect(r.body).toMatchObject({ activaPropia: true, activaEfectiva: true, version: 2 });
    await error(e.activar(op.token, c.categoriaId, { version: 2, motivo: 'M' }), 422, 'TRANSICION_NO_ADMITIDA', 'C002Error422');
    await error(e.activar(op.token, c.categoriaId, { version: 1, motivo: 'M' }), 409, 'VERSION_DESACTUALIZADA', 'C002Error409');
    await error(e.activar(op.token, randomUUID(), { version: 1, motivo: 'M' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    await error(e.activar(op.token, c.categoriaId, { version: 2 }), 400, 'DATOS_INVALIDOS', 'C002Error400');
  });

  test('la vista previa devuelve recuento y vencimiento UTC, y la desactivación exige confirmación, versión y motivo', async () => {
    const c = await raiz();
    await e.activar(op.token, c.categoriaId, { version: 1, motivo: 'M' }).expect(200);
    const p = await e.previsualizar(op.token, c.categoriaId, { version: 2 }).expect(201);
    await validarRespuesta002('C002PrevisualizacionDesactivacion', p.body);
    expect(p.body.afectados).toBe(0);
    await error(e.previsualizar(op.token, c.categoriaId, { version: 1 }), 409, 'VERSION_DESACTUALIZADA', 'C002Error409');
    await error(e.previsualizar(op.token, randomUUID(), { version: 1 }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    await error(e.desactivar(op.token, c.categoriaId, { version: 2, motivo: 'M' }), 400, 'DATOS_INVALIDOS', 'C002Error400');
    await error(e.desactivar(op.token, c.categoriaId, { confirmacionId: p.body.confirmacionId, version: 2 }), 400, 'DATOS_INVALIDOS', 'C002Error400');
    await error(e.desactivar(op.token, c.categoriaId, { confirmacionId: randomUUID(), version: 2, motivo: 'M' }), 409, 'CONFIRMACION_NO_VALIDA', 'C002Error409');
    await error(e.desactivar(op.token, c.categoriaId, { confirmacionId: p.body.confirmacionId, version: 1, motivo: 'M' }), 409, 'VERSION_DESACTUALIZADA', 'C002Error409');
    const clave = randomUUID();
    const d = await e.desactivar(op.token, c.categoriaId, { confirmacionId: p.body.confirmacionId, version: 2, motivo: 'Obsoleta' }, clave).expect(200);
    await validarRespuesta002('C002CategoriaAdmin', d.body);
    expect(d.body).toMatchObject({ activaPropia: false, activaEfectiva: false, version: 3 });
    expect((await e.desactivar(op.token, c.categoriaId, { confirmacionId: p.body.confirmacionId, version: 2, motivo: 'Obsoleta' }, clave).expect(200)).body).toEqual(d.body);
    await error(e.previsualizar(op.token, c.categoriaId, { version: 3 }), 422, 'TRANSICION_NO_ADMITIDA', 'C002Error422');
  });

  test('el recuento de la vista previa cuenta servicios distintos, incluidos los de subcategorías activas', async () => {
    const r = (await e.previsualizar(op.token, cat.R1, { version: 1 }).expect(201)).body as { afectados: number };
    const esperado = ((await e.db.query(`SELECT count(DISTINCT s.id)::int AS n FROM catalogo_servicios s JOIN catalogo_clasificaciones c ON c.id=s.categoria_id
      WHERE s.estado='PUBLICADO' AND (c.id=$1 OR c.categoria_padre_id=$1)`, [cat.R1])) as { n: number }[])[0]!.n;
    expect(r.afectados).toBe(esperado);
    expect(esperado).toBeGreaterThan(25);
    const h = (await e.previsualizar(op.token, cat.H1a, { version: 1 }).expect(201)).body as { afectados: number };
    expect(h.afectados).toBeLessThan(r.afectados);
  });
});
