import { persistencia002 } from './persistencia.js';
import { persistenciaOferta002 } from './oferta-002.js';

/** Aplica las migraciones fundacionales de la 001, las comunes y las aditivas de la 002 sobre la base indicada. Devuelve cuántas se aplicaron. */
export async function aplicarMigraciones002(url: string): Promise<number> {
  const db = persistencia002(url, persistenciaOferta002);
  await db.initialize();
  try { return (await db.runMigrations({ transaction: 'each' })).length; }
  finally { await db.destroy(); }
}
