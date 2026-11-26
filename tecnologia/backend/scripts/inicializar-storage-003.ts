import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { local003, proyecto003, puertos003, recursos003 } from './entorno-003.js';
import { SolicitudesS3 } from '../src/modulos/solicitudes/infraestructura/archivos/solicitudes-s3.js';

// `storage:init:003` (T041). Prepara y comprueba el almacenamiento de la Garage AISLADA de la 003, que arranca sin bucket ni clave.
//
// Qué hace y qué no hace:
//  - En la composición real NO se crea ningún bucket ni identidad: la 003 usa el bucket privado único existente (`config.s3.bucket`) con el prefijo `solicitudes/`
//    y la misma identidad de la aplicación (research R-09). Este comando no se ejecuta en ese entorno.
//  - En el entorno aislado de validación la instancia de Garage está vacía. Aquí se aprovisiona UNA vez el EQUIVALENTE del bucket único
//    (`plataforma-003-validacion`) con una identidad de aplicación de lectura y escritura sobre ese bucket, sin permiso de propietario. Es idempotente y solo actúa
//    sobre el contenedor Garage del proyecto de validación 003. No crea un bucket ni una identidad adicionales para `solicitudes/`.
//  - Después comprueba (1) el acceso con la identidad al prefijo `solicitudes/` mediante el adaptador real de solicitudes y (2) la ausencia de acceso anónimo.
// Reutiliza el procedimiento de `inicializar-storage-002.ts` sin modificarlo: sus constantes y su estado son de la 002, así que no es importable.
const contenedor = `${proyecto003}-objetos-1`;
const bucket = recursos003.S3_BUCKET;
const marcador = 'sin-bucket-inicial-003';
const endpoint = recursos003.S3_ENDPOINT;

function garage(...args: string[]): { ok: boolean; salida: string } {
  const r = spawnSync('docker', ['exec', contenedor, '/garage', ...args], { encoding: 'utf8' });
  return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
function exigir(paso: string, resultado: { ok: boolean }): void {
  if (!resultado.ok) throw new Error(`No se pudo completar: ${paso}.`);
}

async function credenciales(archivo: string): Promise<{ id: string; secreto: string }> {
  const texto = await readFile(archivo, 'utf8');
  const leer = (nombre: string) => new RegExp(`^${nombre}=['"]?([^'"\\r\\n]*)['"]?\\s*$`, 'm').exec(texto)?.[1];
  const id = leer('S3_ACCESS_KEY_ID');
  const secreto = leer('S3_SECRET_ACCESS_KEY');
  if (id && secreto && /^GK[0-9a-f]{32}$/.test(id) && /^[0-9a-f]{64}$/.test(secreto)) return { id, secreto };
  const nuevas = { id: `GK${randomBytes(16).toString('hex')}`, secreto: randomBytes(32).toString('hex') };
  const sinCredenciales = texto.split(/\r?\n/).filter(l => !/^S3_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)=/.test(l) && l !== '').join('\n');
  await writeFile(archivo, `${sinCredenciales}\nS3_ACCESS_KEY_ID='${nuevas.id}'\nS3_SECRET_ACCESS_KEY='${nuevas.secreto}'\n`);
  return nuevas;
}

/** Una petición sin firma debe ser rechazada: 401 o 403. Cualquier otro estado indica acceso anónimo o un servicio mal configurado. */
async function anonimoRechazado(metodo: 'GET' | 'PUT' | 'DELETE', ruta: string): Promise<void> {
  const respuesta = await fetch(`${endpoint}${ruta}`, { method: metodo, ...(metodo === 'PUT' ? { body: 'x' } : {}), signal: AbortSignal.timeout(8000) });
  await respuesta.arrayBuffer();
  if (respuesta.status !== 401 && respuesta.status !== 403) throw new Error(`Acceso anónimo no rechazado (${metodo}).`);
}

try {
  if (process.env['NODE_ENV'] === 'production') throw new Error('No disponible en producción.');
  const archivo = resolve(local003, 'backend.env');
  const { id, secreto } = await credenciales(archivo);
  if (id === marcador) throw new Error('Credenciales de marcador.');
  if (!garage('status').ok) throw new Error('Garage de la 003 no responde.');
  if (!garage('key', 'info', id).ok) exigir('importar la identidad de la aplicación', garage('key', 'import', '--yes', '-n', 'aplicacion-003', id, secreto));
  if (!garage('bucket', 'info', bucket).ok) exigir('crear el bucket equivalente al único de la composición', garage('bucket', 'create', bucket));
  // Solo lectura y escritura sobre este bucket. Sin permiso de propietario ni de creación de buckets.
  exigir('limitar la identidad al bucket', garage('bucket', 'allow', '--read', '--write', '--key', id, bucket));
  // El bucket no puede ser un sitio web ni tener acceso anónimo.
  const informacion = garage('bucket', 'info', bucket);
  exigir('consultar el bucket', informacion);
  if (/website access:\s*true/i.test(informacion.salida)) throw new Error('El bucket expone acceso web.');

  const cliente = new S3Client({ endpoint, region: 'garage', forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', credentials: { accessKeyId: id, secretAccessKey: secreto } });
  try {
    // 1. Acceso con la identidad al bucket y al prefijo `solicitudes/` mediante el adaptador real, con un prefijo de prueba que se limpia.
    await cliente.send(new HeadBucketCommand({ Bucket: bucket }), { abortSignal: AbortSignal.timeout(8000) });
    await cliente.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'solicitudes/', MaxKeys: 1 }), { abortSignal: AbortSignal.timeout(8000) });
    const sonda = new SolicitudesS3(cliente, bucket, `pruebas/${randomUUID()}/solicitudes/`);
    const clave = sonda.claveNueva(randomUUID(), randomUUID());
    const contenido = new Uint8Array(randomBytes(16));
    await sonda.guardar(clave, contenido);
    const leido = await sonda.leer(clave);
    await sonda.eliminar(clave);
    if (Buffer.compare(Buffer.from(leido), Buffer.from(contenido)) !== 0) throw new Error('La lectura de comprobación no coincide con lo guardado.');
    // 2. Sin acceso anónimo: listar, leer, escribir y borrar sin firma.
    await anonimoRechazado('GET', `/${bucket}?list-type=2&prefix=solicitudes%2F`);
    await anonimoRechazado('GET', `/${bucket}/${clave}`);
    await anonimoRechazado('PUT', `/${bucket}/pruebas/anonimo`);
    await anonimoRechazado('DELETE', `/${bucket}/${clave}`);
  } finally { cliente.destroy(); }
  process.stdout.write(`Almacenamiento 003 verificado: bucket privado equivalente al único de la composición, prefijo solicitudes/ accesible con la identidad de la aplicación y sin acceso anónimo (puerto ${puertos003.objetos}).\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Fallo al preparar el almacenamiento de la 003.'}\n`);
  process.exitCode = 1;
}
