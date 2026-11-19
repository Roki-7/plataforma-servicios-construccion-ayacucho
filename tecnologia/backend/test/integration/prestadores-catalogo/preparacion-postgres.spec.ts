import { expect, test } from '@jest/globals';
import { Client } from 'pg';
import { leerConfiguracion002 } from '../../../scripts/entorno-002.js';
import { cuentasFicticias002 } from '../../soporte/prestadores-catalogo/datos.js';
import { baseAislada002 } from '../../soporte/prestadores-catalogo/postgres.js';

test('rechaza recursos de la 001 y bases externas antes de conectarse', async () => {
  const origen = Object.assign(new URL('postgresql://ayacucho_validacion_002:fixture@127.0.0.1:54330'), {
    pathname: '/ayacucho_001_validacion',
  });
  await expect(baseAislada002(origen.href)).rejects.toThrow('base PostgreSQL local dedicada');
  origen.pathname = '/ayacucho_002_validacion';
  origen.hostname = 'postgres.example.invalid';
  await expect(baseAislada002(origen.href)).rejects.toThrow('base PostgreSQL local dedicada');
});

test('carga y limpia fixtures dos veces mientras preserva la base descartable de otra suite', async () => {
  const { DATABASE_URL } = await leerConfiguracion002();
  const control = new Client({ connectionString: DATABASE_URL });
  await control.connect();
  const pruebas: Awaited<ReturnType<typeof baseAislada002>>[] = [];
  const cuentas = Object.values(cuentasFicticias002);
  const etapa = async (url: string, cargar: boolean) => {
    const db = new Client({ connectionString: url });
    await db.connect();
    try {
      if (cargar) {
        await db.query('CREATE TABLE fixture (id uuid PRIMARY KEY, correo text NOT NULL)');
        for (const cuenta of cuentas) await db.query('INSERT INTO fixture VALUES ($1, $2)', [cuenta.id, cuenta.correo]);
      }
      const filas = await db.query('SELECT id, correo FROM fixture ORDER BY id');
      expect(filas.rows).toEqual(cuentas);
    } finally {
      await db.end();
    }
  };
  try {
    const version = await control.query('SHOW server_version_num');
    expect(version.rows[0]?.server_version_num).toMatch(/^18\d{4}$/);
    const paralela = await baseAislada002(DATABASE_URL);
    pruebas.push(paralela);
    await etapa(paralela.url, true);
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      const aislada = await baseAislada002(DATABASE_URL);
      pruebas.push(aislada);
      expect(aislada.url).not.toBe(paralela.url);
      await etapa(aislada.url, true);
      await aislada.cerrar();
      await aislada.cerrar();
      const nombre = new URL(aislada.url).pathname.slice(1);
      expect((await control.query('SELECT datname FROM pg_database WHERE datname = $1', [nombre])).rowCount).toBe(0);
      await etapa(paralela.url, false);
    }
  } finally {
    try { await Promise.all(pruebas.map(({ cerrar }) => cerrar())); }
    finally { await control.end(); }
  }
});
