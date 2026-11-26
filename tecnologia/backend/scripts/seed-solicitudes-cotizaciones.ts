import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { crearAplicacionCompleta002 } from '../src/composicion/aplicacion-002.js';
import { cargarConfiguracion003 } from '../src/composicion/configuracion-003.js';
import { almacenEnMemoria003 } from '../test/soporte/solicitudes-cotizaciones/entorno.js';
import { marcadorDeSiembra003, sembrarDatos003 } from '../test/soporte/solicitudes-cotizaciones/datos.js';
import { exigirBase003, leerConfiguracion003, local003 } from './entorno-003.js';

// `test:seed:003`. Datos ficticios deterministas para la validación local de la 003. Solo actúa sobre la base dedicada `ayacucho_003_validacion`: nunca sobre la
// de la 002 ni la de la 001. Requiere haber ejecutado antes dev:prepare:003, el arranque de Compose, db:migrate:003 y storage:init:003 (pasos separados).
// Es idempotente: si el catálogo ficticio ya existe, no hace nada. Las credenciales ficticias quedan solo en `tecnologia/.local/003/` (ignorado por Git).
try {
  const env = await leerConfiguracion003();
  exigirBase003(env['DATABASE_URL']);
  const config = cargarConfiguracion003(env);
  const app = await crearAplicacionCompleta002(config, { prestadores: { almacen: almacenEnMemoria003() }, worker: false });
  try {
    const existente = await app.db.query('SELECT 1 FROM catalogo_clasificaciones WHERE id=$1', [marcadorDeSiembra003]) as unknown[];
    if (existente.length) {
      process.stdout.write('Semilla 003: los datos ficticios ya existen; no se modificó nada.\n');
    } else {
      const datos = await sembrarDatos003(app, config.origen);
      const credenciales = [...Object.values(datos.clientes), ...Object.values(datos.prestadores)].map(c => ({ clave: c.clave, correo: c.correo, contrasena: c.contrasena, perfiles: c.perfiles }));
      await writeFile(resolve(local003, 'cuentas-ficticias.json'), JSON.stringify(credenciales, null, 2), { mode: 0o600 });
      process.stdout.write(`Semilla 003: ${Object.keys(datos.clientes).length} clientes, ${Object.keys(datos.prestadores).length} prestadores y 5 categorías ficticias.\n`);
    }
  } finally { await app.app.close(); }
} catch {
  process.stderr.write('No se pudo sembrar la base dedicada de la 003.\n');
  process.exitCode = 1;
}
