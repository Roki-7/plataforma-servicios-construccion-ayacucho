import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import type { DataSource } from 'typeorm';
import { persistencia003 } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { aplicarMigraciones003, persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import { conReintentoDeConcurrencia, traducirConflictoReintentable } from '../../../src/compartido/aplicacion/reintento-concurrencia.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';

// FR-346 / CA-ERR-02 con la unidad de trabajo real y un interbloqueo real de PostgreSQL (40P01). Demuestra el punto de integración:
// `UnidadDeTrabajoPostgres` convierte en 503 genérico todo error que no sea `ErrorAplicacion`, así que la traducción debe hacerse DENTRO del trabajo.
let base: Awaited<ReturnType<typeof baseAislada003>>;
let db: DataSource; let uow: UnidadDeTrabajoPostgres;

beforeAll(async () => {
  base = await baseAislada003(); await aplicarMigraciones003(base.url);
  db = persistencia003(base.url, persistenciaOferta002, persistenciaOferta003); await db.initialize();
  uow = new UnidadDeTrabajoPostgres(db);
}, 180000);
afterAll(async () => { if (db?.isInitialized) await db.destroy(); await base?.cerrar(); });

/** Dos trabajos que toman dos bloqueos en orden opuesto, con una barrera que garantiza el interbloqueo en el primer intento. */
function parDeInterbloqueo(traducir: boolean) {
  let llegados = 0; let abrir!: () => void; const barrera = new Promise<void>(r => { abrir = r; });
  const intentos = { a: 0, b: 0 };
  const trabajo = (nombre: 'a' | 'b', primero: number, segundo: number) => async () => {
    const intento = intentos[nombre]++;
    return uow.ejecutar(async (tx) => {
      try {
        await uow.runner(tx).query('SELECT pg_advisory_xact_lock($1)', [primero]);
        if (intento === 0) { llegados += 1; if (llegados === 2) abrir(); await barrera; }
        await uow.runner(tx).query('SELECT pg_advisory_xact_lock($1)', [segundo]);
        return nombre;
      } catch (error) { throw traducir ? traducirConflictoReintentable(error) : error; }
    });
  };
  return { a: trabajo('a', 910001, 910002), b: trabajo('b', 910002, 910001), intentos };
}

describe('conflictos de concurrencia a través de la unidad de trabajo real', () => {
  test('sin traducir, el interbloqueo llega como 503 genérico y su código original se pierde (por eso se traduce dentro del trabajo)', async () => {
    const par = parDeInterbloqueo(false);
    const resultados = await Promise.allSettled([par.a(), par.b()]);
    const fallos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fallos).toHaveLength(1);
    expect(fallos[0]!.reason).toBeInstanceOf(ErrorAplicacion);
    expect(fallos[0]!.reason).toMatchObject({ http: 503, codigo: 'DEPENDENCIA_NO_DISPONIBLE' });
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  }, 60000);

  test('traducido dentro del trabajo y envuelto en el reintento, el interbloqueo se reintenta y ambas operaciones terminan', async () => {
    const par = parDeInterbloqueo(true);
    const resultados = await Promise.all([conReintentoDeConcurrencia(par.a), conReintentoDeConcurrencia(par.b)]);
    expect(resultados.sort()).toEqual(['a', 'b']);
    expect(par.intentos.a + par.intentos.b).toBe(3);
  }, 60000);

  test('un conflicto que persiste responde 409 CONFLICTO_CONCURRENTE tras tres intentos y no deja cambios', async () => {
    await db.query('CREATE TABLE IF NOT EXISTS prueba_reintento (id integer PRIMARY KEY)');
    let intentos = 0;
    const error = await conReintentoDeConcurrencia(() => uow.ejecutar(async (tx) => {
      intentos += 1;
      try {
        await uow.runner(tx).query('INSERT INTO prueba_reintento(id) VALUES (1)');
        throw Object.assign(new Error('deadlock detected'), { driverError: { code: '40P01' } });
      } catch (e) { throw traducirConflictoReintentable(e); }
    }), { dormir: async () => undefined }).catch((e: unknown) => e);
    expect(intentos).toBe(3);
    expect(error).toMatchObject({ http: 409, codigo: 'CONFLICTO_CONCURRENTE' });
    expect(Number(((await db.query('SELECT count(*)::int AS n FROM prueba_reintento')) as { n: number }[])[0]!.n)).toBe(0);
  }, 60000);

  test('un error inesperado dentro del trabajo no se reintenta y sigue siendo el 503 genérico, sin exponer detalles', async () => {
    let intentos = 0;
    const error = await conReintentoDeConcurrencia(() => uow.ejecutar(async (tx) => {
      intentos += 1;
      try { await uow.runner(tx).query('SELECT * FROM tabla_que_no_existe'); } catch (e) { throw traducirConflictoReintentable(e); }
    })).catch((e: unknown) => e);
    expect(intentos).toBe(1);
    expect(error).toMatchObject({ http: 503, codigo: 'DEPENDENCIA_NO_DISPONIBLE' });
    expect(String((error as Error).message)).not.toMatch(/tabla_que_no_existe|relation/i);
  }, 60000);
});
