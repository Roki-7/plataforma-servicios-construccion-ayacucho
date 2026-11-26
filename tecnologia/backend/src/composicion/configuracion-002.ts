import { cargarConfiguracion, type Configuracion } from './configuracion.js';

/**
 * Configuración de la aplicación compuesta. El cargador de la 001 limita el modo de validación a las bases `ayacucho_001_*` y no se modifica.
 * Aquí se valida con reglas equivalentes la base dedicada de la 002 (solo local y con nombre `ayacucho_002_validacion`, `ayacucho_002_test_*` o `ayacucho_002_restauracion_*`)
 * y el resto de la configuración se valida con el cargador existente.
 */
export function cargarConfiguracion002(env: NodeJS.ProcessEnv = process.env): Configuracion {
  if (env['VALIDATION_MODE'] !== 'true') return cargarConfiguracion(env);
  const url = URL.canParse(env['DATABASE_URL'] ?? '') ? new URL(env['DATABASE_URL'] as string) : undefined;
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || !/^\/ayacucho_002_(validacion|test_[a-z0-9_]+|restauracion_[a-z0-9_]+)$/.test(url.pathname)) {
    throw new Error('El entorno de validación 002 requiere la base PostgreSQL local dedicada de la 002.');
  }
  const sustituto = new URL(url.href); sustituto.pathname = '/ayacucho_001_validacion';
  return { ...cargarConfiguracion({ ...env, DATABASE_URL: sustituto.href }), databaseUrl: url.href };
}
