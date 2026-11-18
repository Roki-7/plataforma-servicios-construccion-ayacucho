import { jest } from '@jest/globals';
import { mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { conDiagnostico, registrarFallo } from '../../src/compartido/infraestructura/diagnostico-fallos.js';
import { UnidadDeTrabajoPostgres } from '../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { CatalogoLocal } from '../../src/modulos/usuarios-acceso/infraestructura/seguridad/catalogo-contrasenas.js';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { IdempotenciaPostgres } from '../../src/compartido/infraestructura/idempotencia.js';
import { CifradoOutbox } from '../../src/modulos/notificaciones/infraestructura/outbox.js';
import { RepositorioRecuperacionesPostgres } from '../../src/modulos/usuarios-acceso/infraestructura/persistencia/repositorio-recuperaciones.js';

test('T099 diagnóstico permite clase/código/origen fijo; excluye mensaje, SQL, parámetros y pila libre', () => {
  const eventos: string[] = [], privado = 'no-registrar-contraseña-token-persona';
  const error = Object.assign(new Error(privado), { name: 'QueryFailedError', driverError: { code: '55P03', detail: privado }, query: privado, parameters: [privado] });
  error.stack = `${privado}\n at ${privado} (C:/Users/${privado}/backend/src/compartido/infraestructura/postgres/unidad-de-trabajo.ts:25:7)\n at ${privado} (https://example.invalid/${privado}:1:2)`;
  conDiagnostico('POST', '/recuperaciones/{token}', v => eventos.push(v), () => registrarFallo('db.trabajo', error));
  expect(eventos).toHaveLength(1); expect(eventos[0]?.includes(privado)).toBe(false);
  const evento = JSON.parse(eventos[0]!);
  expect(evento).toMatchObject({ evento: 'fallo_interno', etapa: 'db.trabajo', metodo: 'POST', ruta: '/recuperaciones/:redactado', excepcion: { clase: 'QueryFailedError', codigo: '55P03', origenes: [{ archivo: 'unidad-de-trabajo.ts', linea: 25, columna: 7 }] } });
  expect(Object.keys(evento).sort()).toEqual(['condicion', 'etapa', 'evento', 'excepcion', 'fecha', 'metodo', 'peticionId', 'ruta']);
});
test('T099 nombres/códigos arbitrarios y getters hostiles no llegan a registros ni rompen la respuesta', () => {
  const eventos: string[] = [], privado = 'persona-privada@example.invalid';
  conDiagnostico('POST', '/recuperaciones/{token}', v => eventos.push(v), () => {
    registrarFallo('http.respuesta', { name: privado, code: privado, stack: privado });
    registrarFallo('http.respuesta', Object.defineProperty({}, 'name', { get() { throw new Error(privado); } }));
  });
  expect(eventos).toHaveLength(2); expect(eventos.join('').includes(privado)).toBe(false);
  expect(JSON.parse(eventos[0]!).excepcion).toMatchObject({ clase: 'otra', codigo: 'no_disponible', origenes: [] });
});
test('T099 dos peticiones concurrentes conservan correlación propia entre etapas', async () => {
  const eventos: string[] = [];
  await Promise.all(['/recuperaciones/{token}', '/perfil/cambios-correo/{token}/confirmacion'].map(ruta => conDiagnostico('POST', ruta, v => eventos.push(v), async () => {
    registrarFallo('db.trabajo', new Error()); await Promise.resolve(); registrarFallo('http.respuesta', new Error());
  })));
  const agrupados = Map.groupBy(eventos.map(v => JSON.parse(v)), v => v.peticionId);
  expect(agrupados.size).toBe(2);
  for (const [id, grupo] of agrupados) { expect(id).toMatch(/^[a-f0-9-]{36}$/); expect(new Set(grupo.map(v => v.ruta)).size).toBe(1); expect(grupo.map(v => v.etapa)).toEqual(['db.trabajo', 'http.respuesta']); }
});
test('T099 el fallo del colector utiliza stderr con el mismo evento seguro sin propagar la excepción', () => {
  const salida = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  try {
    expect(() => conDiagnostico('POST', '/recuperaciones/{token}', () => { throw new Error('secreto del colector'); }, () => registrarFallo('db.trabajo', new TypeError('contraseña privada')))).not.toThrow();
    expect(salida).toHaveBeenCalledTimes(1);
    const texto = String(salida.mock.calls[0]?.[0]); expect(texto.includes('privada')).toBe(false); expect(texto.includes('secreto')).toBe(false);
    expect(JSON.parse(texto).excepcion.clase).toBe('TypeError');
  } finally { salida.mockRestore(); }
});
function baseFicticia(fallos: { commit?: Error; rollback?: Error; release?: Error } = {}) {
  const runner = { isTransactionActive: false, connect: async () => {}, query: async () => [], startTransaction: async () => { runner.isTransactionActive = true; }, commitTransaction: async () => { if (fallos.commit) throw fallos.commit; runner.isTransactionActive = false; }, rollbackTransaction: async () => { runner.isTransactionActive = false; if (fallos.rollback) throw fallos.rollback; }, release: async () => { if (fallos.release) throw fallos.release; } };
  return { isInitialized: true, createQueryRunner: () => runner } as unknown as DataSource;
}
test('T099 rollback y liberación fallidos no borran el diagnóstico del fallo primario', async () => {
  const eventos: string[] = [], liberar = Object.assign(new Error('dato privado'), { code: 'ECONNRESET' });
  const uow = new UnidadDeTrabajoPostgres(baseFicticia({ rollback: new TypeError('dato privado'), release: liberar }));
  await expect(conDiagnostico('POST', '/recuperaciones/{token}', v => eventos.push(v), () => uow.ejecutar(async () => { throw Object.assign(new Error('dato privado'), { code: '55P03' }); }))).rejects.toBe(liberar);
  expect(eventos.map(v => JSON.parse(v).etapa)).toEqual(['db.trabajo', 'db.rollback', 'db.liberacion']);
  expect(JSON.parse(eventos[0]!).excepcion.codigo).toBe('55P03'); expect(eventos.join('').includes('dato privado')).toBe(false);
});
test('T099 fallo en commit conserva etapa y SQLSTATE sin confirmar el resultado', async () => {
  const eventos: string[] = [], uow = new UnidadDeTrabajoPostgres(baseFicticia({ commit: Object.assign(new Error(), { code: '40001' }) }));
  await expect(conDiagnostico('POST', '/recuperaciones/{token}', v => eventos.push(v), () => uow.ejecutar(async () => 1))).rejects.toMatchObject({ http: 503 });
  expect(JSON.parse(eventos[0]!)).toMatchObject({ etapa: 'db.commit', excepcion: { codigo: '40001' } });
});
test('T099 catálogo ausente conserva ENOENT sin divulgar la ruta del archivo', async () => {
  const eventos: string[] = [], carpeta = await mkdtemp(join(tmpdir(), 't099-catalogo-'));
  try {
    await expect(conDiagnostico('POST', '/recuperaciones/{token}', v => eventos.push(v), () => new CatalogoLocal(resolve(carpeta, 'persona@example.invalid.json'), true).inicializar())).rejects.toMatchObject({ http: 503 });
    expect(JSON.parse(eventos[0]!)).toMatchObject({ etapa: 'catalogo.inicializacion', excepcion: { codigo: 'ENOENT' } });
    expect(eventos.join('').includes(carpeta)).toBe(false); expect(eventos.join('').includes('persona@example.invalid')).toBe(false);
  } finally { await rmdir(carpeta); }
});
test('T099 claves HMAC/AEAD ausentes identifican la dependencia sin registrar claves ni identificadores', async () => {
  const eventos: string[] = [], claves = new Map([['identificador-privado', randomBytes(32)]]);
  const uow = new UnidadDeTrabajoPostgres(baseFicticia()), idempotencia = new IdempotenciaPostgres(uow, claves, 'identificador-privado'), cifrado = new CifradoOutbox(claves, 'identificador-privado');
  const token = randomBytes(32).toString('base64url'); claves.clear();
  await conDiagnostico('POST', '/recuperaciones/{token}', v => eventos.push(v), async () => {
    await expect(idempotencia.ejecutar({ ambito: { tipo: 'recuperacion', id: createHash('sha256').update(token).digest('hex') }, metodo: 'POST', rutaLogica: '/recuperaciones/{token}', clave: randomUUID(), token, cuerpo: { version: 1 } }, async () => { throw new Error('No debe ejecutarse'); })).rejects.toMatchObject({ http: 503 });
    expect(() => cifrado.cifrar(randomUUID(), 'persona@example.invalid', { asunto: 'privado', texto: token })).toThrow();
  });
  expect(eventos.map(v => JSON.parse(v).etapa)).toContain('idempotencia.clave'); expect(eventos.map(v => JSON.parse(v).etapa)).toContain('outbox.cifrado');
  for (const privado of [token, 'identificador-privado', 'persona@example.invalid']) expect(eventos.join('').includes(privado)).toBe(false);
});
test('T099 consulta del desafío registra la excepción antes de traducirla a 503', async () => {
  const eventos: string[] = [], db = { query: async () => { throw Object.assign(new Error('parámetros privados'), { code: 'ECONNREFUSED' }); } } as unknown as DataSource;
  const repo = new RepositorioRecuperacionesPostgres(db, new UnidadDeTrabajoPostgres(baseFicticia()));
  await expect(conDiagnostico('POST', '/recuperaciones/{token}', v => eventos.push(v), () => repo.buscarPorDigest(randomBytes(32)))).rejects.toMatchObject({ http: 503 });
  expect(JSON.parse(eventos[0]!)).toMatchObject({ etapa: 'recuperacion.consulta', excepcion: { codigo: 'ECONNREFUSED' } });
  expect(eventos.join('').includes('parámetros privados')).toBe(false);
});
test('T099 error ENOMEM simulado de Argon2 se diagnostica; no representa el aborto nativo Windows', async () => {
  const eventos: string[] = [], fallo = Object.assign(new Error('contraseña privada'), { code: 'ENOMEM' });
  jest.unstable_mockModule('argon2', () => ({ argon2id: 2, hash: async () => { throw fallo; }, verify: async () => false }));
  try {
    const { HashArgon2id } = await import('../../src/modulos/usuarios-acceso/infraestructura/seguridad/argon2id.js');
    await expect(conDiagnostico('POST', '/recuperaciones/{token}', v => eventos.push(v), () => new HashArgon2id().crear('contraseña ficticia completa'))).rejects.toBe(fallo);
    expect(JSON.parse(eventos[0]!)).toMatchObject({ etapa: 'contrasena.hash', excepcion: { codigo: 'ENOMEM' } });
    expect(eventos.join('').includes('contraseña')).toBe(false);
  } finally { jest.unstable_unmockModule('argon2'); }
});
