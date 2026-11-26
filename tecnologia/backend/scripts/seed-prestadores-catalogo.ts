import { userInfo } from 'node:os';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { S3Client } from '@aws-sdk/client-s3';
import { crearAplicacionCompleta002 } from '../src/composicion/aplicacion-002.js';
import { cargarConfiguracion002 } from '../src/composicion/configuracion-002.js';
import { sembrar002 } from '../src/composicion/semilla-002.js';
import { PortafolioS3 } from '../src/modulos/prestadores/infraestructura/archivos/portafolio-s3.js';
import { exigirBase002, leerConfiguracion002, local002 } from './entorno-002.js';

// Datos ficticios deterministas para la validación local de la 002. Solo actúa sobre la base dedicada ayacucho_002_validacion.
// Requiere haber ejecutado antes dev:prepare:002, el arranque de Compose, db:migrate:002 y storage:init:002 (pasos separados).
try {
  const env = await leerConfiguracion002();
  exigirBase002(env['DATABASE_URL']);
  const config = cargarConfiguracion002(env);
  const cliente = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey } });
  const app = await crearAplicacionCompleta002(config, { prestadores: { almacen: new PortafolioS3(cliente, config.s3.bucket) }, worker: false });
  try {
    const r = await sembrar002(app, userInfo().username.toLowerCase(), config.origen);
    if (r.credencialNueva) {
      // La credencial ficticia queda solo en el directorio local ignorado por Git, con permisos restringidos.
      await writeFile(resolve(local002, 'operador-ficticio.json'), JSON.stringify(r.credencialNueva), { mode: 0o600 });
    }
    process.stdout.write(`Semilla 002: ${r.clasificaciones} clasificaciones; permiso RF39 ${r.permisoConcedido ? 'concedido' : 'ya vigente'}.\n`);
  } finally { await app.app.close(); cliente.destroy(); }
} catch {
  process.stderr.write('No se pudo sembrar la base dedicada de la 002.\n');
  process.exitCode = 1;
}
