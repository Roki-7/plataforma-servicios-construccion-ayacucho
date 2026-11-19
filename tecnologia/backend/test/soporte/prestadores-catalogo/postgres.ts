import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { exigirBase002, leerConfiguracion002 } from '../../../scripts/entorno-002.js';

export async function baseAislada002(origen?: string): Promise<{ url: string; cerrar: () => Promise<void> }> {
  const url = exigirBase002(origen ?? (await leerConfiguracion002())['DATABASE_URL']);
  const admin = new Client({ connectionString: url.href, connectionTimeoutMillis: 5000 });
  const nombre = `ayacucho_002_test_${randomUUID().replaceAll('-', '')}`;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${nombre}"`);
  } finally {
    await admin.end();
  }
  const origenAdmin = url.href;
  url.pathname = `/${nombre}`;
  let eliminada = false;
  return {
    url: url.href,
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
