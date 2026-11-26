import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { validarRespuesta002 } from '../../soporte/prestadores-catalogo/contrato-002.js';
import { montarHu25, type EntornoHu25 } from '../../soporte/prestadores-catalogo/fixtures-hu25.js';
import type { CuentaPrueba } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

/** INC-002-01 · contrato HTTP de la unicidad de nombres entre hermanas (409 NOMBRE_CLASIFICACION_EN_USO). */
let e: EntornoHu25; let op: CuentaPrueba;
beforeAll(async () => { e = await montarHu25(); op = await e.cuenta(); await e.habilitar(op); }, 180000);
afterAll(async () => { await e?.cerrar(); });

type Cuerpo = { categoriaId: string; version: number; nombre: string };
const alta = (nombre: string, padre?: string, clave?: string) => e.crear(op.token, { nombre, ...(padre ? { categoriaPadreId: padre } : {}), motivo: 'Prueba INC-002-01' }, clave);
const crear = async (nombre: string, padre?: string) => (await alta(nombre, padre).expect(201)).body as Cuerpo;
const consulta = async (sql: string, p: unknown[] = []) => Number(((await e.db.query(sql, p)) as { n: number }[])[0]!.n);
const total = (nombre: string) => consulta('SELECT count(*)::int AS n FROM catalogo_clasificaciones WHERE categoria_padre_id IS NULL AND nombre_clave = catalogo_clave_nombre($1::text)', [nombre]);
const filas = () => consulta('SELECT count(*)::int AS n FROM catalogo_clasificaciones');
const enUso = async (r: PromiseLike<{ status: number; body: Record<string, unknown>; headers: Record<string, string> }>) => {
  const res = await r;
  expect(res.status).toBe(409);
  expect(res.body).toMatchObject({ codigo: 'NOMBRE_CLASIFICACION_EN_USO', detalles: [{ campo: 'nombre', motivo: expect.any(String) }] });
  expect(String(res.body.mensaje)).toMatch(/nombre equivalente/);
  expect(res.headers['cache-control']).toBe('no-store');
  await validarRespuesta002('C002Error409', res.body);
  return res;
};

describe('crear (409 NOMBRE_CLASIFICACION_EN_USO)', () => {
  test('rechaza variantes de mayúsculas, tildes de vocales y espacios, sin almacenar el duplicado ni auditarlo', async () => {
    await crear('Pintura');
    const [filasAntes, auditoriasAntes] = [await filas(), (await e.auditoria()).length];
    for (const variante of ['PINTURA', ' pintura ', 'Pintúra', 'Pintura\u00a0', 'PINTURA\u3000']) await enUso(alta(variante));
    expect(await filas()).toBe(filasAntes); expect((await e.auditoria()).length).toBe(auditoriasAntes); expect(await total('Pintura')).toBe(1);
  });

  test('una clasificación inactiva o desactivada sigue reservando su nombre', async () => {
    const c = await crear('Reservada');
    await enUso(alta('RESERVADA'));
    const activa = (await e.activar(op.token, c.categoriaId, { version: c.version, motivo: 'Activar' }).expect(200)).body as Cuerpo;
    const prev = (await e.previsualizar(op.token, c.categoriaId, { version: activa.version }).expect(201)).body as { confirmacionId: string };
    await e.desactivar(op.token, c.categoriaId, { confirmacionId: prev.confirmacionId, version: activa.version, motivo: 'Desactivar' }).expect(200);
    await enUso(alta('Reservada'));
  });

  test('la ñ no equivale a la n: palabras españolas y nombres quechuas conviven; sus variantes de mayúsculas no', async () => {
    for (const par of [['Año', 'Ano'], ['Cañería', 'Caneria'], ['Ñawpaq', 'Nawpaq'], ['Ñuñu', 'Nunu']] as const) { await crear(par[0]); await crear(par[1]); }
    for (const dup of ['AÑO', 'CAÑERÍA', 'ÑAWPAQ', 'ñuñu', 'NUNU']) await enUso(alta(dup));
  });

  test('los signos ^ ` ¨ · y el apóstrofo distinguen nombres y no se eliminan', async () => {
    for (const n of ['Signo^', 'Signo`', 'Signo¨', 'Signo·', 'Signo', "Q'ero", 'Qero']) await crear(n);
    await enUso(alta('SIGNO^')); await enUso(alta("q'ero"));
  });

  test('entre hermanas: mismo padre rechaza; padres distintos y raíz frente a subcategoría conviven', async () => {
    const a = await crear('Acabados finos'); const b = await crear('Estructuras base');
    await crear('Otros trabajos');
    await crear('Otros trabajos', a.categoriaId); await crear('Otros trabajos', b.categoriaId); await crear('Acabados finos', b.categoriaId);
    await enUso(alta('OTROS TRABAJOS', a.categoriaId)); await enUso(alta('otros trabajos', b.categoriaId)); await enUso(alta('Otros trabajos'));
  });
});

describe('editar (409 NOMBRE_CLASIFICACION_EN_USO)', () => {
  test('renombrar a una hermana falla sin cambiar versión ni auditoría; la variante propia y un nombre libre se aceptan', async () => {
    const a = await crear('Plomería y gas'); const b = await crear('Electricidad');
    const auditorias = (await e.auditoria()).length;
    await enUso(e.editar(op.token, b.categoriaId, { version: b.version, nombre: ' PLOMERIA Y GAS ', motivo: 'Renombrar' }));
    expect(await e.filaCategoria(b.categoriaId)).toMatchObject({ nombre: 'Electricidad', version: 1 });
    expect((await e.auditoria()).length).toBe(auditorias);
    const propio = await e.editar(op.token, a.categoriaId, { version: a.version, nombre: 'PLOMERÍA Y GAS', motivo: 'Mayúsculas' }).expect(200);
    expect(propio.body).toMatchObject({ nombre: 'PLOMERÍA Y GAS', version: 2 });
    await e.editar(op.token, b.categoriaId, { version: b.version, nombre: 'Electricidad domiciliaria', motivo: 'Libre' }).expect(200);
  });

  test('renombrar una subcategoría compara solo con sus hermanas', async () => {
    const r1 = await crear('Raíz uno'); const r2 = await crear('Raíz dos');
    const s1 = await crear('Muros', r1.categoriaId); await crear('Pisos', r1.categoriaId); const s2 = await crear('Techos', r2.categoriaId);
    await e.editar(op.token, s2.categoriaId, { version: s2.version, nombre: 'Muros', motivo: 'Mismo nombre bajo otro padre' }).expect(200);
    await enUso(e.editar(op.token, s1.categoriaId, { version: s1.version, nombre: 'PISOS', motivo: 'Choque con una hermana' }));
  });
});

describe('idempotencia y errores', () => {
  test('un reintento con la misma clave tras un 201 devuelve la misma respuesta, no un 409 de nombre', async () => {
    const clave = randomUUID(); const primera = await alta('Reintento exitoso', undefined, clave).expect(201);
    const segunda = await alta('Reintento exitoso', undefined, clave).expect(201);
    expect(segunda.body).toEqual(primera.body); expect(await total('Reintento exitoso')).toBe(1);
  });

  test('un 409 de nombre no se guarda como resultado idempotente: repetir con su clave vuelve a evaluar la regla', async () => {
    const existente = await crear('Conflicto repetido'); const clave = randomUUID();
    await enUso(alta('conflicto repetido', undefined, clave)); await enUso(alta('conflicto repetido', undefined, clave));
    await e.editar(op.token, existente.categoriaId, { version: existente.version, nombre: 'Conflicto resuelto', motivo: 'Liberar el nombre' }).expect(200);
    await alta('conflicto repetido', undefined, clave).expect(201);
  });

  test('la misma clave con otro cuerpo sigue siendo CLAVE_IDEMPOTENCIA_REUTILIZADA', async () => {
    const clave = randomUUID(); await alta('Clave uno', undefined, clave).expect(201);
    const r = await alta('Clave dos', undefined, clave).expect(409);
    expect(r.body.codigo).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA'); await validarRespuesta002('C002Error409', r.body);
  });

  test('un cuerpo inválido sigue siendo 400 y no se confunde con el conflicto de nombre', async () => {
    await crear('Valida');
    const r = await alta('   ').expect(400); expect(r.body.codigo).toBe('DATOS_INVALIDOS');
  });
});
