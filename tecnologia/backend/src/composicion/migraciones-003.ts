import type { RegistroPersistencia002 } from './persistencia.js';
import { persistencia003 } from './persistencia.js';
import { Solicitudes1796000000001 } from '../modulos/solicitudes/infraestructura/migraciones/solicitudes.js';
import { Cotizaciones1796000000002 } from '../modulos/cotizaciones/infraestructura/migraciones/cotizaciones.js';
import { AvisosNegocio1796000000003 } from '../modulos/notificaciones/infraestructura/migraciones/avisos-negocio.js';
import { persistenciaOferta002 } from './oferta-002.js';

/**
 * Migraciones aditivas de la 003 en orden cronológico, todas posteriores a `1795000000009` (la última de la 002). Cada módulo registra la suya con la tarea
 * que la crea: `1796000000001` (Solicitudes), `1796000000002` (Cotizaciones) y `1796000000003` (Notificaciones).
 */
export const persistenciaOferta003: readonly RegistroPersistencia002[] = [{ migraciones: [Solicitudes1796000000001, Cotizaciones1796000000002, AvisosNegocio1796000000003] }];

/** Aplica las migraciones de la 001, las de la 002 y las de la 003 sobre la base indicada. Devuelve cuántas se aplicaron. */
export async function aplicarMigraciones003(url: string): Promise<number> {
  const db = persistencia003(url, persistenciaOferta002, persistenciaOferta003);
  await db.initialize();
  try { return (await db.runMigrations({ transaction: 'each' })).length; }
  finally { await db.destroy(); }
}
