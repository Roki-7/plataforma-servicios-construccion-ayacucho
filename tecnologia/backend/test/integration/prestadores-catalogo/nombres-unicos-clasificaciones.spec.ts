import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { persistencia002 } from '../../../src/composicion/persistencia.js';
import { normalizarNombre } from '../../../src/modulos/catalogo/dominio/gestion-clasificaciones.js';
import { baseAislada002 } from '../../soporte/prestadores-catalogo/postgres.js';
import { VECTORES_NORMALIZACION } from '../../soporte/prestadores-catalogo/vectores-normalizacion.js';

/** INC-002-01 contra PostgreSQL real, en bases descartables creadas por el arnés. Nunca toca `ayacucho_002_validacion`. */
let aislada: Awaited<ReturnType<typeof baseAislada002>>;
let db: ReturnType<typeof persistencia002>;
const q = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await db.query(sql, p)) as T[];
const insertar = (nombre: string, padre: string | null = null, activa = false, id = randomUUID()) =>
  q('INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id,activa) VALUES($1,$2::varchar,$3,$4,$5,$6)', [id, nombre, `heredado-${id}`, padre ? 2 : 1, padre, activa]).then(() => id);
const fallo = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as { driverError?: { code?: string; constraint?: string; detail?: string }; message: string }; } throw new Error('Debía fallar.'); };
const clave = async (n: string) => (await q<{ k: string }>('SELECT catalogo_clave_nombre($1::text) AS k', [n]))[0]!.k;

beforeAll(async () => {
  aislada = await baseAislada002(); db = persistencia002(aislada.url, persistenciaOferta002); await db.initialize(); await db.runMigrations({ transaction: 'each' });
}, 120000);
afterAll(async () => { try { if (db?.isInitialized) await db.destroy(); } finally { await aislada?.cerrar(); } });

describe('la función catalogo_clave_nombre es inmutable y segura para una columna generada', () => {
  test('versión real de PostgreSQL y configuración regional de la base (evidencia)', async () => {
    const [v] = await q<{ version: string; num: string; enc: string; ctype: string; collate: string; prov: string }>(
      `SELECT version() AS version, current_setting('server_version_num') AS num, pg_encoding_to_char(encoding) AS enc, datctype AS ctype, datcollate AS collate, datlocprovider::text AS prov
       FROM pg_database WHERE datname = current_database()`);
    expect(Number(v!.num)).toBeGreaterThanOrEqual(150000);
    expect(v!.enc).toBe('UTF8');
    console.info(`INC-002-01 evidencia: ${v!.version} | codificación ${v!.enc} | ctype ${v!.ctype} | collate ${v!.collate} | proveedor ${v!.prov}`);
  });

  test('está declarada IMMUTABLE, STRICT y PARALLEL SAFE, y todas sus dependencias directas son inmutables de pg_catalog', async () => {
    const [f] = await q<{ provolatile: string; proisstrict: boolean; proparallel: string; prosqlbody: unknown }>(
      "SELECT provolatile, proisstrict, proparallel, prosqlbody IS NOT NULL AS prosqlbody FROM pg_proc WHERE proname='catalogo_clave_nombre'");
    expect(f).toMatchObject({ provolatile: 'i', proisstrict: true, proparallel: 's', prosqlbody: true });
    // Las funciones fijadas de pg_catalog no se registran en pg_depend: se verifica que no depende de ningún objeto de usuario y se leen los nombres del cuerpo.
    const refs = await q<{ clase: string; nombre: string | null }>(`SELECT d.refclassid::regclass::text AS clase,
      CASE d.refclassid::regclass::text WHEN 'pg_namespace' THEN (SELECT nspname FROM pg_namespace WHERE oid=d.refobjid) WHEN 'pg_collation' THEN (SELECT collname FROM pg_collation WHERE oid=d.refobjid) END AS nombre
      FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid='catalogo_clave_nombre(text)'::regprocedure AND d.deptype='n'`);
    console.info(`INC-002-01 dependencias registradas en pg_depend: ${JSON.stringify(refs)}`);
    for (const r of refs) expect(['pg_namespace', 'pg_collation']).toContain(r.clase); // ninguna tabla, función ni extensión de usuario
    const [{ def }] = await q<{ def: string }>("SELECT pg_get_functiondef('catalogo_clave_nombre(text)'::regprocedure) AS def") as [{ def: string }];
    const cuerpo = def.slice(def.indexOf('\n')); // sin la cabecera CREATE FUNCTION
    const usadas = [...new Set([...cuerpo.matchAll(/\b([A-Za-z_]+)\(/g)].map(m => m[1]!.toLowerCase()))].sort();
    expect(usadas).toEqual(['btrim', 'lower', 'normalize', 'regexp_replace']);
    const vol = await q<{ proname: string; n: string; provolatile: string }>(
      "SELECT p.proname, n.nspname AS n, p.provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='pg_catalog' AND p.proname = ANY($1) ORDER BY 1, p.oid", [usadas]);
    expect(vol.length).toBeGreaterThanOrEqual(4);
    for (const d of vol) expect([d.proname, d.provolatile]).toEqual([d.proname, 'i']);
    console.info(`INC-002-01 funciones del cuerpo (todas pg_catalog): ${[...new Set(vol.map(v => `${v.proname}=${v.provolatile}`))].join(', ')} | ${cuerpo.length} caracteres de cuerpo`);
  });

  test('PostgreSQL acepta la columna generada y rechaza una variante STABLE (la comprobación de inmutabilidad es real)', async () => {
    await q('CREATE TABLE prueba_inmutable (n text)');
    await q("CREATE FUNCTION prueba_estable(x text) RETURNS text LANGUAGE sql STABLE RETURN x || current_setting('TimeZone')");
    const e = await fallo(q('ALTER TABLE prueba_inmutable ADD COLUMN k text GENERATED ALWAYS AS (prueba_estable(n)) STORED'));
    expect(e.driverError?.code).toBe('42P17');
    await q('ALTER TABLE prueba_inmutable ADD COLUMN k text GENERATED ALWAYS AS (catalogo_clave_nombre(n)) STORED');
    await q('DROP TABLE prueba_inmutable; DROP FUNCTION prueba_estable(text)');
  });

  test('el resultado no depende de search_path, standard_conforming_strings, TimeZone ni lc_messages', async () => {
    const entradas = VECTORES_NORMALIZACION.map(v => v[1]);
    const base = await Promise.all(entradas.map(clave));
    const cliente = await db.createQueryRunner();
    try {
      for (const ajuste of ["SET search_path = ''", 'SET standard_conforming_strings = off', "SET TimeZone = 'Asia/Tokyo'", "SET lc_messages = 'C'", "SET extra_float_digits = 3"]) {
        await cliente.query(ajuste);
        const otra = [] as string[];
        for (const n of entradas) otra.push(((await cliente.query('SELECT public.catalogo_clave_nombre($1::text) AS k', [n])) as { k: string }[])[0]!.k);
        expect([ajuste, otra]).toEqual([ajuste, base]);
        await cliente.query('RESET ALL');
      }
    } finally { await cliente.release(); }
  });

  test('paridad: la función de PostgreSQL y normalizarNombre coinciden en todos los vectores', async () => {
    const diferencias: unknown[] = [];
    for (const [caso, entrada] of VECTORES_NORMALIZACION) {
      const pg = await clave(entrada); const app = normalizarNombre(entrada);
      if (pg !== app) diferencias.push({ caso, pg, app });
    }
    expect(diferencias).toEqual([]);
  });

  test('paridad ampliada con las palabras de la propuesta del catálogo y variantes combinadas', async () => {
    const palabras = ['Albañilería', 'Carpintería', 'Cañería y gasfitería', 'Ñawpa Wasi', 'Pachamama', "Q'ero", 'Allpa Ñan', 'Instalación eléctrica', 'Ingeniería civil', 'Cimentación y excavación',
      '  ÁÉÍÓÚ ÀÈÌÒÙ ÄËÏÖÜ ÂÊÎÔÛ ', 'Ø ß Æ œ', 'ÑAÑO', 'Mañana\u00a0y\u2003tarde', 'A\u030a\u0301', 'n\u0303\u0301'];
    for (const p of palabras) expect([p, await clave(p)]).toEqual([p, normalizarNombre(p)]);
  });
});

describe('columna generada e índice único entre hermanas', () => {
  test('el índice es único, cubre inactivas (sin WHERE) y usa NULLS NOT DISTINCT', async () => {
    const [i] = await q<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE indexname='catalogo_clasificaciones_hermanas_clave'");
    expect(i!.indexdef).toMatch(/CREATE UNIQUE INDEX/); expect(i!.indexdef).toMatch(/\(categoria_padre_id, nombre_clave\) NULLS NOT DISTINCT/); expect(i!.indexdef).not.toMatch(/WHERE/);
    const [c] = await q<{ generado: string; nulo: string }>("SELECT is_generated AS generado, is_nullable AS nulo FROM information_schema.columns WHERE table_name='catalogo_clasificaciones' AND column_name='nombre_clave'");
    expect(c).toEqual({ generado: 'ALWAYS', nulo: 'NO' });
  });

  test('las raíces compiten entre sí, incluso inactivas, y la violación es 23505 sobre el índice de hermanas', async () => {
    await insertar('Pintura', null, false);
    for (const n of ['pintura', 'PINTURA ', 'Pintúra', ' Pintura\u00a0']) {
      const e = await fallo(insertar(n, null, true));
      expect(e.driverError).toMatchObject({ code: '23505', constraint: 'catalogo_clasificaciones_hermanas_clave' });
    }
    expect(await q('SELECT 1 FROM catalogo_clasificaciones WHERE nombre_clave = $1', ['pintura'])).toHaveLength(1);
  });

  test('ñ y n son claves distintas; el mismo nombre bajo padres distintos y entre raíz y subcategoría es válido', async () => {
    await insertar('Año'); await insertar('Ano');
    const a = await insertar('Acabados'); const b = await insertar('Estructuras');
    await insertar('Otros', a); await insertar('Otros', b); await insertar('Acabados', b);
    const e = await fallo(insertar('OTROS', a)); expect(e.driverError?.code).toBe('23505');
    expect((await fallo(insertar('AÑO'))).driverError?.code).toBe('23505');
  });

  test('renombrar a un nombre equivalente de una hermana falla; renombrar a una variante propia o a un nombre libre funciona; la clave se recalcula', async () => {
    const a = await insertar('Plomería'); const b = await insertar('Gasfitería');
    expect((await fallo(q('UPDATE catalogo_clasificaciones SET nombre=$2::varchar WHERE id=$1', [b, ' PLOMERIA']))).driverError?.code).toBe('23505');
    await q('UPDATE catalogo_clasificaciones SET nombre=$2::varchar WHERE id=$1', [a, 'PLOMERÍA']);
    expect((await q<{ nombre_clave: string }>('SELECT nombre_clave FROM catalogo_clasificaciones WHERE id=$1', [a]))[0]!.nombre_clave).toBe('plomeria');
    await q('UPDATE catalogo_clasificaciones SET nombre=$2::varchar WHERE id=$1', [b, 'Gasfitería y sanitarios']);
    expect((await q<{ nombre_clave: string }>('SELECT nombre_clave FROM catalogo_clasificaciones WHERE id=$1', [b]))[0]!.nombre_clave).toBe('gasfiteria y sanitarios');
  });

  test('la columna generada no admite escritura directa y nombre_normalizado heredado no influye en la unicidad', async () => {
    expect((await fallo(q("INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,nombre_clave) VALUES($1,'Z','z',1,'z')", [randomUUID()]))).driverError?.code).toBe('428C9');
    const id1 = await insertar('Heredado uno'); const id2 = await insertar('Heredado dos');
    await q("UPDATE catalogo_clasificaciones SET nombre_normalizado='igual' WHERE id IN ($1,$2)", [id1, id2]);
    await q("UPDATE catalogo_clasificaciones SET nombre_normalizado='construcción' WHERE id=$1", [id1]);
  });

  test('las semillas de 002 (nombre_normalizado con tilde) son compatibles: no hay colisiones entre hermanas', async () => {
    await q("INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel) VALUES($1,'Construcción',lower('Construcción'),1)", [randomUUID()]);
    expect(await q<{ n: string }>("SELECT nombre_clave AS n FROM catalogo_clasificaciones WHERE nombre='Construcción'")).toEqual([{ n: 'construccion' }]);
  });
});

describe('la migración se detiene ante duplicados y es reversible', () => {
  test('con duplicados preexistentes falla sin modificar datos y lista los identificadores; limpiados, se aplica', async () => {
    const otra = await baseAislada002(); const ds = persistencia002(otra.url, persistenciaOferta002); await ds.initialize();
    const consulta = async <T = Record<string, unknown>>(sql: string, p: unknown[] = []) => (await ds.query(sql, p)) as T[];
    try {
      await ds.runMigrations({ transaction: 'each' });
      await ds.undoLastMigration({ transaction: 'each' });
      expect(await consulta("SELECT 1 FROM pg_proc WHERE proname='catalogo_clave_nombre'")).toHaveLength(0);
      const [d1, d2, ok] = [randomUUID(), randomUUID(), randomUUID()];
      for (const [id, n] of [[d1, 'Duplicada'], [d2, 'DUPLICADA '], [ok, 'Única']] as const) await consulta("INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel) VALUES($1,$2::varchar,'x',1)", [id, n]);
      const antes = await consulta('SELECT id,nombre,nombre_normalizado,activa,version FROM catalogo_clasificaciones ORDER BY id');
      const e = await fallo(ds.runMigrations({ transaction: 'each' }));
      expect(e.message).toMatch(/INC-002-01/); expect(e.message + (e.driverError?.detail ?? '')).toContain(d1); expect(e.message + (e.driverError?.detail ?? '')).toContain(d2);
      expect(await consulta('SELECT id,nombre,nombre_normalizado,activa,version FROM catalogo_clasificaciones ORDER BY id')).toEqual(antes);
      expect(await consulta("SELECT 1 FROM pg_proc WHERE proname='catalogo_clave_nombre'")).toHaveLength(0);
      expect(await consulta("SELECT 1 FROM information_schema.columns WHERE table_name='catalogo_clasificaciones' AND column_name='nombre_clave'")).toHaveLength(0);
      await consulta('UPDATE catalogo_clasificaciones SET nombre=$2::varchar WHERE id=$1', [d2, 'Duplicada renombrada']);
      expect(await ds.runMigrations({ transaction: 'each' })).toHaveLength(1);
      expect(await consulta('SELECT count(*)::int AS n FROM catalogo_clasificaciones')).toEqual([{ n: 3 }]);
      await ds.undoLastMigration({ transaction: 'each' });
      expect(await consulta("SELECT 1 FROM pg_indexes WHERE indexname='catalogo_clasificaciones_hermanas_clave'")).toHaveLength(0);
      expect(await consulta('SELECT count(*)::int AS n FROM catalogo_clasificaciones')).toEqual([{ n: 3 }]);
      expect(await ds.runMigrations({ transaction: 'each' })).toHaveLength(1);
    } finally { try { if (ds.isInitialized) await ds.destroy(); } finally { await otra.cerrar(); } }
  }, 120000);
});
