import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import type { DataSource } from 'typeorm';

export function exigirBaseValidacion(url: string): URL {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', 'postgres', 'host.docker.internal'].includes(parsed.hostname) || !/^\/ayacucho_001_(?:validacion|test_[a-z0-9_]+)$/.test(parsed.pathname)) {
    throw new Error('Se requiere una base local de validación identificada explícitamente.');
  }
  return parsed;
}

export async function baseAislada(factory: (url: string) => DataSource, origen: string): Promise<{ db: DataSource; cerrar: () => Promise<void> }> {
  const url = exigirBaseValidacion(origen);
  const nombre = `ayacucho_001_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Client({ connectionString: origen });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${nombre}"`);
  url.pathname = `/${nombre}`;
  const db = factory(url.href);
  try { await db.initialize(); await db.runMigrations({ transaction: 'each' }); }
  catch (error) { await admin.query(`DROP DATABASE "${nombre}" WITH (FORCE)`); await admin.end(); throw error; }
  return { db, cerrar: async () => {
    if (db.isInitialized) await db.destroy();
    if (!/^ayacucho_001_test_[a-f0-9]{32}$/.test(nombre)) throw new Error('Nombre de base temporal fuera de alcance.');
    await admin.query(`DROP DATABASE "${nombre}" WITH (FORCE)`);
    await admin.end();
  } };
}

export class Barrera {
  private liberar!: () => void;
  private llegadas = 0;
  private readonly abierta = new Promise<void>((resolve) => { this.liberar = resolve; });
  constructor(private readonly participantes: number) {}
  async esperar(): Promise<void> { if (++this.llegadas === this.participantes) this.liberar(); await this.abierta; }
}
