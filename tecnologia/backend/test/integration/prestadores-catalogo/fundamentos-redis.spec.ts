import { expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { performance } from 'node:perf_hooks';
import { leerConfiguracion002 } from '../../../scripts/entorno-002.js';
import { ClienteRedis002, RedisNoDisponible } from '../../../src/modulos/catalogo/infraestructura/cache/cliente-redis.js';
import { persistencia002 } from '../../../src/composicion/persistencia.js';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { RevisionDeOfertaPostgres } from '../../../src/modulos/catalogo/infraestructura/persistencia/revision-de-oferta.js';
import { baseAislada002 } from '../../soporte/prestadores-catalogo/postgres.js';

test('Redis 8 separa espacios 002 y comunica por separado un acierto y una ausencia', async () => {
  const env = await leerConfiguracion002();
  const espacio = `${env['REDIS_NAMESPACE']}:pruebas:${randomUUID()}`;
  const a = new ClienteRedis002({ ...env, REDIS_NAMESPACE: espacio, REDIS_TIMEOUT_MS: '350' });
  const b = new ClienteRedis002({ ...env, REDIS_NAMESPACE: `${espacio}:otra`, REDIS_TIMEOUT_MS: '350' });
  try {
    await a.guardar('v1:1:categorias', '[]', 2);
    expect(await a.obtener('v1:1:categorias')).toBe('[]');
    expect(await b.obtener('v1:1:categorias')).toBeNull();
    expect(() => new ClienteRedis002({ ...env, REDIS_NAMESPACE: 'ayacucho:001:ajeno' })).toThrow('configuración Redis');
  } finally { a.cerrar(); b.cerrar(); }
});

test('una caché sin respuesta agota su presupuesto y PostgreSQL todavía confirma y lee la revisión', async () => {
  const sockets = new Set<Socket>();
  const servidor = createServer(socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolver, rechazar) => { servidor.once('error', rechazar); servidor.listen(0, '127.0.0.1', resolver); });
  const puerto = (servidor.address() as AddressInfo).port;
  const cliente = new ClienteRedis002({ REDIS_URL: `redis://127.0.0.1:${puerto}`, REDIS_NAMESPACE: 'ayacucho:002:prueba-caida', REDIS_TIMEOUT_MS: '80' });
  try {
    const inicio = performance.now();
    await expect(cliente.obtener('v1:1:busqueda')).rejects.toBeInstanceOf(RedisNoDisponible);
    expect(performance.now() - inicio).toBeLessThan(1000);
    const aislada = await baseAislada002();
    const db = persistencia002(aislada.url);
    try {
      await db.initialize();
      await db.runMigrations();
      const uow = new UnidadDeTrabajoPostgres(db);
      const revision = new RevisionDeOfertaPostgres(uow);
      await uow.ejecutar(async tx => { await revision.bloquear(tx, 'exclusivo'); await revision.incrementar(tx); });
      expect(await revision.vigente()).toBe(2n);
    } finally { try { if (db.isInitialized) await db.destroy(); } finally { await aislada.cerrar(); } }
  } finally {
    cliente.cerrar();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => servidor.close(() => resolve()));
  }
});
