import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { setTimeout as esperar } from 'node:timers/promises';
import { persistencia002, persistenciaFundacional } from '../../../src/composicion/persistencia.js';
import { IdempotenciaPostgres } from '../../../src/compartido/infraestructura/idempotencia.js';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { RevisionDeOfertaPostgres } from '../../../src/modulos/catalogo/infraestructura/persistencia/revision-de-oferta.js';
import { ProyeccionPublicaPostgres } from '../../../src/modulos/catalogo/infraestructura/persistencia/proyeccion-publica.js';
import { ordenBloqueosOferta } from '../../../src/modulos/catalogo/api-publica.js';
import { distritosCanonicos } from '../../../src/modulos/catalogo/dominio/clasificacion.js';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import { baseAislada002 } from '../../soporte/prestadores-catalogo/postgres.js';
import { datasetFicticio002 } from '../../soporte/prestadores-catalogo/dataset-ficticio.js';

const dataset = datasetFicticio002('HU03');
const [raiz, hija] = dataset.clasificaciones;
let aislada: Awaited<ReturnType<typeof baseAislada002>>;
let db: ReturnType<typeof persistencia002>;
let uow: UnidadDeTrabajoPostgres;
let revision: RevisionDeOfertaPostgres;
let proyeccion: ProyeccionPublicaPostgres;

beforeAll(async () => {
  aislada = await baseAislada002();
  db = persistencia002(aislada.url);
  await db.initialize();
  await db.runMigrations({ transaction: 'each' });
  uow = new UnidadDeTrabajoPostgres(db);
  revision = new RevisionDeOfertaPostgres(uow);
  proyeccion = new ProyeccionPublicaPostgres(uow);
});
afterAll(async () => { try { if (db?.isInitialized) await db.destroy(); } finally { await aislada?.cerrar(); } });

test('migra de 001 a 002 preservando el esquema y las ocho migraciones existentes', async () => {
  const temporal = await baseAislada002();
  const base = persistenciaFundacional(temporal.url);
  const completa = persistencia002(temporal.url);
  const esquema = `SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns
    WHERE table_schema='public' AND left(table_name,9)<>'catalogo_' ORDER BY table_name,ordinal_position`;
  const opcionales = ['synchronize', 'migrationsTransactionMode'] as const;
  try {
    await base.initialize();
    expect(await base.runMigrations()).toHaveLength(8);
    const antes = await base.query(esquema);
    const migraciones = await base.query('SELECT name FROM migrations ORDER BY id');
    expect(base.options.synchronize).toBe(false);
    for (const k of opcionales) expect(completa.options[k]).toBe(base.options[k]);
    expect(completa.options.extra).toEqual(base.options.extra);
    await completa.initialize();
    expect((await completa.runMigrations()).map(m => m.timestamp)).toEqual([1795000000001, 1795000000002, 1795000000003]);
    expect(await completa.runMigrations()).toEqual([]);
    expect(await completa.query(esquema)).toEqual(antes);
    expect(await completa.query('SELECT name FROM migrations ORDER BY id LIMIT 8')).toEqual(migraciones);
    expect(await base.showMigrations()).toBe(false);
  } finally {
    try { if (completa.isInitialized) await completa.destroy(); if (base.isInitialized) await base.destroy(); }
    finally { await temporal.cerrar(); }
  }
});

test('siembra cinco distritos y PostgreSQL rechaza nietos y cambios de padre', async () => {
  const filas: { codigo: string; etiqueta: string }[] = await db.query('SELECT codigo,etiqueta FROM catalogo_distritos ORDER BY orden');
  expect(filas.map(f => [f.codigo, f.etiqueta])).toEqual(Object.entries(distritosCanonicos));
  const insertar = 'INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id) VALUES ($1,$2::varchar,$2::text,$3,$4)';
  await db.query(insertar, [raiz.id, raiz.nombre, 1, null]);
  await db.query(insertar, [hija.id, hija.nombre, 2, raiz.id]);
  const otro = '00000000-0000-4000-8000-000000000299';
  await db.query(insertar, [otro, 'Otra raíz de prueba', 1, null]);
  await expect(db.query(insertar, ['00000000-0000-4000-8000-000000000298', 'Nieto', 2, hija.id])).rejects.toMatchObject({ code: '23503' });
  await expect(db.query('UPDATE catalogo_clasificaciones SET categoria_padre_id=$1 WHERE id=$2', [otro, hija.id])).rejects.toMatchObject({ code: '23514' });
  expect(await db.query('SELECT DISTINCT activa FROM catalogo_clasificaciones')).toEqual([{ activa: false }]);
});

test('serializa el bloqueo de revisión y revierte proyección y revisión juntas', async () => {
  expect(ordenBloqueosOferta.slice(0, 4)).toEqual(['permiso-rf39', 'idempotencia', 'revision-oferta', 'clasificacion-raiz']);
  const anterior = await revision.vigente();
  const perfil = { ...dataset.perfiles[0], publicable: true, correo: 'privado@example.invalid', objetoClave: 'objeto-privado' };
  await expect(uow.ejecutar(async tx => {
    await revision.bloquear(tx, 'exclusivo');
    await proyeccion.actualizar(tx, perfil);
    await revision.incrementar(tx);
    throw new ErrorAplicacion(409, 'PRUEBA_ROLLBACK', 'Prueba de reversión.');
  })).rejects.toMatchObject({ codigo: 'PRUEBA_ROLLBACK' });
  expect(await revision.vigente()).toBe(anterior);
  expect(await db.query('SELECT * FROM catalogo_proyeccion_prestadores')).toEqual([]);

  const tomada = Promise.withResolvers<void>();
  const liberar = Promise.withResolvers<void>();
  const lectora = uow.ejecutar(async tx => {
    try { expect(await revision.bloquear(tx, 'compartido')).toBe(anterior); tomada.resolve(); }
    catch (error) { tomada.reject(error); throw error; }
    await liberar.promise;
  });
  try {
    await tomada.promise;
    const escritura = uow.ejecutar(async tx => {
      await revision.bloquear(tx, 'exclusivo');
      await proyeccion.actualizar(tx, perfil);
      return revision.incrementar(tx);
    });
    try {
      expect(await Promise.race([esperar(100, 'espera'), escritura])).toBe('espera');
      expect(await revision.vigente()).toBe(anterior);
    } finally { liberar.resolve(); await escritura; }
  } finally { liberar.resolve(); await lectora; }
  expect(await revision.vigente()).toBe(anterior + 1n);
  expect(await db.query('SELECT * FROM catalogo_proyeccion_prestadores')).toEqual([{
    prestador_id: perfil.prestadorId, nombre_publico: perfil.nombrePublico, tipo: perfil.tipo,
    disponibilidad_declarada: perfil.disponibilidadDeclarada, especialidades: [...perfil.especialidades], distritos: [...perfil.distritos], publicable: true,
  }]);
});

test('idempotencia 002 aísla PUT y DELETE y revalida permisos antes de un replay', async () => {
  const idempotencia = new IdempotenciaPostgres(uow, new Map([['prueba', Buffer.alloc(32, 1)]]), 'prueba');
  let autorizada = true;
  let escrituras = 0;
  const actor = dataset.cuentas.prestador.id;
  const solicitud = { actor, metodo: 'PUT', rutaLogica: '/trabajos/{id}/fotografia', clave: 'idempotencia-002-prueba', ids: { id: raiz.id },
    version: 1, cuerpo: { uno: 'A', dos: 'B' }, fotografia: Buffer.from('foto sintética 002'),
    autorizar: async () => {
      if (!autorizada) throw new ErrorAplicacion(403, 'SIN_PERMISO', 'Permiso revocado.');
      return actor;
    } } as const;
  const trabajo = async () => { escrituras++; return { http: 200, cuerpo: { id: 'confirmada' } }; };
  const confirmadas = await Promise.all([idempotencia.ejecutar002(solicitud, trabajo),
    idempotencia.ejecutar002({ ...solicitud, cuerpo: { dos: 'B', uno: 'A' } }, trabajo)]);
  expect(confirmadas[0]).toEqual(confirmadas[1]);
  expect(escrituras).toBe(1);
  for (const cambio of [{ version: 2 }, { cuerpo: { uno: 'D' } }, { fotografia: Buffer.from('diferente') }, { ids: { id: hija.id } }]) {
    await expect(idempotencia.ejecutar002({ ...solicitud, ...cambio }, trabajo)).rejects.toMatchObject({ http: 409, codigo: 'CLAVE_IDEMPOTENCIA_REUTILIZADA' });
  }
  await idempotencia.ejecutar002({ ...solicitud, metodo: 'DELETE' }, trabajo);
  await idempotencia.ejecutar002({ ...solicitud, actor: hija.id, autorizar: async () => hija.id }, trabajo);
  await expect(idempotencia.ejecutar002({ ...solicitud, clave: 'intento-002-rollback' }, async () => {
    throw new ErrorAplicacion(409, 'PRUEBA_ROLLBACK', 'Prueba de reversión.');
  })).rejects.toMatchObject({ codigo: 'PRUEBA_ROLLBACK' });
  expect(await db.query('SELECT DISTINCT ambito FROM claves_idempotencia')).toEqual(expect.arrayContaining([
    { ambito: `oferta002:${actor}` }, { ambito: `oferta002:${hija.id}` },
  ]));
  expect(await db.query("SELECT clave FROM claves_idempotencia WHERE clave='intento-002-rollback'")).toEqual([]);
  expect(await db.query("SELECT DISTINCT http, estado FROM claves_idempotencia WHERE clave='idempotencia-002-prueba'")).toEqual([{ http: 200, estado: 'confirmada' }]);
  autorizada = false;
  await expect(idempotencia.ejecutar002(solicitud, trabajo)).rejects.toMatchObject({ http: 403, codigo: 'SIN_PERMISO' });
  expect(escrituras).toBe(3);
});

test('la idempotencia persiste el código HTTP confirmado, lo repite y rechaza resultados no confirmados', async () => {
  const idempotencia = new IdempotenciaPostgres(uow, new Map([['prueba', Buffer.alloc(32, 1)]]), 'prueba');
  const actor = dataset.cuentas.prestador.id;
  const solicitud = { actor, metodo: 'POST', rutaLogica: '/servicios', clave: 'idempotencia-http-201-prueba', ids: {},
    cuerpo: { titulo: 'A' }, autorizar: async () => actor } as const;
  let escrituras = 0;
  const trabajo = async () => { escrituras++; return { http: 201, cuerpo: { id: 'creado' } }; };
  const primera = await idempotencia.ejecutar002(solicitud, trabajo);
  const repetida = await idempotencia.ejecutar002(solicitud, trabajo);
  expect(primera).toEqual({ http: 201, cuerpo: { id: 'creado' } });
  expect(repetida).toEqual(primera);
  expect(escrituras).toBe(1);
  expect(await db.query("SELECT http, estado, resultado FROM claves_idempotencia WHERE clave='idempotencia-http-201-prueba'"))
    .toEqual([{ http: 201, estado: 'confirmada', resultado: { id: 'creado' } }]);
  await expect(idempotencia.ejecutar002({ ...solicitud, clave: 'idempotencia-http-500-prueba' }, async () => ({ http: 500, cuerpo: {} }))).rejects.toThrow();
  expect(await db.query("SELECT 1 FROM claves_idempotencia WHERE clave='idempotencia-http-500-prueba'")).toEqual([]);
});
