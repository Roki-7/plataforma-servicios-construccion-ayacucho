import { persistencia002 } from '../src/composicion/persistencia.js';
import { exigirBase002, leerConfiguracion002 } from './entorno-002.js';

try {
  const configuracion = await leerConfiguracion002();
  const db = persistencia002(exigirBase002(configuracion['DATABASE_URL']).href);
  await db.initialize();
  try {
    const aplicadas = await db.runMigrations({ transaction: 'each' });
    process.stdout.write(`Migraciones de la 002 aplicadas: ${aplicadas.length}.\n`);
  } finally { await db.destroy(); }
} catch {
  process.stderr.write('No se pudieron aplicar las migraciones en la base dedicada de la 002.\n');
  process.exitCode = 1;
}
