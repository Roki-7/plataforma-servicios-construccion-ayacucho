import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HeadBucketCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { local002, proyecto002, puertos002, recursos002 } from './entorno-002.js';

// Aprovisiona el bucket privado de portafolio de 002 y una identidad exclusiva con permisos de lectura y escritura sobre ese bucket.
// Es idempotente. Solo actúa sobre el contenedor Garage del proyecto de validación 002.
const contenedor = `${proyecto002}-objetos-1`;
const bucket = recursos002.S3_BUCKET;
const marcador = 'sin-bucket-inicial-002';

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

try {
  if (process.env['NODE_ENV'] === 'production') throw new Error('No disponible en producción.');
  const archivo = resolve(local002, 'backend.env');
  const { id, secreto } = await credenciales(archivo);
  if (id === marcador) throw new Error('Credenciales de marcador.');
  if (!garage('status').ok) throw new Error('Garage de la 002 no responde.');
  if (!garage('key', 'info', id).ok) exigir('importar la identidad del portafolio', garage('key', 'import', '--yes', '-n', 'portafolio-002', id, secreto));
  if (!garage('bucket', 'info', bucket).ok) exigir('crear el bucket de portafolio', garage('bucket', 'create', bucket));
  // Solo lectura y escritura sobre este bucket. Sin permiso de propietario ni de creación de buckets.
  exigir('limitar la identidad al bucket', garage('bucket', 'allow', '--read', '--write', '--key', id, bucket));
  const cliente = new S3Client({ endpoint: `http://127.0.0.1:${puertos002.objetos}`, region: 'garage', forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: id, secretAccessKey: secreto } });
  try {
    await cliente.send(new HeadBucketCommand({ Bucket: bucket }), { abortSignal: AbortSignal.timeout(8000) });
    await cliente.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }), { abortSignal: AbortSignal.timeout(8000) });
  } finally { cliente.destroy(); }
  process.stdout.write('Bucket privado de portafolio 002 disponible con identidad exclusiva.\n');
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Fallo al preparar el almacenamiento de la 002.'}\n`);
  process.exitCode = 1;
}
