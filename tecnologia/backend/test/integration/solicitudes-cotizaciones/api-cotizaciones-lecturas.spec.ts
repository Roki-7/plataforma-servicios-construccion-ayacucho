import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { persistencia003 } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { aplicarMigraciones003, persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { ApiCotizaciones } from '../../../src/modulos/cotizaciones/api-publica.js';
import { AutoriaPostgres } from '../../../src/modulos/cotizaciones/infraestructura/persistencia/autoria.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';
import { ContadorSentencias } from '../../soporte/solicitudes-cotizaciones/contador-sentencias.js';

// Lecturas de autoría de Cotizaciones para Solicitudes (T032): resolver interesados y el título (c). Base descartable `ayacucho_003_test_*`.
let base: Awaited<ReturnType<typeof baseAislada003>>;
let db: DataSource; let uow: UnidadDeTrabajoPostgres; let api: ApiCotizaciones; let contador: ContadorSentencias;
const uuid = () => randomUUID();

async function cotizacion(solicitudId: string, cuentaId: string, estado: 'ACTIVA' | 'RETIRADA' = 'ACTIVA') {
  await db.query(`INSERT INTO cotizaciones (id,solicitud_id,prestador_id,prestador_cuenta_id,estado,retirada_en) VALUES ($1,$2,$3,$4,$5,$6)`,
    [uuid(), solicitudId, uuid(), cuentaId, estado, estado === 'RETIRADA' ? new Date().toISOString() : null]);
}
const instantanea = async () => Object.fromEntries(await Promise.all((await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1") as { table_name: string }[])
  .map(async ({ table_name }) => [table_name, Number(((await db.query(`SELECT count(*)::int AS n FROM "${table_name}"`)) as { n: number }[])[0]!.n)] as const)));

beforeAll(async () => {
  base = await baseAislada003(); await aplicarMigraciones003(base.url);
  db = persistencia003(base.url, persistenciaOferta002, persistenciaOferta003); await db.initialize();
  uow = new UnidadDeTrabajoPostgres(db); api = new ApiCotizaciones(new AutoriaPostgres(uow));
  contador = new ContadorSentencias().instalar(db);
}, 180000);
afterAll(async () => { contador?.liberar(); if (db?.isInitialized) await db.destroy(); await base?.cerrar(); });

describe('autoresNoRetirados', () => {
  test('devuelve las cuentas distintas con una cotización no retirada, en orden estable, y excluye a quien retiró', async () => {
    const s = uuid(); const [a, b, c, retirada] = [uuid(), uuid(), uuid(), uuid()];
    await cotizacion(s, b); await cotizacion(s, a); await cotizacion(s, c); await cotizacion(s, retirada, 'RETIRADA');
    expect(await api.autoresNoRetirados(s)).toEqual([a, b, c].sort());
  });
  test('quien retiró y volvió a cotizar figura una sola vez', async () => {
    const s = uuid(); const a = uuid();
    await cotizacion(s, a, 'RETIRADA'); await cotizacion(s, a); await cotizacion(s, a, 'RETIRADA');
    expect(await api.autoresNoRetirados(s)).toEqual([a]);
  });
  test('no mezcla solicitudes y devuelve vacío si no hay cotizaciones o el identificador no es válido', async () => {
    const s1 = uuid(); const s2 = uuid(); const a = uuid(); const b = uuid();
    await cotizacion(s1, a); await cotizacion(s2, b);
    expect(await api.autoresNoRetirados(s1)).toEqual([a]);
    expect(await api.autoresNoRetirados(uuid())).toEqual([]);
    expect(await api.autoresNoRetirados('no-es-uuid')).toEqual([]);
  });
});

describe('solicitudesConCotizacionNoRetirada', () => {
  test('devuelve las solicitudes donde la cuenta tiene una cotización no retirada, sin repetir y en orden estable', async () => {
    const cuenta = uuid(); const [s1, s2, s3, s4] = [uuid(), uuid(), uuid(), uuid()];
    await cotizacion(s1, cuenta); await cotizacion(s2, cuenta); await cotizacion(s3, cuenta, 'RETIRADA'); await cotizacion(s4, uuid());
    await cotizacion(s2, cuenta, 'RETIRADA');
    expect(await api.solicitudesConCotizacionNoRetirada(cuenta)).toEqual([s1, s2].sort());
  });
  test('una cuenta sin cotizaciones o un identificador inválido devuelven vacío', async () => {
    expect(await api.solicitudesConCotizacionNoRetirada(uuid())).toEqual([]);
    expect(await api.solicitudesConCotizacionNoRetirada('x')).toEqual([]);
  });
});

describe('tieneNoRetirada (título c)', () => {
  test('es verdadero solo con una cotización no retirada de esa cuenta sobre esa solicitud', async () => {
    const s = uuid(); const autora = uuid(); const retirada = uuid(); const ajena = uuid();
    await cotizacion(s, autora); await cotizacion(s, retirada, 'RETIRADA'); await cotizacion(uuid(), ajena);
    expect(await api.tieneNoRetirada(s, autora)).toBe(true);
    expect(await api.tieneNoRetirada(s, retirada)).toBe(false);
    expect(await api.tieneNoRetirada(s, ajena)).toBe(false);
    expect(await api.tieneNoRetirada(uuid(), autora)).toBe(false);
    expect(await api.tieneNoRetirada('x', autora)).toBe(false);
  });
});

describe('transacción, sentencias y alcance', () => {
  test('con la transacción del llamador ve sus cambios sin confirmar y sin ella no', async () => {
    const s = uuid(); const a = uuid(); let dentro = false; let fuera = true; let autores: readonly string[] = [];
    await uow.ejecutar(async (tx) => {
      await uow.runner(tx).query(`INSERT INTO cotizaciones (id,solicitud_id,prestador_id,prestador_cuenta_id,estado) VALUES ($1,$2,$3,$4,'ACTIVA')`, [uuid(), s, uuid(), a]);
      dentro = await api.tieneNoRetirada(s, a, tx); fuera = await api.tieneNoRetirada(s, a); autores = await api.autoresNoRetirados(s, tx);
    });
    expect([dentro, fuera, autores]).toEqual([true, false, [a]]);
  });
  test('cada llamada es una sola sentencia de solo lectura sobre la tabla de Cotizaciones, con cualquier volumen', async () => {
    const s = uuid(); const cuenta = uuid();
    for (let i = 0; i < 30; i += 1) await cotizacion(s, uuid());
    for (let i = 0; i < 10; i += 1) await cotizacion(uuid(), cuenta);
    const antes = await instantanea();
    const r = await contador.contar(async () => {
      await api.autoresNoRetirados(s);
      await api.solicitudesConCotizacionNoRetirada(cuenta);
      await api.tieneNoRetirada(s, cuenta);
    });
    expect(r.total).toBe(3);
    for (const sentencia of r.sentencias) {
      expect(sentencia).toMatch(/^SELECT /i);
      expect(sentencia).not.toMatch(/\b(INSERT|UPDATE|DELETE|LOCK|FOR UPDATE|FOR SHARE)\b/i);
      for (const tabla of [...sentencia.matchAll(/\b(?:FROM|JOIN)\s+(\w+)/gi)].map(m => m[1])) expect(tabla).toBe('cotizaciones');
    }
    expect(await instantanea()).toEqual(antes);
  });
  test('una lista sin elementos o un identificador inválido no ejecutan ninguna sentencia', async () => {
    const r = await contador.contar(async () => { await api.autoresNoRetirados('x'); await api.solicitudesConCotizacionNoRetirada('x'); await api.tieneNoRetirada('x', 'y'); });
    expect(r.total).toBe(0);
  });
  test('la respuesta contiene solo identificadores: ni precios, ni textos ni datos de contacto', async () => {
    const s = uuid(); const a = uuid(); await cotizacion(s, a);
    const valores = [...await api.autoresNoRetirados(s), ...await api.solicitudesConCotizacionNoRetirada(a)];
    for (const v of valores) expect(v).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
