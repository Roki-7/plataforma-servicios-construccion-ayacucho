import { aplicarMigraciones002 } from '../src/composicion/migraciones-002.js';
import { exigirBase002, leerConfiguracion002 } from './entorno-002.js';

try {
  const configuracion = await leerConfiguracion002();
  const aplicadas = await aplicarMigraciones002(exigirBase002(configuracion['DATABASE_URL']).href);
  process.stdout.write(`Migraciones de la 002 aplicadas: ${aplicadas}.\n`);
} catch {
  process.stderr.write('No se pudieron aplicar las migraciones en la base dedicada de la 002.\n');
  process.exitCode = 1;
}
