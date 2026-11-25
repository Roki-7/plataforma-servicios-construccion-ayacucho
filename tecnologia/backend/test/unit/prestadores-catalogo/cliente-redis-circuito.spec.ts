import { describe, expect, test } from '@jest/globals';
import { ClienteRedis002, RedisNoDisponible, configuracionRedis002 } from '../../../src/modulos/catalogo/infraestructura/cache/cliente-redis.js';

/** T082 · Con Redis caído el cliente abre un circuito: tras un fallo responde «no disponible» sin tocar la red hasta que vence el tiempo de reintento. */
const entorno = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({ REDIS_URL: 'redis://127.0.0.1:1', REDIS_NAMESPACE: 'ayacucho:002:unit-circuito', REDIS_TIMEOUT_MS: '50', ...extra });

describe('circuito del cliente Redis 002', () => {
  test('el tiempo de reintento es 1 s por defecto y se valida', () => {
    expect(configuracionRedis002(entorno()).reintentoMs).toBe(1000);
    expect(() => configuracionRedis002(entorno({ REDIS_REINTENTO_MS: '-1' }))).toThrow();
    expect(() => configuracionRedis002(entorno({ REDIS_REINTENTO_MS: '60001' }))).toThrow();
  });

  test('tras un fallo el circuito queda abierto y las llamadas siguientes fallan de inmediato', async () => {
    const cliente = new ClienteRedis002(entorno({ REDIS_REINTENTO_MS: '60000' }));
    try {
      await expect(cliente.obtener('a')).rejects.toBeInstanceOf(RedisNoDisponible);
      const inicio = performance.now();
      for (let i = 0; i < 200; i += 1) await expect(cliente.obtener('a')).rejects.toBeInstanceOf(RedisNoDisponible);
      expect(performance.now() - inicio).toBeLessThan(500);
    } finally { cliente.cerrar(); }
  });
});
