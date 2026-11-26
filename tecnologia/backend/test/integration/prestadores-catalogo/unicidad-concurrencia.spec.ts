import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { montarHu25, type EntornoHu25 } from '../../soporte/prestadores-catalogo/fixtures-hu25.js';
import type { CuentaPrueba } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

/** INC-002-01 · concurrencia: la unicidad entre hermanas se mantiene con altas y ediciones simultáneas y claves de idempotencia distintas. */
let e: EntornoHu25; let op: CuentaPrueba;
beforeAll(async () => { e = await montarHu25(); op = await e.cuenta(); await e.habilitar(op); }, 180000);
afterAll(async () => { await e?.cerrar(); });

type Cuerpo = { categoriaId: string; version: number; nombre: string };
const alta = (nombre: string, padre?: string, clave?: string) => e.crear(op.token, { nombre, ...(padre ? { categoriaPadreId: padre } : {}), motivo: 'Concurrencia INC-002-01' }, clave);
const crear = async (nombre: string, padre?: string) => (await alta(nombre, padre).expect(201)).body as Cuerpo;
const n = async (sql: string, p: unknown[] = []) => Number(((await e.db.query(sql, p)) as { n: number }[])[0]!.n);
const porClave = (nombre: string, padre: string | null) => n('SELECT count(*)::int AS n FROM catalogo_clasificaciones WHERE categoria_padre_id IS NOT DISTINCT FROM $2::uuid AND nombre_clave = catalogo_clave_nombre($1::text)', [nombre, padre]);
const creadas = () => n("SELECT count(*)::int AS n FROM administracion_auditoria WHERE accion = 'CATEGORIA_CREADA'");
const resumen = (r: { status: number; body: { codigo?: string } }[]) => ({ 201: r.filter(x => x.status === 201).length, 409: r.filter(x => x.status === 409).length, otros: r.filter(x => ![201, 409].includes(x.status)).length,
  codigos409: [...new Set(r.filter(x => x.status === 409).map(x => x.body.codigo))] });

describe('20 altas simultáneas equivalentes con claves de idempotencia distintas', () => {
  test('raíces con el mismo nombre: una creación y 19 conflictos, sin duplicados ni auditorías de más', async () => {
    const auditoriasAntes = await creadas();
    const r = await Promise.all(Array.from({ length: 20 }, () => alta('Concurrente raíz', undefined, randomUUID())));
    expect(resumen(r)).toEqual({ 201: 1, 409: 19, otros: 0, codigos409: ['NOMBRE_CLASIFICACION_EN_USO'] });
    expect(await porClave('Concurrente raíz', null)).toBe(1); expect(await creadas()).toBe(auditoriasAntes + 1);
    console.info('INC-002-01 concurrencia raíces:', JSON.stringify(resumen(r)));
  });

  test('variantes equivalentes (mayúsculas, tildes de vocales, espacios): una creación y 19 conflictos', async () => {
    const variantes = ['Instalación eléctrica', 'INSTALACION ELECTRICA', 'instalacion  electrica', ' Instalación Eléctrica ', 'Instalacion\u00a0electrica'];
    const r = await Promise.all(Array.from({ length: 20 }, (_, i) => alta(variantes[i % variantes.length]!, undefined, randomUUID())));
    expect(resumen(r)).toEqual({ 201: 1, 409: 19, otros: 0, codigos409: ['NOMBRE_CLASIFICACION_EN_USO'] });
    expect(await porClave('instalacion electrica', null)).toBe(1);
  });

  test('subcategorías hermanas con el mismo nombre: una creación y 19 conflictos', async () => {
    const padre = await crear('Padre concurrente');
    const r = await Promise.all(Array.from({ length: 20 }, () => alta('Hija concurrente', padre.categoriaId, randomUUID())));
    expect(resumen(r)).toEqual({ 201: 1, 409: 19, otros: 0, codigos409: ['NOMBRE_CLASIFICACION_EN_USO'] });
    expect(await porClave('Hija concurrente', padre.categoriaId)).toBe(1);
  });

  test('la ñ y la n no compiten: 20 altas mezcladas dan exactamente dos creaciones', async () => {
    const r = await Promise.all(Array.from({ length: 20 }, (_, i) => alta(i % 2 ? 'ÑUÑU concurrente' : 'Nunu concurrente', undefined, randomUUID())));
    expect(resumen(r)).toMatchObject({ 201: 2, 409: 18, otros: 0 });
  });

  test('el mismo nombre bajo padres distintos se crea en todos los casos', async () => {
    const padres = await Promise.all(Array.from({ length: 5 }, (_, i) => crear(`Padre distinto ${i}`)));
    const r = await Promise.all(padres.flatMap(p => [alta('Otros distintos', p.categoriaId, randomUUID())]));
    expect(resumen(r)).toMatchObject({ 201: 5, 409: 0, otros: 0 });
  });
});

describe('altas y ediciones cruzadas', () => {
  test('una edición y una alta que buscan el mismo nombre: gana una, la otra recibe 409', async () => {
    const b = await crear('Origen cruzado');
    const r = await Promise.all([alta('Destino cruzado', undefined, randomUUID()), e.editar(op.token, b.categoriaId, { version: b.version, nombre: 'DESTINO CRUZADO', motivo: 'Cruce' })]);
    expect(r.map(x => x.status === 200 ? 201 : x.status).sort()).toEqual([201, 409]);
    expect(r.find(x => x.status === 409)!.body.codigo).toBe('NOMBRE_CLASIFICACION_EN_USO');
    expect(await porClave('Destino cruzado', null)).toBe(1);
  });

  test('20 ediciones de distintas filas hacia el mismo nombre: una gana y 19 reciben 409', async () => {
    const filas = await Promise.all(Array.from({ length: 20 }, (_, i) => crear(`Fila editable ${i}`)));
    const r = await Promise.all(filas.map(f => e.editar(op.token, f.categoriaId, { version: f.version, nombre: 'Nombre disputado', motivo: 'Disputa' })));
    expect(resumen(r.map(x => ({ status: x.status === 200 ? 201 : x.status, body: x.body })))).toEqual({ 201: 1, 409: 19, otros: 0, codigos409: ['NOMBRE_CLASIFICACION_EN_USO'] });
    expect(await porClave('Nombre disputado', null)).toBe(1);
  });
});

describe('reintentos con la misma clave de idempotencia', () => {
  test('20 reintentos secuenciales con la misma clave devuelven el mismo resultado y crean una sola fila', async () => {
    const clave = randomUUID(); const primera = await alta('Reintento secuencial', undefined, clave).expect(201);
    for (let i = 0; i < 19; i++) expect((await alta('Reintento secuencial', undefined, clave).expect(201)).body).toEqual(primera.body);
    expect(await porClave('Reintento secuencial', null)).toBe(1);
  });

  test('20 envíos simultáneos con la misma clave y el mismo cuerpo: una sola fila, sin 5xx y sin otro conflicto que el de la propia clave', async () => {
    const clave = randomUUID();
    const r = await Promise.all(Array.from({ length: 20 }, () => alta('Reintento simultáneo', undefined, clave)));
    const estados = resumen(r);
    console.info('INC-002-01 misma clave simultánea:', JSON.stringify(estados));
    expect(estados.otros).toBe(0); expect(estados[201]).toBeGreaterThanOrEqual(1);
    expect(await porClave('Reintento simultáneo', null)).toBe(1);
    const ids = new Set(r.filter(x => x.status === 201).map(x => x.body.categoriaId)); expect(ids.size).toBe(1);
  });
});
