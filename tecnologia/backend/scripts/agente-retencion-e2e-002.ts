import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { setTimeout as esperar } from 'node:timers/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';
import { local } from './entorno.js';
import { exigirBase002, leerConfiguracion002 } from './entorno-002.js';

/**
 * T076 · Agente de retención de la confirmación de una fotografía (CA-PRE-06), solo para la base DESCARTABLE de una corrida.
 * Reproduce, para el navegador, lo que las pruebas de backend hacen con un bloqueo de fila: retiene el perfil del prestador con `FOR UPDATE` para que el alta de una
 * fotografía quede con su objeto ya escrito pero aún sin vincular (pendiente), informa su identificador y libera el bloqueo cuando la prueba lo indica.
 * Se comunica únicamente con archivos de señal en la evidencia 002: la prueba nunca recibe credenciales ni acceso a la base.
 *   retener-<token>.json  {prestadorId}  -> retenida-<token>.json  -> pendiente-<token>.json {fotografiaId}  -> (la prueba crea) liberar-<token>.json -> liberada-<token>.json
 * Se detiene al desaparecer la carpeta de señales (la retira el orquestador) o a los 30 minutos. Todo bloqueo se libera a los 30 s como máximo.
 */
const id = process.argv[2] ?? ''; const carpeta = process.argv.find((a) => a.startsWith('--senales='))?.slice('--senales='.length);
if (!/^[0-9a-f]{32}$/.test(id) || !carpeta) { process.stderr.write('Uso: agente-retencion-e2e-002 <id de 32 hexadecimales> --senales=<carpeta>\n'); process.exit(2); }
const senales = resolve(carpeta); const desplazamiento = relative(resolve(local, 'evidencia/002'), senales);
if (isAbsolute(desplazamiento) || desplazamiento === '..' || desplazamiento.startsWith(`..${sep}`)) { process.stderr.write('Las señales deben estar dentro de tecnologia/.local/evidencia/002.\n'); process.exit(2); }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const maximoMs = 30_000;

const base = await leerConfiguracion002();
const urlEfimera = new URL(exigirBase002(base['DATABASE_URL']).href); urlEfimera.pathname = `/ayacucho_002_test_${id}`;
const bucket = `e2e-${id}`;
const s3 = new S3Client({ endpoint: base['S3_ENDPOINT']!, region: base['S3_REGION']!, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED', credentials: { accessKeyId: base['S3_ACCESS_KEY_ID']!, secretAccessKey: base['S3_SECRET_ACCESS_KEY']! } });

async function claves(prefijo: string): Promise<string[]> {
  const todas: string[] = []; let token: string | undefined;
  do {
    const p = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefijo, ...(token ? { ContinuationToken: token } : {}) }));
    for (const o of p.Contents ?? []) if (o.Key) todas.push(o.Key);
    token = p.IsTruncated ? p.NextContinuationToken : undefined;
  } while (token);
  return todas;
}
const escribir = async (nombre: string, datos: object) => { const tmp = resolve(senales, `${nombre}.tmp`); await writeFile(tmp, JSON.stringify(datos)); await rename(tmp, resolve(senales, nombre)); };
const legible = (nombre: string) => readFile(resolve(senales, nombre), 'utf8').then((x) => { JSON.parse(x); return true; }, () => false);
const existe = (nombre: string) => readFile(resolve(senales, nombre)).then(() => true, () => false);
async function hasta(condicion: () => Promise<boolean>, ms: number): Promise<boolean> { const fin = Date.now() + ms; while (Date.now() < fin) { if (await condicion()) return true; await esperar(100); } return false; }

async function atender(token: string): Promise<void> {
  const peticion = JSON.parse(await readFile(resolve(senales, `retener-${token}.json`), 'utf8')) as { prestadorId?: string };
  if (!peticion.prestadorId || !uuid.test(peticion.prestadorId)) { await escribir(`error-${token}.json`, { error: 'prestadorId no válido' }); return; }
  const cliente = new pg.Client({ connectionString: urlEfimera.href, connectionTimeoutMillis: 5000 }); await cliente.connect();
  try {
    await cliente.query('BEGIN');
    const fila = await cliente.query('SELECT id FROM prestadores_perfiles WHERE id = $1 FOR UPDATE', [peticion.prestadorId]);
    if (fila.rowCount !== 1) { await escribir(`error-${token}.json`, { error: 'perfil inexistente en la base descartable' }); return; }
    const prefijo = `portafolio/${peticion.prestadorId}/`; const previas = new Set(await claves(prefijo));
    await escribir(`retenida-${token}.json`, { prestadorId: peticion.prestadorId });
    let nueva: string | undefined;
    await hasta(async () => { nueva = (await claves(prefijo)).find((k) => !previas.has(k)); return nueva !== undefined; }, maximoMs);
    await escribir(`pendiente-${token}.json`, nueva ? { fotografiaId: nueva.split('/').at(-1) } : { fotografiaId: null });
    await hasta(() => existe(`liberar-${token}.json`), maximoMs);
  } finally {
    await cliente.query('COMMIT').catch(() => undefined); await cliente.end().catch(() => undefined);
    await escribir(`liberada-${token}.json`, {});
  }
}

await mkdir(senales, { recursive: true });
const procesadas = new Set<string>(); const inicio = Date.now();
const salir = () => { s3.destroy(); process.exit(0); };
process.once('SIGTERM', salir); process.once('SIGINT', salir);
process.stdout.write('Agente de retención listo.\n');
for (;;) {
  const nombres = await readdir(senales).catch(() => undefined);
  if (!nombres || Date.now() - inicio > 30 * 60_000) { s3.destroy(); break; }
  for (const nombre of nombres) {
    const m = /^retener-([0-9a-f]{32})\.json$/.exec(nombre);
    // Una petición aún incompleta se vuelve a leer en la vuelta siguiente (no se marca como procesada).
    if (m && !procesadas.has(m[1]!) && await legible(nombre)) { procesadas.add(m[1]!); await atender(m[1]!).catch(async (e: unknown) => { await escribir(`error-${m[1]!}.json`, { error: e instanceof Error ? e.message.slice(0, 200) : 'fallo' }).catch(() => undefined); }); }
  }
  await esperar(150);
}
