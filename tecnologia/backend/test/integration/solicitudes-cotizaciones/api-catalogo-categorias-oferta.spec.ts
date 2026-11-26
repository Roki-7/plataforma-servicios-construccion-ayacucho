import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { persistencia003, } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { aplicarMigraciones003, persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { CategoriasDeOfertaPostgres } from '../../../src/modulos/catalogo/infraestructura/persistencia/categorias-de-oferta.js';
import type { CategoriasDeOferta } from '../../../src/modulos/catalogo/api-publica.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';
import { ContadorSentencias } from '../../soporte/solicitudes-cotizaciones/contador-sentencias.js';

// `categoriasDeOferta` de Catálogo para la 003 (T018): CA-CMP-01 a 07 en su parte de Catálogo. Base descartable `ayacucho_003_test_*`.
// La compatibilidad reproduce la búsqueda pública de la 002 (`s.categoria_id = X OR c.categoria_padre_id = X`): un servicio en una subcategoría aporta
// la subcategoría y su categoría; un servicio en la categoría aporta solo la categoría.
let base: Awaited<ReturnType<typeof baseAislada003>>;
let db: DataSource; let uow: UnidadDeTrabajoPostgres; let api: CategoriasDeOferta; let contador: ContadorSentencias;

async function clasificacion(nombre: string, opciones: { padre?: string; activa?: boolean } = {}): Promise<string> {
  const id = randomUUID(); const unico = `${nombre} ${id.slice(0, 8)}`;
  await db.query('INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id,activa) VALUES($1,$2::varchar,$2::text,$3,$4,$5)',
    [id, unico, opciones.padre ? 2 : 1, opciones.padre ?? null, opciones.activa ?? true]);
  return id;
}
async function servicio(prestadorId: string, categoriaId: string, estado: 'PUBLICADO' | 'PAUSADO' | 'RETIRADO' = 'PUBLICADO'): Promise<string> {
  const id = randomUUID();
  await db.query(`INSERT INTO catalogo_servicios(id,prestador_id,categoria_id,titulo,descripcion,estado) VALUES($1,$2,$3,'Servicio ficticio','Descripción ficticia',$4)`, [id, prestadorId, categoriaId, estado]);
  return id;
}
const conjunto = async (prestadorId: string) => [...await api.categoriasDeOferta(prestadorId)].sort();
const ordenados = (...ids: string[]) => [...ids].sort();

/** Árbol del enunciado: categoría A con subcategorías A1 y A2, y categoría B. Cada prueba usa su propio árbol y su propio prestador. */
async function arbol() {
  const A = await clasificacion('Categoría A'); const A1 = await clasificacion('Subcategoría A1', { padre: A }); const A2 = await clasificacion('Subcategoría A2', { padre: A });
  const B = await clasificacion('Categoría B');
  return { A, A1, A2, B, prestador: randomUUID() };
}

beforeAll(async () => {
  base = await baseAislada003(); await aplicarMigraciones003(base.url);
  db = persistencia003(base.url, persistenciaOferta002, persistenciaOferta003); await db.initialize();
  uow = new UnidadDeTrabajoPostgres(db);
  api = new CategoriasDeOfertaPostgres(uow);
  contador = new ContadorSentencias().instalar(db);
}, 180000);
afterAll(async () => { contador?.liberar(); if (db?.isInitialized) await db.destroy(); await base?.cerrar(); });

describe('categorías cubiertas por la oferta', () => {
  test('un servicio en la subcategoría A1 aporta {A1, A}', async () => {
    const t = await arbol(); await servicio(t.prestador, t.A1);
    expect(await conjunto(t.prestador)).toEqual(ordenados(t.A1, t.A));
  });
  test('un servicio en la categoría A aporta solo {A}: no cubre sus subcategorías', async () => {
    const t = await arbol(); await servicio(t.prestador, t.A);
    expect(await conjunto(t.prestador)).toEqual([t.A]);
  });
  test('servicios en A1 y A2 aportan {A1, A2, A}, y uno en B no mezcla ramas', async () => {
    const t = await arbol(); await servicio(t.prestador, t.A1); await servicio(t.prestador, t.A2);
    expect(await conjunto(t.prestador)).toEqual(ordenados(t.A1, t.A2, t.A));
    await servicio(t.prestador, t.B);
    expect(await conjunto(t.prestador)).toEqual(ordenados(t.A1, t.A2, t.A, t.B));
  });
  test('sin duplicados cuando varios servicios comparten categoría', async () => {
    const t = await arbol(); await servicio(t.prestador, t.A1); await servicio(t.prestador, t.A1); await servicio(t.prestador, t.A);
    expect(await conjunto(t.prestador)).toEqual(ordenados(t.A1, t.A));
  });
  test('un prestador sin servicios, o desconocido, obtiene un conjunto vacío', async () => {
    expect((await api.categoriasDeOferta(randomUUID())).size).toBe(0);
    expect((await api.categoriasDeOferta('no-es-uuid')).size).toBe(0);
  });
  test('solo cuentan los servicios del prestador indicado', async () => {
    const t = await arbol(); const otro = randomUUID(); await servicio(otro, t.B); await servicio(t.prestador, t.A);
    expect(await conjunto(t.prestador)).toEqual([t.A]);
    expect(await conjunto(otro)).toEqual([t.B]);
  });
});

describe('solo servicios PUBLICADO con clasificación efectivamente activa', () => {
  test('un servicio PAUSADO o RETIRADO no aporta categorías', async () => {
    const t = await arbol(); await servicio(t.prestador, t.A1, 'PAUSADO'); await servicio(t.prestador, t.B, 'RETIRADO');
    expect(await conjunto(t.prestador)).toEqual([]);
    await servicio(t.prestador, t.A2);
    expect(await conjunto(t.prestador)).toEqual(ordenados(t.A2, t.A));
  });
  test('una subcategoría inactiva no aporta ni la subcategoría ni su categoría', async () => {
    const t = await arbol(); await servicio(t.prestador, t.A1);
    await db.query('UPDATE catalogo_clasificaciones SET activa=false WHERE id=$1', [t.A1]);
    expect(await conjunto(t.prestador)).toEqual([]);
  });
  test('una categoría inactiva anula a sus subcategorías aunque estas sigan activas, y a su propio servicio', async () => {
    const t = await arbol(); await servicio(t.prestador, t.A1); await servicio(t.prestador, t.A); await servicio(t.prestador, t.B);
    await db.query('UPDATE catalogo_clasificaciones SET activa=false WHERE id=$1', [t.A]);
    expect(await conjunto(t.prestador)).toEqual([t.B]);
  });
  test('al reactivarse la categoría vuelve a cubrirse', async () => {
    const t = await arbol(); await servicio(t.prestador, t.A1);
    await db.query('UPDATE catalogo_clasificaciones SET activa=false WHERE id=$1', [t.A]);
    expect(await conjunto(t.prestador)).toEqual([]);
    await db.query('UPDATE catalogo_clasificaciones SET activa=true WHERE id=$1', [t.A]);
    expect(await conjunto(t.prestador)).toEqual(ordenados(t.A1, t.A));
  });
});

describe('lectura aditiva', () => {
  test('usa una sola sentencia de solo lectura sobre tablas de Catálogo, sin bloqueos ni cambios', async () => {
    const t = await arbol(); await servicio(t.prestador, t.A1);
    const antes = Number(((await db.query('SELECT count(*)::int AS n FROM catalogo_servicios')) as { n: number }[])[0]!.n);
    const r = await contador.contar(() => api.categoriasDeOferta(t.prestador));
    expect(r.total).toBe(1);
    expect(r.sentencias[0]).toMatch(/^(WITH|SELECT) /i);
    expect(r.sentencias[0]).not.toMatch(/\b(INSERT|UPDATE|DELETE|LOCK|FOR UPDATE|FOR SHARE)\b/i);
    for (const tabla of [...r.sentencias[0]!.matchAll(/\b(?:FROM|JOIN)\s+(\w+)/gi)].map(m => m[1])) expect(tabla).toMatch(/^(catalogo_servicios|catalogo_clasificaciones|visibles)$/);
    expect(Number(((await db.query('SELECT count(*)::int AS n FROM catalogo_servicios')) as { n: number }[])[0]!.n)).toBe(antes);
  });
  test('con la transacción del llamador ve sus cambios sin confirmar y sin ella no', async () => {
    const t = await arbol(); let dentro: string[] = []; let fuera: string[] = [];
    await uow.ejecutar(async (tx) => {
      await uow.runner(tx).query(`INSERT INTO catalogo_servicios(id,prestador_id,categoria_id,titulo,descripcion,estado) VALUES($1,$2,$3,'Servicio ficticio','Descripción ficticia','PUBLICADO')`, [randomUUID(), t.prestador, t.A1]);
      dentro = [...await api.categoriasDeOferta(t.prestador, tx)].sort(); fuera = [...await api.categoriasDeOferta(t.prestador)];
    });
    expect(dentro).toEqual(ordenados(t.A1, t.A));
    expect(fuera).toEqual([]);
  });
});
