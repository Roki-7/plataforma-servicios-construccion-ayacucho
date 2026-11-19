import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { userInfo, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import request from 'supertest';
import { crearAplicacion } from '../../../src/composicion/app.module.js';
import { registroCategorias002 } from '../../../src/composicion/categorias-002.js';
import type { Configuracion } from '../../../src/composicion/configuracion.js';
import { persistencia002 } from '../../../src/composicion/persistencia.js';
import { bytesAprobacion, type CargaAprobacion } from '../../../src/modulos/administracion/aplicacion/gestionar-permisos-rf39.js';
import { registrarCuenta, type CuentaPrueba } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

/**
 * Procedimiento operativo RF39 de extremo a extremo con el comando real, procesos separados y PostgreSQL de un contenedor dedicado.
 * Es opt-in: se ejecuta solo con RF39_AISLADA_URL, la URL administrativa del contenedor `ayacucho-rf39-aislada` (127.0.0.1:54340, usuario
 * rf39_prueba). Cada ejecución crea y elimina su propia base `rf39_*`. Nunca usa la base de validación 002, la 001 ni producción.
 */
const urlAdmin = process.env['RF39_AISLADA_URL'];
const suite = urlAdmin ? describe : describe.skip;
const backend = resolve('.');
const principal = userInfo().username.toLowerCase();
const origen = 'https://localhost:8444';
const hmac = Buffer.alloc(32, 1).toString('base64'); const aead = Buffer.alloc(32, 2).toString('base64');

function exigirDestino(conexion: string, base?: string): URL {
  const u = new URL(conexion);
  const nombre = u.pathname.slice(1);
  if (u.hostname !== '127.0.0.1' || u.port !== '54340' || u.username !== 'rf39_prueba') throw new Error('Destino no permitido: no es el contenedor aislado de RF39.');
  if (base !== undefined && !/^rf39_[0-9a-f]{32}$/.test(nombre)) throw new Error('Destino no permitido: no es una base rf39_* creada por esta prueba.');
  if (/validacion|ayacucho_001|ayacucho_002|prod/i.test(nombre) && base !== undefined) throw new Error('Destino no permitido.');
  return u;
}

suite('comando operativo RF39 contra PostgreSQL aislado', () => {
  let urlBase = ''; let nombreBase = ''; let carpeta = ''; let app: Awaited<ReturnType<typeof crearAplicacion>>; let http: ReturnType<typeof request>;
  let afectada: CuentaPrueba; let archivoConfig = '';
  const par = generateKeyPairSync('ed25519'); const ajena = generateKeyPairSync('ed25519');
  const firmar = (c: CargaAprobacion, clave = par.privateKey) => ({ aprobacion: c, firma: sign(null, bytesAprobacion(c), clave).toString('base64') });
  const carga = (accion: 'CONCEDER' | 'REVOCAR', cuentaId: string, extra: Partial<CargaAprobacion> = {}): CargaAprobacion => ({
    aprobacionId: randomUUID(), accion, permiso: 'RF39_CATEGORIAS', cuentaId, motivo: 'Prueba aislada de RF39', entorno: 'prueba-aislada',
    emitidaEn: new Date(Date.now() - 60_000).toISOString(), venceEn: new Date(Date.now() + 600_000).toISOString(), firmante: 'po-ficticio', ...extra });

  const sql = async <T>(texto: string, p: unknown[] = []): Promise<T[]> => {
    exigirDestino(urlBase, nombreBase);
    const c = new Client({ connectionString: urlBase }); await c.connect();
    try { return (await c.query(texto, p)).rows as T[]; } finally { await c.end(); }
  };
  /** Comprueba el destino real (servidor y base) y ejecuta el comando en un proceso nuevo con un entorno construido desde cero. */
  const comando = async (args: string[], entrada = '') => {
    exigirDestino(urlBase, nombreBase);
    const destino = await sql<{ b: string; p: number }>('SELECT current_database() AS b, inet_server_port() AS p');
    expect(destino[0]!.b).toBe(nombreBase);
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/gestionar-permisos-rf39.ts', ...args], { cwd: backend, input: entrada, encoding: 'utf8', timeout: 90_000,
      env: { PATH: process.env['PATH'] ?? '', SystemRoot: process.env['SystemRoot'] ?? '', TEMP: tmpdir(), TMP: tmpdir(), NODE_ENV: 'test',
        DATABASE_URL: urlBase, PUBLIC_ORIGIN: origen, PUBLIC_URL: origen, HMAC_KEYS_JSON: JSON.stringify({ prueba: hmac }), HMAC_KEY_ID: 'prueba',
        AEAD_KEYS_JSON: JSON.stringify({ prueba: aead }), AEAD_KEY_ID: 'prueba', S3_ENDPOINT: 'https://127.0.0.1:9', S3_REGION: 'prueba', S3_BUCKET: 'no-usado',
        S3_ACCESS_KEY_ID: 'ficticia', S3_SECRET_ACCESS_KEY: 'ficticia', SMTP_HOST: '127.0.0.1', SMTP_PORT: '9', SMTP_FROM: 'pruebas@example.invalid',
        CATALOGO_MANIFIESTO: resolve('../.local/002/catalogo/manifest.json'), RF39_CONFIGURACION_PROTEGIDA: archivoConfig } });
    return { codigo: r.status, salida: r.stdout, error: r.stderr };
  };
  const archivoAprobacion = async (a: object) => { const f = join(carpeta, `${randomUUID()}.json`); await writeFile(f, JSON.stringify(a)); return f; };
  const permiso = async () => (await sql<{ estado: string; version: number }>('SELECT estado,version FROM administracion_permisos WHERE cuenta_id=$1', [afectada.cuentaId]))[0];
  const cuenta = async (tabla: string, donde = 'true', p: unknown[] = []) => Number((await sql<{ n: number }>(`SELECT count(*)::int AS n FROM ${tabla} WHERE ${donde}`, p))[0]!.n);

  beforeAll(async () => {
    exigirDestino(urlAdmin!);
    nombreBase = `rf39_${randomUUID().replaceAll('-', '')}`;
    const admin = new Client({ connectionString: urlAdmin! }); await admin.connect();
    try { await admin.query(`CREATE DATABASE "${nombreBase}"`); } finally { await admin.end(); }
    const u = exigirDestino(urlAdmin!); u.pathname = `/${nombreBase}`; urlBase = u.href;
    exigirDestino(urlBase, nombreBase);
    carpeta = await mkdtemp(join(tmpdir(), 'rf39-'));
    archivoConfig = join(carpeta, 'config-rf39.json');
    await writeFile(archivoConfig, JSON.stringify({ entorno: 'prueba-aislada', clavePublicaFirmante: par.publicKey.export({ type: 'spki', format: 'pem' }),
      identidades: [{ principal: 'po-ficticio', rol: 'FIRMANTE' }, { principal, rol: 'EJECUTOR' }] }));
    const registro = registroCategorias002({});
    const migrador = persistencia002(urlBase, registro.persistencia as never); await migrador.initialize();
    try { await migrador.runMigrations({ transaction: 'each' }); } finally { await migrador.destroy(); }
    const config: Configuracion = { validacion: true, puerto: 3002, origen, urlPublica: origen, databaseUrl: urlBase, catalogo: resolve('../.local/002/catalogo/manifest.json'),
      contrato: resolve('contracts/openapi.json'), hmacId: 'prueba', hmac: new Map([['prueba', Buffer.alloc(32, 1)]]), aeadId: 'prueba', aead: new Map([['prueba', Buffer.alloc(32, 2)]]),
      smtp: { host: '127.0.0.1', port: 9, secure: false, from: 'pruebas@example.invalid', validacion: true },
      s3: { endpoint: 'https://127.0.0.1:9', region: 'prueba', bucket: 'no-usado', accessKeyId: 'ficticia', secretAccessKey: 'ficticia' } };
    app = await crearAplicacion(config, { worker: false, oferta002: { ...registro, modo: 'prueba', persistencia: registro.persistencia as never } });
    http = request(app.app.getHttpServer());
    afectada = await registrarCuenta(app, http, 'cliente');
  }, 240000);
  afterAll(async () => {
    try { await app?.app.close(); } finally {
      if (carpeta) await rm(carpeta, { recursive: true, force: true });
      if (nombreBase) { const admin = new Client({ connectionString: urlAdmin! }); await admin.connect(); try { await admin.query(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`); } finally { await admin.end(); } }
    }
  }, 60000);

  test('el destino es el contenedor aislado y las tablas de RF39 existen y están vacías', async () => {
    expect((await sql<{ b: string }>('SELECT current_database() AS b'))[0]!.b).toBe(nombreBase);
    expect(() => exigirDestino('postgres://x:y@127.0.0.1:54330/ayacucho_002_validacion')).toThrow('Destino no permitido');
    expect(() => exigirDestino('postgres://rf39_prueba:y@127.0.0.1:54340/ayacucho_002_validacion', 'ayacucho_002_validacion')).toThrow('Destino no permitido');
    expect(await cuenta('administracion_permisos')).toBe(0);
    await http.get('/api/v1/admin/categorias').set('Authorization', `Bearer ${afectada.token}`).expect(403);
  });

  test('constancia: se emite con la sesión por la entrada estándar, se guarda sin el Bearer y rechaza una sesión inválida', async () => {
    const mala = await comando(['constancia'], 'a'.repeat(43));
    expect(mala.codigo).toBe(1);
    expect(await cuenta('administracion_constancias')).toBe(0);
    const ok = await comando(['constancia'], `${afectada.token}\n`);
    expect([ok.codigo, ok.salida]).toEqual([0, expect.stringContaining('Constancia emitida')]);
    expect(ok.salida + ok.error).not.toContain(afectada.token);
    const f = await sql<{ id: string; cuenta_id: string; entorno: string; consumida_en: Date | null }>('SELECT id,cuenta_id,entorno,consumida_en FROM administracion_constancias');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ cuenta_id: afectada.cuentaId, entorno: 'prueba-aislada', consumida_en: null });
    expect(ok.salida).toContain(f[0]!.id);
    expect(JSON.stringify(f)).not.toContain(afectada.token);
  }, 180000);

  test('conceder: firma inválida, cuenta distinta y aprobación vencida se rechazan sin cambiar la base', async () => {
    const [{ id: constanciaId }] = await sql<{ id: string }>('SELECT id FROM administracion_constancias') as [{ id: string }];
    const casos = [
      firmar(carga('CONCEDER', afectada.cuentaId, { constanciaId }), ajena.privateKey),
      firmar(carga('CONCEDER', randomUUID(), { constanciaId })),
      firmar(carga('CONCEDER', afectada.cuentaId, { constanciaId, venceEn: new Date(Date.now() - 1000).toISOString(), emitidaEn: new Date(Date.now() - 9000).toISOString() })),
      firmar(carga('CONCEDER', afectada.cuentaId, { constanciaId, firmante: 'otro' })),
    ];
    const alterada = firmar(carga('CONCEDER', afectada.cuentaId, { constanciaId })); casos.push({ aprobacion: { ...alterada.aprobacion, motivo: 'Motivo alterado' }, firma: alterada.firma });
    for (const c of casos) {
      const r = await comando(['conceder', await archivoAprobacion(c)]);
      expect(r.codigo).toBe(1); expect(r.error).toContain('APROBACION_NO_VALIDA');
    }
    expect(await permiso()).toBeUndefined();
    expect(await cuenta('administracion_aprobaciones')).toBe(0);
    expect(await cuenta('administracion_auditoria')).toBe(0);
    expect(await cuenta('administracion_constancias', 'consumida_en IS NOT NULL')).toBe(0);
  }, 300000);

  let aprobacionConceder = '';
  test('conceder: una aprobación válida concede, consume aprobación y constancia, y audita con el ejecutor del sistema', async () => {
    const [{ id: constanciaId }] = await sql<{ id: string }>('SELECT id FROM administracion_constancias') as [{ id: string }];
    const firmada = firmar(carga('CONCEDER', afectada.cuentaId, { constanciaId })); aprobacionConceder = await archivoAprobacion(firmada);
    const r = await comando(['conceder', aprobacionConceder]);
    expect([r.codigo, r.salida]).toEqual([0, expect.stringContaining('concedido')]);
    expect(await permiso()).toMatchObject({ estado: 'VIGENTE', version: 1 });
    const ap = await sql<{ firmante: string; ejecutor: string; cuenta_id: string; constancia_id: string }>('SELECT firmante,ejecutor,cuenta_id,constancia_id FROM administracion_aprobaciones');
    expect(ap).toEqual([{ firmante: 'po-ficticio', ejecutor: principal, cuenta_id: afectada.cuentaId, constancia_id: constanciaId }]);
    expect(await cuenta('administracion_constancias', 'consumida_en IS NOT NULL AND id=$1', [constanciaId])).toBe(1);
    const aud = await sql<Record<string, string>>('SELECT responsable,aprobacion_id,accion,recurso_tipo,recurso_id,motivo FROM administracion_auditoria');
    expect(aud).toEqual([{ responsable: `operativo:${principal}`, aprobacion_id: firmada.aprobacion.aprobacionId, accion: 'PERMISO_RF39_CONCEDIDO', recurso_tipo: 'PERMISO_RF39', recurso_id: afectada.cuentaId, motivo: 'Prueba aislada de RF39' }]);
    // La aplicación, en otro proceso, reconoce el permiso persistido.
    await http.get('/api/v1/admin/categorias').set('Authorization', `Bearer ${afectada.token}`).expect(200);
  }, 180000);

  test('conceder: reutilizar la aprobación o la constancia se rechaza y no duplica registros', async () => {
    const r = await comando(['conceder', aprobacionConceder]);
    expect(r.codigo).toBe(1);
    expect(await cuenta('administracion_aprobaciones')).toBe(1);
    expect(await cuenta('administracion_auditoria')).toBe(1);
    expect(await permiso()).toMatchObject({ estado: 'VIGENTE', version: 1 });
  }, 120000);

  test('el permiso concedido permite operar y registra la auditoría de la categoría con la cuenta autenticada', async () => {
    const r = await http.post('/api/v1/admin/categorias').set('Authorization', `Bearer ${afectada.token}`).set('Origin', origen).set('Idempotency-Key', randomUUID()).send({ nombre: 'Prueba aislada', motivo: 'Alta' }).expect(201);
    const aud = await sql<{ responsable: string; accion: string }>("SELECT responsable,accion FROM administracion_auditoria WHERE recurso_id=$1", [r.body.categoriaId]);
    expect(aud).toEqual([{ responsable: afectada.cuentaId, accion: 'CATEGORIA_CREADA' }]);
  });

  test('revocar: una aprobación válida revoca, conserva la fila y la sesión abierta deja de autorizar', async () => {
    const firmada = firmar(carga('REVOCAR', afectada.cuentaId));
    const mala = await comando(['revocar', await archivoAprobacion(firmar(carga('REVOCAR', afectada.cuentaId), ajena.privateKey))]);
    expect(mala.codigo).toBe(1);
    expect(await permiso()).toMatchObject({ estado: 'VIGENTE' });
    const r = await comando(['revocar', await archivoAprobacion(firmada)]);
    expect([r.codigo, r.salida]).toEqual([0, expect.stringContaining('revocado')]);
    expect(await permiso()).toMatchObject({ estado: 'REVOCADO', version: 2 });
    expect(await cuenta('administracion_permisos', 'revocado_en IS NOT NULL')).toBe(1);
    // La misma sesión 001 sigue abierta, pero el permiso ya no autoriza ni lecturas ni escrituras.
    await http.get('/api/v1/admin/categorias').set('Authorization', `Bearer ${afectada.token}`).expect(403);
    await http.post('/api/v1/admin/categorias').set('Authorization', `Bearer ${afectada.token}`).set('Origin', origen).set('Idempotency-Key', randomUUID()).send({ nombre: 'Tras revocar', motivo: 'M' }).expect(403);
    expect(await cuenta('catalogo_clasificaciones', "nombre='Tras revocar'")).toBe(0);
    const acciones = await sql<{ accion: string }>("SELECT accion FROM administracion_auditoria WHERE recurso_tipo='PERMISO_RF39' ORDER BY ocurrio_en,id");
    expect(acciones.map(a => a.accion)).toEqual(['PERMISO_RF39_CONCEDIDO', 'PERMISO_RF39_REVOCADO']);
    // Revocar de nuevo (aprobación nueva) se rechaza: no hay permiso vigente.
    const otra = await comando(['revocar', await archivoAprobacion(firmar(carga('REVOCAR', afectada.cuentaId)))]);
    expect(otra.codigo).toBe(1); expect(otra.error).toContain('PERMISO_NO_VIGENTE');
    expect(await cuenta('administracion_aprobaciones')).toBe(2);
  }, 300000);

  test('la auditoría no puede modificarse ni eliminarse con operaciones normales', async () => {
    const antes = await cuenta('administracion_auditoria');
    expect(antes).toBe(3); // concesión, categoría creada y revocación
    for (const orden of ["UPDATE administracion_auditoria SET motivo='alterado'", 'DELETE FROM administracion_auditoria', 'TRUNCATE administracion_auditoria']) {
      await expect(sql(orden)).rejects.toThrow('solo adición');
    }
    expect(await cuenta('administracion_auditoria')).toBe(antes);
    expect(await cuenta('administracion_auditoria', "motivo='alterado'")).toBe(0);
  });

  test('el comando exige el ejecutor del sistema en constancia, conceder y revocar: sin él o sin configuración se rechaza sin registros', async () => {
    const original = archivoConfig;
    const sinEjecutor = join(carpeta, 'sin-ejecutor.json');
    await writeFile(sinEjecutor, JSON.stringify({ entorno: 'prueba-aislada', clavePublicaFirmante: par.publicKey.export({ type: 'spki', format: 'pem' }),
      identidades: [{ principal: 'po-ficticio', rol: 'FIRMANTE' }, { principal: 'otra-persona-distinta', rol: 'EJECUTOR' }] }));
    archivoConfig = sinEjecutor;
    try {
      const { id } = (await sql<{ id: string }>('SELECT id FROM administracion_constancias'))[0]!;
      const r = await comando(['conceder', await archivoAprobacion(firmar(carga('CONCEDER', afectada.cuentaId, { constanciaId: id })))]);
      expect(r.codigo).toBe(1); expect(r.error).toContain('SIN_PERMISO');
      const constanciasAntes = await cuenta('administracion_constancias');
      // Una identidad no habilitada no crea constancias, aunque presente una sesión válida.
      const noHabilitado = await comando(['constancia'], afectada.token);
      expect(noHabilitado.codigo).toBe(1); expect(noHabilitado.error).toContain('SIN_PERMISO');
      expect(await cuenta('administracion_constancias')).toBe(constanciasAntes);
      archivoConfig = join(carpeta, 'no-existe.json');
      expect((await comando(['verificar-config'])).codigo).toBe(1);
      const sinConfig = await comando(['constancia'], afectada.token);
      expect(sinConfig.codigo).toBe(1);
      expect(await cuenta('administracion_constancias')).toBe(constanciasAntes);
    } finally { archivoConfig = original; }
    expect(await permiso()).toMatchObject({ estado: 'REVOCADO' });
    expect(await cuenta('administracion_aprobaciones')).toBe(2);
  }, 180000);
});
