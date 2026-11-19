import { createClient } from 'redis';

export interface ConfiguracionRedis002 { readonly url: string; readonly espacio: string; readonly presupuestoMs: number }

export function configuracionRedis002(env: NodeJS.ProcessEnv): ConfiguracionRedis002 {
  const url = env['REDIS_URL'];
  const espacio = env['REDIS_NAMESPACE'];
  const presupuestoMs = Number(env['REDIS_TIMEOUT_MS'] ?? '100');
  if (!url || !URL.canParse(url) || !['redis:', 'rediss:'].includes(new URL(url).protocol) ||
      !espacio || !/^ayacucho:002:[a-z0-9_:-]{1,100}$/.test(espacio) || !Number.isInteger(presupuestoMs) || presupuestoMs < 25 || presupuestoMs > 1000) {
    throw new Error('Se requiere configuración Redis y un presupuesto válido para la 002.');
  }
  return { url, espacio, presupuestoMs };
}

export class RedisNoDisponible extends Error {
  constructor() { super('Caché temporalmente no disponible.'); this.name = 'RedisNoDisponible'; }
}

export class ClienteRedis002 {
  private readonly config: ConfiguracionRedis002;
  private readonly cliente: ReturnType<typeof createClient>;
  private conexion: Promise<unknown> | undefined;

  constructor(env: NodeJS.ProcessEnv) {
    this.config = configuracionRedis002(env);
    this.cliente = createClient({ url: this.config.url, disableOfflineQueue: true, commandsQueueMaxLength: 32,
      socket: { connectTimeout: this.config.presupuestoMs, reconnectStrategy: false } });
    // Los errores son señales al solicitante. No se registran URL, comandos ni claves.
    this.cliente.on('error', () => undefined);
  }

  async obtener(clave: string): Promise<string | null> {
    return this.operar(signal => this.cliente.withCommandOptions({ abortSignal: signal }).get(`${this.config.espacio}:${clave}`));
  }

  async guardar(clave: string, valor: string, ttlSegundos: number): Promise<void> {
    if (!Number.isSafeInteger(ttlSegundos) || ttlSegundos < 1 || ttlSegundos > 3600) throw new Error('TTL de caché no válido.');
    await this.operar(signal => this.cliente.withCommandOptions({ abortSignal: signal }).set(`${this.config.espacio}:${clave}`, valor, { expiration: { type: 'EX', value: ttlSegundos } }));
  }

  cerrar(): void { if (this.cliente.isOpen) this.cliente.destroy(); }

  private async operar<T>(comando: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controlador = new AbortController();
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    try {
      const limite = new Promise<never>((_resolver, rechazar) => {
        temporizador = setTimeout(() => { controlador.abort(); rechazar(new RedisNoDisponible()); }, this.config.presupuestoMs);
      });
      if (!this.cliente.isReady) {
        this.conexion ??= this.cliente.connect().finally(() => { this.conexion = undefined; });
        await Promise.race([this.conexion, limite]);
      }
      return await Promise.race([comando(controlador.signal), limite]);
    } catch { throw new RedisNoDisponible(); }
    finally { if (temporizador) clearTimeout(temporizador); }
  }
}
