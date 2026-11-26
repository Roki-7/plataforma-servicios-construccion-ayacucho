import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { persistencia003 } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { aplicarMigraciones003, persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { AvisosNegocioPostgres } from '../../../src/modulos/notificaciones/infraestructura/avisos-negocio.js';
import type { AvisoNegocio, AvisosNegocioApi } from '../../../src/modulos/notificaciones/api-publica.js';
import { CifradoOutbox } from '../../../src/modulos/notificaciones/infraestructura/outbox.js';
import { WorkerCorreo } from '../../../src/modulos/notificaciones/infraestructura/worker-correo.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';
import { ContadorSentencias } from '../../soporte/solicitudes-cotizaciones/contador-sentencias.js';

// Registro atómico e idempotente de avisos de negocio (T020): FR-344 y FR-345. La entrega, la visualización y la lectura son de la 006.
let base: Awaited<ReturnType<typeof baseAislada003>>;
let db: DataSource; let uow: UnidadDeTrabajoPostgres; let api: AvisosNegocioApi; let contador: ContadorSentencias;

const aviso = (extra: Partial<AvisoNegocio> = {}): AvisoNegocio => ({ cuentaDestinatarioId: randomUUID(), tipo: 'SOLICITUD_CAMBIADA', solicitudId: randomUUID(), versionTrabajo: 2, ...extra });
const registrar = (avisos: readonly AvisoNegocio[]) => uow.ejecutar(tx => api.registrar(avisos, tx));
const total = async (tabla: string) => Number(((await db.query(`SELECT count(*)::int AS n FROM ${tabla}`)) as { n: number }[])[0]!.n);
const filas = (clave: string) => db.query('SELECT * FROM avisos_negocio WHERE clave_logica=$1', [clave]) as Promise<Record<string, unknown>[]>;
const codigoDe = async (promesa: Promise<unknown>) => (await promesa.then(() => undefined, (e: { code?: string; driverError?: { code?: string } }) => e.code ?? e.driverError?.code));
const insertarCrudo = (campos: { tipo?: string; estado?: string; version?: number | null; clave?: string }) => {
  const cuenta = randomUUID(); const solicitud = randomUUID(); const tipo = campos.tipo ?? 'SOLICITUD_CAMBIADA'; const version = campos.version === undefined ? 2 : campos.version;
  return db.query('INSERT INTO avisos_negocio (cuenta_destinatario_id,tipo,solicitud_id,version_trabajo,clave_logica,estado) VALUES ($1,$2,$3,$4,$5,$6)',
    [cuenta, tipo, solicitud, version, campos.clave ?? `${tipo}:${solicitud}:${version ?? 'cierre'}:${cuenta}`, campos.estado ?? 'REGISTRADO']);
};

beforeAll(async () => {
  base = await baseAislada003(); await aplicarMigraciones003(base.url);
  db = persistencia003(base.url, persistenciaOferta002, persistenciaOferta003); await db.initialize();
  uow = new UnidadDeTrabajoPostgres(db); api = new AvisosNegocioPostgres(uow);
  contador = new ContadorSentencias().instalar(db);
  await db.query('CREATE TABLE prueba_atomicidad (id uuid PRIMARY KEY)');
}, 180000);
afterAll(async () => { contador?.liberar(); if (db?.isInitialized) await db.destroy(); await base?.cerrar(); });

describe('tabla avisos_negocio', () => {
  test('solo guarda identificadores: sin texto libre, correo ni datos personales', async () => {
    const columnas = (await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='avisos_negocio' ORDER BY ordinal_position") as { column_name: string; data_type: string }[]);
    expect(columnas.map(c => c.column_name)).toEqual(['id', 'cuenta_destinatario_id', 'tipo', 'solicitud_id', 'version_trabajo', 'clave_logica', 'estado', 'creado_en']);
    expect(columnas.find(c => c.column_name === 'cuenta_destinatario_id')!.data_type).toBe('uuid');
    expect(columnas.find(c => c.column_name === 'solicitud_id')!.data_type).toBe('uuid');
  });
  test('los índices para la 006 existen', async () => {
    const indices = (await db.query("SELECT indexdef FROM pg_indexes WHERE tablename='avisos_negocio'") as { indexdef: string }[]).map(i => i.indexdef).join('\n');
    expect(indices).toMatch(/\(cuenta_destinatario_id, creado_en, id\)/);
    expect(indices).toMatch(/\(estado, creado_en\)/);
    expect(indices).toMatch(/UNIQUE INDEX .*\(clave_logica\)/);
  });
  test('PostgreSQL rechaza un tipo, un estado, una versión o una clave lógica que no corresponden', async () => {
    expect(await codigoDe(insertarCrudo({ tipo: 'CONTRATACION_CREADA' }))).toBe('23514');
    expect(await codigoDe(insertarCrudo({ estado: 'ENVIADO' }))).toBe('23514');
    expect(await codigoDe(insertarCrudo({ version: null }))).toBe('23514');
    expect(await codigoDe(insertarCrudo({ tipo: 'SOLICITUD_CERRADA', version: 3 }))).toBe('23514');
    expect(await codigoDe(insertarCrudo({ version: 0 }))).toBe('23514');
    expect(await codigoDe(insertarCrudo({ clave: 'cualquier-texto' }))).toBe('23514');
    expect(await codigoDe(insertarCrudo({ tipo: 'SOLICITUD_CERRADA', version: null }))).toBeUndefined();
    expect(await codigoDe(insertarCrudo({ tipo: 'SOLICITUD_DIRIGIDA_PUBLICADA', version: 1 }))).toBeUndefined();
  });
  test('la clave lógica es única', async () => {
    const cuenta = randomUUID(); const solicitud = randomUUID(); const clave = `SOLICITUD_CERRADA:${solicitud}:cierre:${cuenta}`;
    const insertar = () => db.query(`INSERT INTO avisos_negocio (cuenta_destinatario_id,tipo,solicitud_id,version_trabajo,clave_logica) VALUES ($1,'SOLICITUD_CERRADA',$2,NULL,$3)`, [cuenta, solicitud, clave]);
    await insertar();
    expect(await codigoDe(insertar())).toBe('23505');
  });
});

describe('registrar', () => {
  test('inserta un aviso REGISTRADO con la clave lógica tipo:solicitud:versión:cuenta', async () => {
    const a = aviso({ tipo: 'SOLICITUD_DIRIGIDA_PUBLICADA', versionTrabajo: 1 });
    expect(await registrar([a])).toBe(1);
    const [fila] = await filas(`SOLICITUD_DIRIGIDA_PUBLICADA:${a.solicitudId}:1:${a.cuentaDestinatarioId}`);
    expect(fila).toMatchObject({ cuenta_destinatario_id: a.cuentaDestinatarioId, tipo: 'SOLICITUD_DIRIGIDA_PUBLICADA', solicitud_id: a.solicitudId, version_trabajo: 1, estado: 'REGISTRADO' });
    expect(fila!['creado_en']).toBeInstanceOf(Date);
  });
  test('el cierre no lleva versión de trabajo y su clave lógica usa «cierre»', async () => {
    const a = aviso({ tipo: 'SOLICITUD_CERRADA', versionTrabajo: null });
    expect(await registrar([a])).toBe(1);
    const [fila] = await filas(`SOLICITUD_CERRADA:${a.solicitudId}:cierre:${a.cuentaDestinatarioId}`);
    expect(fila).toMatchObject({ tipo: 'SOLICITUD_CERRADA', version_trabajo: null });
  });
  test('es idempotente: repetir el mismo aviso, también en la misma lista, no duplica filas', async () => {
    const a = aviso();
    expect(await registrar([a])).toBe(1);
    expect(await registrar([a])).toBe(0);
    expect(await registrar([a, { ...a }, a])).toBe(0);
    const b = aviso();
    expect(await registrar([b, { ...b }])).toBe(1);
    expect(await total(`avisos_negocio WHERE solicitud_id IN ('${a.solicitudId}','${b.solicitudId}')`)).toBe(2);
  });
  test('un destinatario, una versión o un tipo distintos son avisos distintos', async () => {
    const solicitud = randomUUID(); const cuenta = randomUUID();
    const lote = [aviso({ solicitudId: solicitud, cuentaDestinatarioId: cuenta, versionTrabajo: 2 }), aviso({ solicitudId: solicitud, cuentaDestinatarioId: cuenta, versionTrabajo: 3 }),
      aviso({ solicitudId: solicitud, cuentaDestinatarioId: randomUUID(), versionTrabajo: 2 }), aviso({ solicitudId: solicitud, cuentaDestinatarioId: cuenta, tipo: 'SOLICITUD_CERRADA', versionTrabajo: null })];
    expect(await registrar(lote)).toBe(4);
    expect(await registrar(lote)).toBe(0);
  });
  test('un lote de N interesados se registra con una sola sentencia', async () => {
    const solicitud = randomUUID();
    const lote = Array.from({ length: 40 }, () => aviso({ solicitudId: solicitud }));
    const r = await contador.contar(() => registrar(lote));
    expect(r.resultado).toBe(40);
    expect(r.total).toBe(1);
    expect(r.sentencias[0]).toMatch(/^INSERT INTO avisos_negocio/);
    expect(r.sentencias[0]).toMatch(/ON CONFLICT \(clave_logica\) DO NOTHING/);
  });
  test('una lista vacía no ejecuta ninguna sentencia', async () => {
    const r = await contador.contar(() => registrar([]));
    expect(r.resultado).toBe(0);
    expect(r.total).toBe(0);
  });
  test('rechaza avisos mal formados antes de tocar la base de datos', async () => {
    const malos: AvisoNegocio[] = [aviso({ tipo: 'OTRO' as never }), aviso({ cuentaDestinatarioId: 'no-uuid' }), aviso({ solicitudId: 'no-uuid' }), aviso({ versionTrabajo: null }),
      aviso({ versionTrabajo: 0 }), aviso({ versionTrabajo: 1.5 }), aviso({ tipo: 'SOLICITUD_CERRADA', versionTrabajo: 2 })];
    const r = await contador.contar(async () => { for (const malo of malos) await expect(registrar([malo])).rejects.toThrow(); });
    expect(r.total).toBe(0);
  });
});

describe('atomicidad con la transacción del llamador', () => {
  test('si la operación del llamador falla, el aviso se revierte junto con sus otros cambios', async () => {
    const a = aviso(); const id = randomUUID();
    await expect(uow.ejecutar(async (tx) => {
      await uow.runner(tx).query('INSERT INTO prueba_atomicidad(id) VALUES ($1)', [id]);
      await api.registrar([a], tx);
      throw new Error('fallo posterior del caso de uso');
    })).rejects.toBeDefined();
    expect(await total(`avisos_negocio WHERE solicitud_id='${a.solicitudId}'`)).toBe(0);
    expect(await total(`prueba_atomicidad WHERE id='${id}'`)).toBe(0);
  });
  test('si todo sale bien, el aviso y los demás cambios se confirman juntos', async () => {
    const a = aviso(); const id = randomUUID();
    await uow.ejecutar(async (tx) => { await uow.runner(tx).query('INSERT INTO prueba_atomicidad(id) VALUES ($1)', [id]); await api.registrar([a], tx); });
    expect(await total(`avisos_negocio WHERE solicitud_id='${a.solicitudId}'`)).toBe(1);
    expect(await total(`prueba_atomicidad WHERE id='${id}'`)).toBe(1);
  });
  test('el aviso no es visible fuera de la transacción hasta confirmarla', async () => {
    const a = aviso(); let fuera = -1;
    await uow.ejecutar(async (tx) => { await api.registrar([a], tx); fuera = await total(`avisos_negocio WHERE solicitud_id='${a.solicitudId}'`); });
    expect(fuera).toBe(0);
    expect(await total(`avisos_negocio WHERE solicitud_id='${a.solicitudId}'`)).toBe(1);
  });
  test('un aviso repetido dentro de otra transacción no rompe ni revierte la operación', async () => {
    const a = aviso(); await registrar([a]);
    const id = randomUUID();
    await uow.ejecutar(async (tx) => { expect(await api.registrar([a], tx)).toBe(0); await uow.runner(tx).query('INSERT INTO prueba_atomicidad(id) VALUES ($1)', [id]); });
    expect(await total(`prueba_atomicidad WHERE id='${id}'`)).toBe(1);
  });
});

describe('separación del correo de seguridad (E1)', () => {
  test('el worker de correo de 001 no toma ni envía los avisos de negocio y avisos_pendientes no cambia', async () => {
    const instantanea = async () => (await db.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='avisos_pendientes' ORDER BY ordinal_position`)) as unknown[];
    const esquemaAntes = await instantanea(); const pendientesAntes = await total('avisos_pendientes');
    await registrar(Array.from({ length: 5 }, () => aviso()));
    const enviados: unknown[] = [];
    const worker = new WorkerCorreo(db, new CifradoOutbox(new Map([['k', Buffer.alloc(32, 7)]]), 'k'), { enviar: async (correo) => { enviados.push(correo); } });
    const antes = (await db.query('SELECT * FROM avisos_negocio ORDER BY id')) as unknown[];
    await worker.paso();
    expect(enviados).toEqual([]);
    expect(await db.query('SELECT * FROM avisos_negocio ORDER BY id')).toEqual(antes);
    expect(await total('avisos_pendientes')).toBe(pendientesAntes);
    expect(await instantanea()).toEqual(esquemaAntes);
  });
  test('registrar avisos de negocio no escribe en avisos_pendientes', async () => {
    const antes = await total('avisos_pendientes');
    const r = await contador.contar(() => registrar([aviso(), aviso()]));
    for (const sentencia of r.sentencias) expect(sentencia).not.toContain('avisos_pendientes');
    expect(await total('avisos_pendientes')).toBe(antes);
  });
  test('los avisos de negocio se quedan en REGISTRADO: esta funcionalidad no los entrega ni los lee', async () => {
    await registrar([aviso(), aviso({ tipo: 'SOLICITUD_CERRADA', versionTrabajo: null })]);
    expect(await total("avisos_negocio WHERE estado<>'REGISTRADO'")).toBe(0);
  });
});
