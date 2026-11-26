import { readFile, realpath } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parse } from 'dotenv';
import { local } from './entorno.js';

// Identidad del entorno aislado de validación de la 003 (T003). Ningún valor coincide con los de 001 ni de 002:
// lo comprueba `test/unit/solicitudes-cotizaciones/entorno-003.spec.ts`. Los demás scripts de la 003 leen de aquí.
export const local003 = resolve(local, '003');
export const proyecto003 = 'ayacucho-003-validacion';
export const base003 = 'ayacucho_003_validacion';
export const usuario003 = 'ayacucho_validacion_003';
export const origen003 = 'https://localhost:8447';
export const puertos003 = { api: 3004, web: 5177, postgres: 54331, redis: 63801, smtp: 1027, correo: 8027, objetos: 3911 } as const;

/**
 * En la composición real, `config.s3.bucket` es **un solo bucket privado con prefijos lógicos** (`usuarios/`, `portafolio/` y, desde la 003,
 * `solicitudes/`). Su equivalente en este entorno aislado es `plataforma-003-validacion`, que prepara `storage:init:003` (T041) en la Garage
 * propia de la 003. No es un bucket adicional del entorno compartido ni requiere una identidad de acceso distinta de la de la aplicación.
 */
export const recursos003 = {
  VALIDATION_MODE: 'true', VALIDATION_PROJECT: proyecto003,
  PORT: String(puertos003.api), PUBLIC_ORIGIN: origen003, PUBLIC_URL: origen003,
  REDIS_URL: `redis://127.0.0.1:${puertos003.redis}`, REDIS_NAMESPACE: 'ayacucho:003:validacion',
  S3_ENDPOINT: `http://127.0.0.1:${puertos003.objetos}`, S3_REGION: 'garage', S3_BUCKET: 'plataforma-003-validacion',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: String(puertos003.smtp), SMTP_SECURE: 'false',
  CATALOGO_MANIFIESTO: resolve(local003, 'catalogo/manifest.json').replaceAll('\\', '/'),
} as const;

/** Acepta solo la base PostgreSQL local dedicada de la 003: sin cadena de consulta, sin fragmento y con credencial. */
export function exigirBase003(valor: string | undefined, base = base003): URL {
  const url = URL.canParse(valor ?? '') ? new URL(valor ?? '') : undefined;
  if (!url || !['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.port !== String(puertos003.postgres) || url.pathname !== `/${base}` || url.username !== usuario003 ||
      !url.password || url.search || url.hash) throw new Error('Se requiere la base PostgreSQL local dedicada de la 003.');
  return url;
}

export async function leerConfiguracion003(): Promise<NodeJS.ProcessEnv> {
  if (process.env['NODE_ENV'] === 'production') throw new Error('Validación 003 no está disponible en producción.');
  const archivo = await realpath(resolve(local003, 'backend.env'));
  if (relative(await realpath(local), archivo) !== relative(local, resolve(local003, 'backend.env'))) {
    throw new Error('La configuración debe estar dentro del directorio dedicado de la 003.');
  }
  const env = { ...parse(await readFile(archivo)), ...process.env };
  if (env['NODE_ENV'] !== 'validation' && env['NODE_ENV'] !== 'test') throw new Error('Se requiere el modo de validación 003.');
  exigirBase003(env['DATABASE_URL']);
  for (const [clave, valor] of Object.entries(recursos003)) {
    if (env[clave] !== valor) throw new Error(`La configuración de ${clave} debe usar el recurso dedicado de la 003.`);
  }
  return env;
}
