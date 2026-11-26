import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import type { DataSource } from 'typeorm';
import { persistencia003 } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { aplicarMigraciones003, persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';

// Las migraciones 1796000000001 a 1796000000003 son aditivas, ordenadas, idempotentes y reversibles, y no alteran el esquema de 001 ni de 002.
let base: Awaited<ReturnType<typeof baseAislada003>>;
let db: DataSource;
const tablas = async () => (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1") as { table_name: string }[]).map(t => t.table_name);
const columnas = async (de: string[]) => db.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
  WHERE table_schema='public' AND table_name = ANY($1) ORDER BY 1, ordinal_position`, [de]) as Promise<unknown[]>;
const indices = async (de: string[]) => db.query('SELECT indexname, indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename = ANY($2) ORDER BY 1', ['public', de]) as Promise<unknown[]>;
const nuevas = ['solicitudes', 'solicitudes_versiones', 'solicitudes_bitacora', 'solicitudes_archivos', 'solicitudes_objetos_pendientes', 'cotizaciones', 'cotizaciones_versiones', 'cotizaciones_aclaraciones', 'avisos_negocio'];

beforeAll(async () => { base = await baseAislada003(); }, 60000);
afterAll(async () => { if (db?.isInitialized) await db.destroy(); await base?.cerrar(); });

describe('migraciones de la 003', () => {
  test('se aplican en orden sobre una base con la 001 y la 002, son idempotentes y solo añaden tablas propias', async () => {
    // Primero hasta la última de la 002 (sin las de la 003), para comparar el esquema anterior.
    const hasta002 = persistencia003(base.url, persistenciaOferta002, []);
    await hasta002.initialize(); await hasta002.runMigrations({ transaction: 'each' });
    const tablasAntes = (await hasta002.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1") as { table_name: string }[]).map(t => t.table_name);
    const esquemaAntes = await hasta002.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY 1, ordinal_position`) as unknown[];
    const indicesAntes = await hasta002.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1") as unknown[];
    await hasta002.destroy();

    expect(await aplicarMigraciones003(base.url)).toBe(3);
    expect(await aplicarMigraciones003(base.url)).toBe(0);
    db = persistencia003(base.url, persistenciaOferta002, persistenciaOferta003); await db.initialize();
    const despues = await tablas();
    expect(despues.filter(t => !tablasAntes.includes(t)).sort()).toEqual([...nuevas].sort());
    expect(await columnas(tablasAntes)).toEqual(esquemaAntes);
    expect(await indices(tablasAntes)).toEqual(indicesAntes);
  }, 180000);

  test('el orden registrado es 1796000000001, 1796000000002 y 1796000000003', async () => {
    const aplicadas = (await db.query("SELECT name FROM migrations WHERE name LIKE '%17960000000%' ORDER BY timestamp") as { name: string }[]).map(m => m.name);
    expect(aplicadas).toEqual(['Solicitudes1796000000001', 'Cotizaciones1796000000002', 'AvisosNegocio1796000000003']);
  });

  test('son reversibles: deshacer las tres retira solo sus tablas y funciones, y volver a aplicarlas las restaura', async () => {
    for (let i = 0; i < 3; i += 1) await db.undoLastMigration({ transaction: 'each' });
    const sin = await tablas();
    for (const t of nuevas) expect(sin).not.toContain(t);
    expect(sin).toContain('prestadores_perfiles');
    expect(sin).toContain('catalogo_servicios');
    expect(sin).toContain('avisos_pendientes');
    const funciones = (await db.query("SELECT proname FROM pg_proc WHERE proname LIKE 'solicitudes_%' OR proname LIKE 'cotizaciones_%'") as unknown[]);
    expect(funciones).toEqual([]);
    expect((await db.runMigrations({ transaction: 'each' })).length).toBe(3);
    expect((await tablas()).filter(t => nuevas.includes(t)).sort()).toEqual([...nuevas].sort());
  }, 120000);
});
