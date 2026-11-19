import { readFile, realpath } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parse } from 'dotenv';
import { local } from './entorno.js';

export const local002 = resolve(local, '002');
export const proyecto002 = 'ayacucho-002-validacion';
export const base002 = 'ayacucho_002_validacion';
export const usuario002 = 'ayacucho_validacion_002';
export const origen002 = 'https://localhost:8444';
export const puertos002 = { api: 3002, web: 5175, postgres: 54330, redis: 63800, smtp: 1026, correo: 8026, objetos: 3910 } as const;
export const recursos002 = {
  VALIDATION_MODE: 'true', VALIDATION_PROJECT: proyecto002,
  PORT: String(puertos002.api), PUBLIC_ORIGIN: origen002, PUBLIC_URL: origen002,
  REDIS_URL: `redis://127.0.0.1:${puertos002.redis}`, REDIS_NAMESPACE: 'ayacucho:002:validacion',
  S3_ENDPOINT: `http://127.0.0.1:${puertos002.objetos}`, S3_REGION: 'garage', S3_BUCKET: 'portafolio-002-validacion',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: String(puertos002.smtp), SMTP_SECURE: 'false',
  CATALOGO_MANIFIESTO: resolve(local002, 'catalogo/manifest.json').replaceAll('\\', '/'),
} as const;

export function exigirBase002(valor: string | undefined, base = base002): URL {
  const url = URL.canParse(valor ?? '') ? new URL(valor ?? '') : undefined;
  if (!url || !['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.port !== String(puertos002.postgres) || url.pathname !== `/${base}` || url.username !== usuario002 ||
      !url.password || url.search || url.hash) throw new Error('Se requiere la base PostgreSQL local dedicada de la 002.');
  return url;
}

export async function leerConfiguracion002(): Promise<NodeJS.ProcessEnv> {
  if (process.env['NODE_ENV'] === 'production') throw new Error('Validación 002 no está disponible en producción.');
  const archivo = await realpath(resolve(local002, 'backend.env'));
  if (relative(await realpath(local), archivo) !== relative(local, resolve(local002, 'backend.env'))) {
    throw new Error('La configuración debe estar dentro del directorio dedicado de la 002.');
  }
  const env = { ...parse(await readFile(archivo)), ...process.env };
  if (env['NODE_ENV'] !== 'validation' && env['NODE_ENV'] !== 'test') throw new Error('Se requiere el modo de validación 002.');
  exigirBase002(env['DATABASE_URL']);
  for (const [clave, valor] of Object.entries(recursos002)) {
    if (env[clave] !== valor) throw new Error(`La configuración de ${clave} debe usar el recurso dedicado de la 002.`);
  }
  return env;
}
