import { aplicarMigraciones003 } from '../src/composicion/migraciones-003.js';
import { exigirBase003, leerConfiguracion003 } from './entorno-003.js';

// `db:migrate:003`. Aplica las migraciones de la 001, la 002 y la 003 (1796000000001 a 1796000000003) solo sobre la base dedicada `ayacucho_003_validacion`.
try {
  const configuracion = await leerConfiguracion003();
  const aplicadas = await aplicarMigraciones003(exigirBase003(configuracion['DATABASE_URL']).href);
  process.stdout.write(`Migraciones de la 003 aplicadas: ${aplicadas}.\n`);
} catch {
  process.stderr.write('No se pudieron aplicar las migraciones en la base dedicada de la 003.\n');
  process.exitCode = 1;
}
