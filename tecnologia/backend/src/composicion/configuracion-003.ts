import { cargarConfiguracion, type Configuracion } from './configuracion.js';

/**
 * Configuración de la aplicación compuesta con la 003. El cargador de la 001 limita el modo de validación a las bases `ayacucho_001_*` y no se modifica,
 * y `configuracion-002.ts` tampoco. Aquí se valida con reglas equivalentes la base local de la 003 (`ayacucho_003_validacion` o `ayacucho_003_test_*`)
 * y, para la regresión de la composición, las bases locales de la 002 (`ayacucho_002_validacion`, `ayacucho_002_test_*` y `ayacucho_002_restauracion_*`).
 * El resto de la configuración se valida con el cargador existente.
 */
const basesAdmitidas = /^\/ayacucho_(?:003_(?:validacion|test_[a-z0-9_]+)|002_(?:validacion|test_[a-z0-9_]+|restauracion_[a-z0-9_]+))$/;

export function cargarConfiguracion003(env: NodeJS.ProcessEnv = process.env): Configuracion {
  if (env['VALIDATION_MODE'] !== 'true') return cargarConfiguracion(env);
  const url = URL.canParse(env['DATABASE_URL'] ?? '') ? new URL(env['DATABASE_URL'] as string) : undefined;
  if (!url || !['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || !basesAdmitidas.test(url.pathname)) {
    throw new Error('El entorno de validación 003 requiere una base PostgreSQL local dedicada de la 003 (o de la 002 para la regresión).');
  }
  const sustituto = new URL(url.href); sustituto.pathname = '/ayacucho_001_validacion';
  return { ...cargarConfiguracion({ ...env, DATABASE_URL: sustituto.href }), databaseUrl: url.href };
}
