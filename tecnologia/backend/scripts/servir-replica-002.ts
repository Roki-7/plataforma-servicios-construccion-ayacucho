import { createServer, connect, type Server } from 'node:net';
import { iniciarOferta002 } from '../src/composicion/main.js';
import { exigirBase002, leerConfiguracion002 } from './entorno-002.js';

/**
 * T083 · Réplica de la API para el ensayo de EQ-03/PR03: es la MISMA composición de 40 operaciones que sirve `e2e-efimero-002 servir` (T082), sin cambios en `src/`.
 * Se ejecuta en un contenedor con límites de CPU y memoria. La configuración de la 002 exige los recursos dedicados en 127.0.0.1, así que dentro del contenedor se exponen
 * esos mismos puntos de enlace como relés TCP hacia los servicios del proyecto Docker de la 002 (PostgreSQL, Redis y objetos), y un relé de entrada publica el puerto de la
 * API (que en validación escucha solo en el bucle local) para el balanceador. Los relés son idénticos en una y en dos réplicas.
 *   servir-replica-002 <id de 32 hexadecimales>
 */
const id = process.argv[2] ?? '';
if (!/^[0-9a-f]{32}$/.test(id)) { process.stderr.write('Uso: servir-replica-002 <id de 32 hexadecimales>\n'); process.exit(2); }
const nombres = { baseDatos: `ayacucho_002_test_${id}`, bucket: `e2e-${id}`, espacioRedis: `ayacucho:002:e2e-${id}` };

function rele(escucha: { host: string; puerto: number }, destino: { host: string; puerto: number }): Promise<Server> {
  return new Promise((ok, fallo) => {
    const servidor = createServer((entrada) => {
      const salida = connect(destino.puerto, destino.host);
      entrada.pipe(salida); salida.pipe(entrada);
      const cerrar = (): void => { entrada.destroy(); salida.destroy(); };
      entrada.on('error', cerrar); salida.on('error', cerrar); entrada.on('close', cerrar); salida.on('close', cerrar);
    });
    servidor.once('error', fallo); servidor.listen(escucha.puerto, escucha.host, () => ok(servidor));
  });
}

async function ejecutar(): Promise<void> {
  const base = await leerConfiguracion002();
  const admin = exigirBase002(base['DATABASE_URL']);
  const efimera = new URL(admin.href); efimera.pathname = `/${nombres.baseDatos}`;
  const env: NodeJS.ProcessEnv = { ...base, DATABASE_URL: efimera.href, S3_BUCKET: nombres.bucket, REDIS_NAMESPACE: nombres.espacioRedis };
  await rele({ host: '127.0.0.1', puerto: 54330 }, { host: 'postgres', puerto: 5432 });
  await rele({ host: '127.0.0.1', puerto: 63800 }, { host: 'redis', puerto: 6379 });
  await rele({ host: '127.0.0.1', puerto: 3910 }, { host: 'objetos', puerto: 3900 });
  const servicio = await iniciarOferta002(env);
  await rele({ host: '0.0.0.0', puerto: 3003 }, { host: '127.0.0.1', puerto: 3002 });
  const nota = (texto: string): void => { process.stderr.write(`[${new Date().toISOString()}] ${texto}\n`); };
  process.on('exit', (codigo) => nota(`la réplica termina con código ${codigo}`));
  process.on('uncaughtException', (e) => { nota(`excepción no capturada: ${e instanceof Error ? e.stack : String(e)}`); process.exit(1); });
  process.on('unhandledRejection', (e) => { nota(`promesa rechazada sin capturar: ${e instanceof Error ? e.stack : String(e)}`); process.exit(1); });
  const cerrar = (): void => { void servicio.cerrar().finally(() => process.exit(0)); };
  process.once('SIGTERM', cerrar); process.once('SIGINT', cerrar);
}
ejecutar().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo iniciar la réplica.'}\n`); process.exit(1); });
