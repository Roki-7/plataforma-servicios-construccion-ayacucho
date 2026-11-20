import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { local } from './entorno.js';

/**
 * Prepara SOLO la configuración del ensayo de restauración (T071): genera credenciales aleatorias exclusivas del ensayo en tecnologia/.local/ensayo-restauracion
 * (ignorado por Git, permisos restringidos). No inicia contenedores ni toca otros entornos. Es idempotente: no reemplaza credenciales existentes.
 * Después: docker compose -p ayacucho-ensayo-restauracion -f compose.ensayo-restauracion.yaml --env-file .local/ensayo-restauracion/compose.env up -d
 */
const carpeta = resolve(local, 'ensayo-restauracion');
const archivo = resolve(carpeta, 'ensayo.env');
try {
  if (process.env['NODE_ENV'] === 'production') throw new Error('No disponible en producción.');
  await mkdir(carpeta, { recursive: true, mode: 0o700 });
  if (existsSync(archivo)) { process.stdout.write('La configuración del ensayo ya existe y se conserva.\n'); }
  else {
    const valores = {
      ENSAYO_PG_PASSWORD: randomBytes(24).toString('hex'), ENSAYO_GARAGE_RPC_SECRET: randomBytes(32).toString('hex'),
      ENSAYO_S3_ACCESS_KEY_ID: `GK${randomBytes(16).toString('hex')}`, ENSAYO_S3_SECRET_ACCESS_KEY: randomBytes(32).toString('hex'),
      ENSAYO_RESPALDO_CLAVE: randomBytes(32).toString('base64'),
    };
    const texto = Object.entries(valores).map(([k, v]) => `${k}='${v}'`).join('\n') + '\n';
    await writeFile(archivo, texto, { mode: 0o600, flag: 'wx' });
    await writeFile(resolve(carpeta, 'compose.env'), `ENSAYO_PG_PASSWORD='${valores.ENSAYO_PG_PASSWORD}'\nENSAYO_GARAGE_RPC_SECRET='${valores.ENSAYO_GARAGE_RPC_SECRET}'\n`, { mode: 0o600, flag: 'wx' });
    process.stdout.write('Configuración del ensayo de restauración preparada (credenciales exclusivas y aleatorias).\n');
  }
  if (!(await readFile(archivo, 'utf8')).includes('ENSAYO_RESPALDO_CLAVE')) throw new Error('Configuración del ensayo incompleta.');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo preparar el ensayo.'}\n`);
  process.exitCode = 1;
}
