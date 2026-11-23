import { spawnSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';
import { crearAplicacionCompleta002 } from '../src/composicion/aplicacion-002.js';
import { cargarConfiguracion002 } from '../src/composicion/configuracion-002.js';
import { iniciarOferta002 } from '../src/composicion/main.js';
import { aplicarMigraciones002 } from '../src/composicion/migraciones-002.js';
import { sembrar002 } from '../src/composicion/semilla-002.js';
import { PortafolioS3 } from '../src/modulos/prestadores/infraestructura/archivos/portafolio-s3.js';
import { local } from './entorno.js';
import { exigirBase002, leerConfiguracion002, proyecto002 } from './entorno-002.js';

/**
 * T075 · Recursos descartables de UNA ejecución de navegadores 002: una base `ayacucho_002_test_<id>` (con migraciones y semilla), un bucket `e2e-<id>` y el espacio
 * Redis `ayacucho:002:e2e-<id>`. Solo crea y retira recursos con esos nombres exactos; nunca escribe en ayacucho_002_validacion, en su bucket ni en su espacio Redis.
 *   crear <id> --operador=<archivo>   crea la base (migrada y sembrada), el bucket y escribe la credencial del operador ficticio de ESTA base.
 *   servir <id>                       inicia la API compuesta (40 operaciones) sobre esos recursos hasta recibir una señal.
 *   retirar <id> [--operador=<archivo>]   elimina la base, el bucket y las claves Redis descartables.
 */
const accion = process.argv[2]; const id = process.argv[3] ?? '';
const opcion = (nombre: string) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
if (!/^[0-9a-f]{32}$/.test(id) || !['crear', 'servir', 'retirar'].includes(accion ?? '')) { process.stderr.write('Uso: e2e-efimero-002 <crear|servir|retirar> <id de 32 hexadecimales>\n'); process.exit(2); }
const nombres = { baseDatos: `ayacucho_002_test_${id}`, bucket: `e2e-${id}`, espacioRedis: `ayacucho:002:e2e-${id}` };
const contenedor = (servicio: string) => `${proyecto002}-${servicio}-1`;
const docker = (...args: string[]) => spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const garage = (...args: string[]) => docker('exec', contenedor('objetos'), '/garage', ...args);

function archivoOperador(): string | undefined {
  const ruta = opcion('operador'); if (!ruta) return undefined;
  const base = resolve(local, 'evidencia/002'); const destino = resolve(ruta); const d = relative(base, destino);
  if (isAbsolute(d) || d === '..' || d.startsWith(`..${sep}`)) throw new Error('La credencial del operador debe escribirse dentro de tecnologia/.local/evidencia/002.');
  return destino;
}

async function entorno(): Promise<{ env: NodeJS.ProcessEnv; adminUrl: string; urlEfimera: string }> {
  const base = await leerConfiguracion002();
  const admin = exigirBase002(base['DATABASE_URL']);
  const efimera = new URL(admin.href); efimera.pathname = `/${nombres.baseDatos}`;
  return { env: { ...base, DATABASE_URL: efimera.href, S3_BUCKET: nombres.bucket, REDIS_NAMESPACE: nombres.espacioRedis }, adminUrl: admin.href, urlEfimera: efimera.href };
}

async function sql(adminUrl: string, texto: string): Promise<void> {
  const c = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 5000 }); await c.connect();
  try { await c.query(texto); } finally { await c.end(); }
}

async function retirar(env: NodeJS.ProcessEnv, adminUrl: string): Promise<void> {
  // Objetos del bucket descartable y el bucket.
  if (garage('bucket', 'info', nombres.bucket).status === 0) {
    const cliente = new S3Client({ endpoint: env['S3_ENDPOINT']!, region: env['S3_REGION']!, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', credentials: { accessKeyId: env['S3_ACCESS_KEY_ID']!, secretAccessKey: env['S3_SECRET_ACCESS_KEY']! } });
    try {
      let token: string | undefined;
      do {
        const pagina = await cliente.send(new ListObjectsV2Command({ Bucket: nombres.bucket, ...(token ? { ContinuationToken: token } : {}) }));
        for (const o of pagina.Contents ?? []) if (o.Key) await cliente.send(new DeleteObjectCommand({ Bucket: nombres.bucket, Key: o.Key }));
        token = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
      } while (token);
    } finally { cliente.destroy(); }
    if (garage('bucket', 'delete', '--yes', nombres.bucket).status !== 0) throw new Error('No se pudo eliminar el bucket descartable.');
  }
  // Claves Redis del espacio descartable (nunca el espacio de validación).
  const claves = (docker('exec', contenedor('redis'), 'redis-cli', '--scan', '--pattern', `${nombres.espacioRedis}:*`).stdout ?? '').split(/\r?\n/).filter((k) => k.startsWith(`${nombres.espacioRedis}:`));
  for (let i = 0; i < claves.length; i += 200) docker('exec', contenedor('redis'), 'redis-cli', 'UNLINK', ...claves.slice(i, i + 200));
  await sql(adminUrl, `DROP DATABASE IF EXISTS "${nombres.baseDatos}" WITH (FORCE)`);
  const operador = archivoOperador(); if (operador) await rm(operador, { force: true });
}

try {
  if (process.env['NODE_ENV'] === 'production') throw new Error('No disponible en producción.');
  const { env, adminUrl, urlEfimera } = await entorno();
  if (accion === 'crear') {
    const operador = archivoOperador(); if (!operador) throw new Error('Falta --operador=<archivo>.');
    let creada = false;
    try {
      await sql(adminUrl, `CREATE DATABASE "${nombres.baseDatos}"`); creada = true;
      await aplicarMigraciones002(urlEfimera);
      if (garage('bucket', 'create', nombres.bucket).status !== 0) throw new Error('No se pudo crear el bucket descartable.');
      if (garage('bucket', 'allow', '--read', '--write', '--key', env['S3_ACCESS_KEY_ID']!, nombres.bucket).status !== 0) throw new Error('No se pudo autorizar el bucket descartable.');
      const config = cargarConfiguracion002(env);
      const cliente = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey } });
      const app = await crearAplicacionCompleta002(config, { prestadores: { almacen: new PortafolioS3(cliente, config.s3.bucket) }, worker: false });
      try {
        const r = await sembrar002(app, userInfo().username.toLowerCase(), config.origen);
        if (!r.credencialNueva) throw new Error('La semilla de una base nueva debe crear su operador ficticio.');
        await mkdir(dirname(operador), { recursive: true });
        await writeFile(operador, JSON.stringify(r.credencialNueva), { mode: 0o600 });
        process.stdout.write(`Entorno descartable ${id} listo: ${r.clasificaciones} clasificaciones; permiso RF39 ${r.permisoConcedido ? 'concedido' : 'vigente'}.\n`);
      } finally { await app.app.close(); cliente.destroy(); }
    } catch (error) {
      if (creada) await retirar(env, adminUrl).catch(() => undefined);
      throw error;
    }
  } else if (accion === 'servir') {
    const servicio = await iniciarOferta002(env);
    const cerrar = () => { void servicio.cerrar().finally(() => process.exit(0)); };
    process.once('SIGTERM', cerrar); process.once('SIGINT', cerrar);
  } else {
    await retirar(env, adminUrl);
    process.stdout.write(`Entorno descartable ${id} retirado.\n`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Fallo en el entorno descartable 002.'}\n`);
  process.exitCode = 1;
}
