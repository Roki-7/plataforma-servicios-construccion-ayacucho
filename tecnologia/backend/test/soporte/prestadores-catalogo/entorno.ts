import { mkdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { local } from '../../../scripts/entorno.js';
import { leerConfiguracion002 } from '../../../scripts/entorno-002.js';
import type { Configuracion } from '../../../src/composicion/configuracion.js';

export const evidencia002 = resolve(local, 'evidencia/002');

export async function configuracionDePrueba002(databaseUrl: string): Promise<Configuracion> {
  const env = await leerConfiguracion002();
  // Servicios incluidos por la composición base. Las pruebas de S3 se habilitarán con su propio bucket de prueba.
  return {
    validacion: true, puerto: Number(env['PORT']), origen: env['PUBLIC_ORIGIN']!, urlPublica: env['PUBLIC_URL']!, databaseUrl,
    catalogo: env['CATALOGO_MANIFIESTO']!, contrato: resolve('contracts/openapi.json'),
    hmacId: 'prueba', hmac: new Map([['prueba', Buffer.alloc(32, 1)]]),
    aeadId: 'prueba', aead: new Map([['prueba', Buffer.alloc(32, 2)]]),
    smtp: { host: env['SMTP_HOST']!, port: Number(env['SMTP_PORT']), secure: false, from: 'pruebas002@example.invalid', validacion: true },
    s3: { endpoint: env['S3_ENDPOINT']!, region: env['S3_REGION']!, bucket: env['S3_BUCKET']!, accessKeyId: 'fixture-002', secretAccessKey: 'fixture-002' },
  };
}

export async function prepararEvidencia002(carpeta = evidencia002): Promise<{ JEST_JUNIT_OUTPUT_DIR: string; E2E_EVIDENCIA: string }> {
  const destino = resolve(carpeta);
  const desplazamiento = relative(evidencia002, destino);
  if (isAbsolute(desplazamiento) || desplazamiento === '..' || desplazamiento.startsWith(`..${sep}`)) {
    throw new Error('La evidencia debe quedar dentro de tecnologia/.local/evidencia/002.');
  }
  const baseReal = await realpath(local);
  for (let ruta = destino; relative(local, ruta) !== ''; ruta = dirname(ruta)) {
    const real = await realpath(ruta).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return undefined;
    });
    if (real && relative(baseReal, real) !== relative(local, ruta)) throw new Error('La evidencia apunta fuera de la 002.');
  }
  await mkdir(destino, { recursive: true });
  const destinoReal = await realpath(destino);
  if (relative(baseReal, destinoReal) !== relative(local, destino)) throw new Error('La evidencia apunta fuera de la 002.');
  return { JEST_JUNIT_OUTPUT_DIR: destinoReal, E2E_EVIDENCIA: destinoReal };
}
