import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, readFile, realpath, rename, writeFile, unlink, rmdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parse } from 'dotenv';
import { local, tecnologia } from './entorno.js';
import { comprobarRuntime } from '../src/composicion/runtime.js';
import { base002, exigirBase002, local002, origen002, puertos002, recursos002, usuario002 } from './entorno-002.js';

async function guardar(ruta: string, contenido: string): Promise<void> {
  const archivo = await lstat(ruta).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (archivo) {
    if (!archivo.isFile() || archivo.isSymbolicLink() || await readFile(ruta, 'utf8') !== contenido) {
      throw new Error('Hay un archivo local 002 incompatible con la preparación.');
    }
    return;
  }
  await writeFile(ruta, contenido, { mode: 0o600, flag: 'wx' });
}

function comoEnv(valores: Record<string, string>): string {
  return Object.entries(valores).map(([clave, valor]) => `${clave}='${valor}'`).join('\n') + '\n';
}

async function prepararConfiguracion(): Promise<void> {
  const ruta = resolve(local002, 'backend.env');
  const existe = existsSync(ruta);
  if (existe && !(await lstat(ruta)).isFile()) throw new Error('Se requiere un archivo de configuración local 002.');
  const anterior = existe ? parse(await readFile(ruta)) : undefined;
  const aleatorio = () => randomBytes(24).toString('hex');
  const clave = () => JSON.stringify({ v1: randomBytes(32).toString('base64') });
  const valores = anterior ?? {
    ...recursos002, NODE_ENV: 'validation',
    DATABASE_URL: `postgresql://${usuario002}:${aleatorio()}@127.0.0.1:${puertos002.postgres}/${base002}`,
    HMAC_KEY_ID: 'v1', HMAC_KEYS_JSON: clave(), AEAD_KEY_ID: 'v1', AEAD_KEYS_JSON: clave(),
    SMTP_FROM: 'seguridad@example.invalid', GARAGE_RPC_SECRET: randomBytes(32).toString('hex'),
  };
  const secretoGarage = valores['GARAGE_RPC_SECRET'];
  if (valores['NODE_ENV'] !== 'validation' || !secretoGarage || !/^[a-f0-9]{64}$/.test(secretoGarage) ||
      Object.entries(recursos002).some(([k, v]) => valores[k] !== v)) throw new Error('Configuración local incompatible con validación 002.');
  const db = exigirBase002(valores['DATABASE_URL']);
  if (!/^[a-f0-9]{48}$/.test(db.password)) throw new Error('Credencial de PostgreSQL local incompatible con validación 002.');
  if (!existe) await guardar(ruta, comoEnv(valores));
  await guardar(resolve(local002, 'compose.env'), comoEnv({
    POSTGRES_PASSWORD: db.password, GARAGE_RPC_SECRET: secretoGarage,
    // Compose interpola el archivo base antes de eliminar estas variables en el overlay.
    S3_ACCESS_KEY_ID: 'sin-bucket-inicial-002', S3_SECRET_ACCESS_KEY: 'sin-bucket-inicial-002',
  }));
}

async function prepararCatalogo(): Promise<void> {
  const carpeta = resolve(local002, 'catalogo');
  const comunes = JSON.stringify(['contrasena comun de prueba 002', '123456789012345']) + '\n';
  const hashes = ['comprometida ficticia de portafolio', 'comprometida ficticia de catalogo']
    .map((texto) => createHash('sha1').update(texto).digest('hex').toUpperCase()).sort().join('\n') + '\n';
  const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');
  await guardar(resolve(carpeta, 'comunes.json'), comunes);
  await guardar(resolve(carpeta, 'comprometidas.sha1'), hashes);
  await guardar(resolve(carpeta, 'manifest.json'), JSON.stringify({
    version: 'fixture-002-v1', fecha: '2026-11-18', tipo: 'fixture', aprobado: true,
    comunes: { archivo: 'comunes.json', sha256: sha256(comunes) },
    comprometidas: { archivo: 'comprometidas.sha1', sha256: sha256(hashes), registros: 2 },
  }, null, 2) + '\n');
}

async function prepararTls(): Promise<void> {
  const tls = resolve(local002, 'tls');
  const gitOpenSsl = 'C:/Program Files/Git/usr/bin/openssl.exe';
  const openssl = process.platform === 'win32' && existsSync(gitOpenSsl) ? gitOpenSsl : 'openssl';
  const ejecutar = (...args: string[]) => execFileSync(openssl, args, { stdio: 'pipe' });
  const ca = resolve(tls, 'ca.crt');
  const leaf = resolve(tls, 'localhost.crt');
  for (const nombre of ['ca.key', 'ca.crt', 'localhost.key', 'localhost.crt']) {
    const archivo = await lstat(resolve(tls, nombre)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return undefined;
    });
    if (archivo && !archivo.isFile()) throw new Error('El material TLS debe estar en archivos locales de la 002.');
  }
  if (!existsSync(ca) && !existsSync(leaf)) {
    const temporal = await mkdtemp(resolve(tls, 'generacion-'));
    const ruta = (nombre: string) => resolve(temporal, nombre);
    const archivos = ['ca.key', 'ca.crt', 'localhost.key', 'localhost.crt'];
    try {
      await writeFile(ruta('ext.cnf'), 'subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n');
      ejecutar('req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-keyout', ruta('ca.key'), '-out', ruta('ca.crt'),
        '-days', '30', '-subj', '/CN=Ayacucho Validacion Local 002 CA', '-addext', 'basicConstraints=critical,CA:TRUE');
      ejecutar('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', ruta('localhost.key'), '-out', ruta('localhost.csr'), '-subj', '/CN=localhost');
      ejecutar('x509', '-req', '-in', ruta('localhost.csr'), '-CA', ruta('ca.crt'), '-CAkey', ruta('ca.key'),
        '-set_serial', `0x${randomUUID().replaceAll('-', '')}`, '-out', ruta('localhost.crt'), '-days', '30', '-extfile', ruta('ext.cnf'));
      for (const nombre of archivos) {
        if (nombre.endsWith('.key')) await chmod(ruta(nombre), 0o600);
        await rename(ruta(nombre), resolve(tls, nombre));
      }
    } finally {
      for (const nombre of [...archivos, 'localhost.csr', 'ext.cnf']) {
        await unlink(ruta(nombre)).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
      }
      await rmdir(temporal);
    }
  }
  ejecutar('verify', '-CAfile', ca, '-verify_hostname', 'localhost', leaf);
  for (const nombre of ['ca.key', 'localhost.key']) {
    const llave = resolve(tls, nombre);
    if (!(await lstat(llave)).isFile()) throw new Error('La clave TLS debe ser un archivo local de la 002.');
    const publica = ejecutar('pkey', '-in', llave, '-pubout');
    const certificado = nombre === 'ca.key' ? ca : leaf;
    if (!publica.equals(ejecutar('x509', '-in', certificado, '-pubkey', '-noout'))) throw new Error('La clave TLS local no coincide con su certificado.');
  }
}

async function prepararProxy(): Promise<void> {
  const plantilla = await readFile(resolve(tecnologia, 'infra/Caddyfile'), 'utf8');
  const proxy = plantilla.replace('https://localhost:8443 {', `${origen002} {`)
    .replace('host.docker.internal:3000', `host.docker.internal:${puertos002.api}`)
    .replace('host.docker.internal:5173', `host.docker.internal:${puertos002.web}`);
  if (!proxy.includes(`${origen002} {`) || !proxy.includes('max_size 14000000') ||
      !proxy.includes(`host.docker.internal:${puertos002.api}`) || !proxy.includes(`host.docker.internal:${puertos002.web}`)) {
    throw new Error('La plantilla de Caddy no coincide con la configuración esperada de la 002.');
  }
  await guardar(resolve(local002, 'Caddyfile'), proxy);
}

comprobarRuntime();
if (!process.argv.includes('--validation') || process.env['NODE_ENV'] === 'production') {
  throw new Error('Preparación 002 disponible solo con --validation y fuera de producción.');
}
for (const subdirectorio of ['', 'catalogo', 'tls']) {
  const carpeta = resolve(local002, subdirectorio);
  await mkdir(carpeta, { recursive: true, mode: 0o700 });
  if (relative(await realpath(local), await realpath(carpeta)) !== relative(local, carpeta)) {
    throw new Error('La preparación solo puede escribir dentro del directorio local de la 002.');
  }
}
await prepararConfiguracion();
await prepararCatalogo();
await prepararTls();
await prepararProxy();
process.stdout.write('Configuración, TLS y catálogo ficticio preparados en tecnologia/.local/002.\n');
