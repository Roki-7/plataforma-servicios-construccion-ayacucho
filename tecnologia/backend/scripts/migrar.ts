import { cargarLocal } from './entorno.js';
import { cargarConfiguracion } from '../src/composicion/configuracion.js';
import { persistenciaFundacional } from '../src/composicion/persistencia.js';
cargarLocal();
const config = cargarConfiguracion(); const db = persistenciaFundacional(config.databaseUrl);
try { await db.initialize(); const migraciones = await db.runMigrations({ transaction: 'each' }); process.stdout.write(`Migraciones fundacionales aplicadas: ${migraciones.length}.\n`); }
catch { process.stderr.write('No fue posible aplicar las migraciones.\n'); process.exitCode = 1; }
finally { if (db.isInitialized) await db.destroy(); }
