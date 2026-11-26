import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { exigirBase003, leerConfiguracion003 } from '../../../scripts/entorno-003.js';

/** Las bases temporales de las suites de la 003 siguen este patrón y ningún otro (el CI comprueba que no queden residuales). */
export const patronBaseTemporal003 = /^ayacucho_003_test_[0-9a-f]{32}$/;

export function nombreBaseTemporal003(): string {
  return `ayacucho_003_test_${randomUUID().replaceAll('-', '')}`;
}

/**
 * Crea una base PostgreSQL propia de la suite dentro de la instancia de validación 003 y devuelve su URL y una función para retirarla.
 * Nunca toca la base `ayacucho_003_validacion`, ni las de 001 ni las de 002: `exigirBase003` rechaza cualquier otra instancia o base.
 * `cerrar` es idempotente y fuerza el cierre de conexiones abiertas.
 */
export async function baseAislada003(origen?: string): Promise<{ url: string; nombre: string; cerrar: () => Promise<void> }> {
  const url = exigirBase003(origen ?? (await leerConfiguracion003())['DATABASE_URL']);
  const origenAdmin = url.href;
  const nombre = nombreBaseTemporal003();
  if (!patronBaseTemporal003.test(nombre)) throw new Error('Nombre de base temporal 003 no válido.');
  const admin = new Client({ connectionString: origenAdmin, connectionTimeoutMillis: 5000 });
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${nombre}"`);
  } finally {
    await admin.end();
  }
  url.pathname = `/${nombre}`;
  let eliminada = false;
  return {
    url: url.href, nombre,
    cerrar: async () => {
      if (eliminada) return;
      const limpieza = new Client({ connectionString: origenAdmin, connectionTimeoutMillis: 5000 });
      try {
        await limpieza.connect();
        await limpieza.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
        eliminada = true;
      } finally {
        await limpieza.end();
      }
    },
  };
}
