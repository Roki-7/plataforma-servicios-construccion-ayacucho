import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { persistencia003 } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { aplicarMigraciones003, persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { condicionDe, traducirErrorBd } from '../../../src/compartido/infraestructura/postgres/traduccion-errores.js';
import { restriccionesDeCotizaciones, traducirCondicionCotizaciones } from '../../../src/modulos/cotizaciones/dominio/errores.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';

// Modelo de datos de Cotizaciones con PostgreSQL real (T030 / T-mod-cot): data-model.md §3. Base descartable `ayacucho_003_test_*`.
let base: Awaited<ReturnType<typeof baseAislada003>>;
let db: DataSource;

const uuid = () => randomUUID();
const codigoDe = async (promesa: Promise<unknown>) => { try { await promesa; return undefined; } catch (e) { return condicionDe(e)?.sqlstate ?? 'otro'; } };
const errorDe = async (promesa: Promise<unknown>) => { try { await promesa; return undefined; } catch (e) { return e; } };
const mañana = () => new Date(Date.now() + 86_400_000).toISOString();

async function cotizacion(sobre: Record<string, unknown> = {}): Promise<string> {
  const id = uuid();
  const v: Record<string, unknown> = { id, solicitud_id: uuid(), prestador_id: uuid(), prestador_cuenta_id: uuid(), estado: 'ACTIVA', ...sobre };
  const c = Object.keys(v);
  await db.query(`INSERT INTO cotizaciones (${c.join(',')}) VALUES (${c.map((_, i) => `$${i + 1}`).join(',')})`, c.map(k => v[k]));
  return id;
}
const definitiva = { tipo: 'DEFINITIVA', precio_centimos: 150000, plazo_dias: 10, condiciones_pago: '50 % al iniciar' };
/** Inserta una versión. Por omisión, una DEFINITIVA válida. */
function version(cotizacionId: string, numero: number, sobre: Record<string, unknown> = {}) {
  const v: Record<string, unknown> = { cotizacion_id: cotizacionId, numero, version_trabajo_solicitud: 1, alcance: 'Alcance ficticio', vigente_hasta: mañana(), ...definitiva, ...sobre };
  const c = Object.keys(v);
  return db.query(`INSERT INTO cotizaciones_versiones (${c.join(',')}) VALUES (${c.map((_, i) => `$${i + 1}`).join(',')})`, c.map(k => v[k]));
}
function aclaracion(cotizacionId: string, numero: number, sobre: Record<string, unknown> = {}) {
  const v: Record<string, unknown> = { id: uuid(), cotizacion_id: cotizacionId, numero, autor_cuenta_id: uuid(), autor_rol: 'CLIENTE', texto: '¿Incluye materiales?', version_cotizacion: 1, ...sobre };
  const c = Object.keys(v);
  return db.query(`INSERT INTO cotizaciones_aclaraciones (${c.join(',')}) VALUES (${c.map((_, i) => `$${i + 1}`).join(',')})`, c.map(k => v[k]));
}
const retirar = (id: string) => db.query("UPDATE cotizaciones SET estado='RETIRADA', retirada_en=clock_timestamp(), version=version+1 WHERE id=$1", [id]);

beforeAll(async () => {
  base = await baseAislada003(); await aplicarMigraciones003(base.url);
  db = persistencia003(base.url, persistenciaOferta002, persistenciaOferta003); await db.initialize();
}, 180000);
afterAll(async () => { if (db?.isInitialized) await db.destroy(); await base?.cerrar(); });

describe('migración 1796000000002', () => {
  test('crea las tres tablas de Cotizaciones y ninguna clave foránea hacia otros módulos', async () => {
    const tablas = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'cotizaciones%' ORDER BY 1") as { table_name: string }[]).map(t => t.table_name);
    expect(tablas).toEqual(['cotizaciones', 'cotizaciones_aclaraciones', 'cotizaciones_versiones']);
    const fks = await db.query(`SELECT confrelid::regclass::text AS hacia FROM pg_constraint WHERE contype='f' AND conrelid::regclass::text LIKE 'cotizaciones%'`) as { hacia: string }[];
    for (const f of fks) expect(f.hacia).toMatch(/^cotizaciones/);
  });
  test('los tipos y longitudes son los del modelo', async () => {
    const col = async (t: string, c: string) => ((await db.query('SELECT data_type, character_maximum_length AS largo FROM information_schema.columns WHERE table_name=$1 AND column_name=$2', [t, c])) as { data_type: string; largo: number | null }[])[0]!;
    expect(await col('cotizaciones_versiones', 'alcance')).toEqual({ data_type: 'character varying', largo: 2000 });
    expect((await col('cotizaciones_versiones', 'forma_calculo')).largo).toBe(1000);
    expect((await col('cotizaciones_versiones', 'condiciones_pago')).largo).toBe(1000);
    expect((await col('cotizaciones_versiones', 'precio_centimos')).data_type).toBe('bigint');
    expect((await col('cotizaciones_aclaraciones', 'texto')).largo).toBe(1000);
  });
});

describe('identidad de la cotización', () => {
  test('el estado solo es ACTIVA o RETIRADA y retirada_en existe si y solo si está RETIRADA', async () => {
    expect(await codigoDe(cotizacion({ estado: 'ACEPTADA' }))).toBe('23514');
    expect(await codigoDe(cotizacion({ estado: 'RETIRADA' }))).toBe('23514');
    expect(await codigoDe(cotizacion({ retirada_en: new Date().toISOString() }))).toBe('23514');
    expect(await codigoDe(cotizacion({ estado: 'RETIRADA', retirada_en: new Date().toISOString() }))).toBeUndefined();
  });
  test('índice único parcial: a lo sumo una cotización no retirada por (solicitud, prestador)', async () => {
    const solicitud = uuid(); const prestador = uuid();
    await cotizacion({ solicitud_id: solicitud, prestador_id: prestador });
    const error = await errorDe(cotizacion({ solicitud_id: solicitud, prestador_id: prestador }));
    expect(condicionDe(error)).toMatchObject({ sqlstate: '23505', restriccion: restriccionesDeCotizaciones.unicaNoRetirada });
    expect(traducirErrorBd(error, traducirCondicionCotizaciones)).toMatchObject({ http: 409, codigo: 'COTIZACION_EXISTENTE' });
    expect(await codigoDe(cotizacion({ solicitud_id: solicitud }))).toBeUndefined();
    expect(await codigoDe(cotizacion({ prestador_id: prestador }))).toBeUndefined();
  });
  test('tras retirar, el mismo prestador puede cotizar de nuevo con otra identidad', async () => {
    const solicitud = uuid(); const prestador = uuid();
    const primera = await cotizacion({ solicitud_id: solicitud, prestador_id: prestador });
    await retirar(primera);
    const segunda = await cotizacion({ solicitud_id: solicitud, prestador_id: prestador });
    expect(segunda).not.toBe(primera);
    expect(await codigoDe(cotizacion({ solicitud_id: solicitud, prestador_id: prestador }))).toBe('23505');
  });
  test('cotizaciones simultáneas del mismo prestador a la misma solicitud: exactamente una entra y el resto recibe COTIZACION_EXISTENTE', async () => {
    const solicitud = uuid(); const prestador = uuid();
    const resultados = await Promise.allSettled(Array.from({ length: 8 }, () => cotizacion({ solicitud_id: solicitud, prestador_id: prestador })));
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of resultados.filter((x): x is PromiseRejectedResult => x.status === 'rejected')) expect(traducirErrorBd(r.reason, traducirCondicionCotizaciones)).toMatchObject({ codigo: 'COTIZACION_EXISTENTE' });
  }, 60000);
  test('RETIRADA es terminal y la identidad no cambia', async () => {
    const id = await cotizacion(); await retirar(id);
    for (const cambio of ["version=99", "estado='ACTIVA', retirada_en=NULL", "version_actual=2"]) expect([cambio, await codigoDe(db.query(`UPDATE cotizaciones SET ${cambio} WHERE id=$1`, [id]))]).toEqual([cambio, '23514']);
    const viva = await cotizacion();
    for (const cambio of ['solicitud_id=gen_random_uuid()', 'prestador_id=gen_random_uuid()', 'prestador_cuenta_id=gen_random_uuid()']) expect([cambio, await codigoDe(db.query(`UPDATE cotizaciones SET ${cambio} WHERE id=$1`, [viva]))]).toEqual([cambio, '23514']);
    await db.query('UPDATE cotizaciones SET version=2, version_actual=2 WHERE id=$1', [viva]);
    expect(await codigoDe(db.query('UPDATE cotizaciones SET version=1 WHERE id=$1', [viva]))).toBe('23514');
  });
  test('no se puede borrar una cotización', async () => {
    const id = await cotizacion();
    expect(await codigoDe(db.query('DELETE FROM cotizaciones WHERE id=$1', [id]))).toBe('23514');
  });
});

describe('versiones', () => {
  test('numeración consecutiva desde 1 y versión de trabajo de la solicitud ≥ 1', async () => {
    const id = await cotizacion();
    expect(await codigoDe(version(id, 2))).toBe('23514');
    await version(id, 1);
    expect(await codigoDe(version(id, 1))).toBeDefined();
    expect(await codigoDe(version(id, 3))).toBe('23514');
    await version(id, 2);
    expect(await codigoDe(version(await cotizacion(), 1, { version_trabajo_solicitud: 0 }))).toBe('23514');
  });
  test('ESTIMADA exige precio o forma de cálculo; DEFINITIVA exige precio, plazo y condiciones de pago', async () => {
    const c = async () => cotizacion();
    const estimada = { tipo: 'ESTIMADA', precio_centimos: null, plazo_dias: null, condiciones_pago: null };
    expect(await codigoDe(version(await c(), 1, { ...estimada }))).toBe('23514');
    expect(await codigoDe(version(await c(), 1, { ...estimada, precio_centimos: 5000 }))).toBeUndefined();
    expect(await codigoDe(version(await c(), 1, { ...estimada, forma_calculo: 'Por metro cuadrado' }))).toBeUndefined();
    for (const faltante of ['precio_centimos', 'plazo_dias', 'condiciones_pago']) expect([faltante, await codigoDe(version(await c(), 1, { [faltante]: null }))]).toEqual([faltante, '23514']);
    expect(await codigoDe(version(await c(), 1, {}))).toBeUndefined();
    expect(await codigoDe(version(await c(), 1, { tipo: 'APROXIMADA' }))).toBe('23514');
  });
  test('precio_centimos mayor que 0 y hasta 9 007 199 254 740 991, sin máximo de negocio', async () => {
    const c = async () => cotizacion();
    expect(await codigoDe(version(await c(), 1, { precio_centimos: 0 }))).toBe('23514');
    expect(await codigoDe(version(await c(), 1, { precio_centimos: -5 }))).toBe('23514');
    expect(await codigoDe(version(await c(), 1, { precio_centimos: '9007199254740991' }))).toBeUndefined();
    expect(await codigoDe(version(await c(), 1, { precio_centimos: '9007199254740992' }))).toBe('23514');
    expect(await codigoDe(version(await c(), 1, { precio_centimos: 100_000_000_000 }))).toBeUndefined();
  });
  test('plazo_dias positivo, alcance obligatorio y no vacío, longitudes máximas y vigencia obligatoria', async () => {
    const c = async () => cotizacion();
    expect(await codigoDe(version(await c(), 1, { plazo_dias: 0 }))).toBe('23514');
    expect(await codigoDe(version(await c(), 1, { alcance: null }))).toBe('23502');
    expect(await codigoDe(version(await c(), 1, { alcance: '   ' }))).toBe('23514');
    expect(await codigoDe(version(await c(), 1, { alcance: 'x'.repeat(2001) }))).toBe('22001');
    expect(await codigoDe(version(await c(), 1, { condiciones_pago: 'x'.repeat(1001) }))).toBe('22001');
    expect(await codigoDe(version(await c(), 1, { forma_calculo: 'x'.repeat(1001), tipo: 'ESTIMADA', precio_centimos: 1 }))).toBe('22001');
    expect(await codigoDe(version(await c(), 1, { vigente_hasta: null }))).toBe('23502');
  });
  test('son inmutables: UPDATE y DELETE se rechazan', async () => {
    const id = await cotizacion(); await version(id, 1);
    expect(await codigoDe(db.query("UPDATE cotizaciones_versiones SET alcance='cambio' WHERE cotizacion_id=$1", [id]))).toBe('23514');
    expect(await codigoDe(db.query('DELETE FROM cotizaciones_versiones WHERE cotizacion_id=$1', [id]))).toBe('23514');
  });
  test('una versión exige su cotización', async () => {
    expect(await codigoDe(version(uuid(), 1))).toBe('23503');
  });
});

describe('aclaraciones', () => {
  test('numero entre 1 y 20, único por cotización, con restricciones con nombre y traducción', async () => {
    const id = await cotizacion();
    expect(await codigoDe(aclaracion(id, 0))).toBe('23514');
    const veintiuno = await errorDe(aclaracion(id, 21));
    expect(condicionDe(veintiuno)).toMatchObject({ sqlstate: '23514', restriccion: restriccionesDeCotizaciones.numeroDeAclaracionRango });
    expect(traducirErrorBd(veintiuno, traducirCondicionCotizaciones)).toMatchObject({ http: 422, codigo: 'LIMITE_ACLARACIONES' });
    for (let n = 1; n <= 20; n += 1) await aclaracion(id, n);
    const repetido = await errorDe(aclaracion(id, 7));
    expect(condicionDe(repetido)).toMatchObject({ sqlstate: '23505', restriccion: restriccionesDeCotizaciones.numeroDeAclaracionUnico });
    expect(traducirErrorBd(repetido, traducirCondicionCotizaciones)).toMatchObject({ codigo: 'CONFLICTO_CONCURRENTE' });
    expect(Number(((await db.query('SELECT count(*)::int AS n FROM cotizaciones_aclaraciones WHERE cotizacion_id=$1', [id])) as { n: number }[])[0]!.n)).toBe(20);
  });
  test('el mismo número en otra cotización sí se admite', async () => {
    expect(await codigoDe(aclaracion(await cotizacion(), 1))).toBeUndefined();
    expect(await codigoDe(aclaracion(await cotizacion(), 1))).toBeUndefined();
  });
  test('autor_rol solo CLIENTE o PRESTADOR; texto no vacío y de hasta 1 000 caracteres', async () => {
    const id = await cotizacion();
    expect(await codigoDe(aclaracion(id, 1, { autor_rol: 'ADMIN' }))).toBe('23514');
    expect(await codigoDe(aclaracion(id, 1, { texto: '  ' }))).toBe('23514');
    expect(await codigoDe(aclaracion(id, 1, { texto: 'x'.repeat(1001) }))).toBe('22001');
    expect(await codigoDe(aclaracion(id, 1, { texto: 'x'.repeat(1000), autor_rol: 'PRESTADOR' }))).toBeUndefined();
  });
  test('son inmutables y exigen su cotización', async () => {
    const id = await cotizacion(); await aclaracion(id, 1);
    expect(await codigoDe(db.query("UPDATE cotizaciones_aclaraciones SET texto='otro' WHERE cotizacion_id=$1", [id]))).toBe('23514');
    expect(await codigoDe(db.query('DELETE FROM cotizaciones_aclaraciones WHERE cotizacion_id=$1', [id]))).toBe('23514');
    expect(await codigoDe(aclaracion(uuid(), 1))).toBe('23503');
  });
  test('veintiún mensajes simultáneos con números distintos: el 21 se rechaza y el hilo queda en 20', async () => {
    const id = await cotizacion();
    const resultados = await Promise.allSettled(Array.from({ length: 21 }, (_, i) => aclaracion(id, i + 1)));
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(20);
    const rechazo = resultados.find((r): r is PromiseRejectedResult => r.status === 'rejected')!;
    expect(traducirErrorBd(rechazo.reason, traducirCondicionCotizaciones)).toMatchObject({ codigo: 'LIMITE_ACLARACIONES' });
  }, 60000);
});

describe('índices del modelo', () => {
  test('existen los índices de «mis cotizaciones», del listado del cliente y de autoría', async () => {
    const defs = (await db.query("SELECT indexdef FROM pg_indexes WHERE tablename='cotizaciones'") as { indexdef: string }[]).map(i => i.indexdef).join('\n');
    expect(defs).toMatch(/\(prestador_id, creada_en DESC, id\)/);
    expect(defs).toMatch(/\(solicitud_id, estado, creada_en, id\)/);
    expect(defs).toMatch(/\(prestador_cuenta_id, solicitud_id\) WHERE/);
    expect(defs).toMatch(/UNIQUE INDEX cotizaciones_unica_no_retirada .*\(solicitud_id, prestador_id\) WHERE/);
  });
});
