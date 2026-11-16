import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

export function crearDataSource(url: string, opciones: { migrations?: DataSourceOptions['migrations']; entities?: DataSourceOptions['entities'] } = {}): DataSource {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('Se requiere PostgreSQL.');
  return new DataSource({ type: 'postgres', url, synchronize: false, logging: false, migrationsTransactionMode: 'each', migrations: opciones.migrations ?? [], entities: opciones.entities ?? [], extra: { connectionTimeoutMillis: 1500, statement_timeout: 15000, idleTimeoutMillis: 10000, max: 6 } });
}
