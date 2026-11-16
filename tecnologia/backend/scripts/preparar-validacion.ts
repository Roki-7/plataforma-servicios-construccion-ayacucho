import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from 'dotenv';
import { comprobarRuntime } from '../src/composicion/runtime.js';
import { local, tecnologia } from './entorno.js';

comprobarRuntime();
if (!process.argv.includes('--validation') || process.env['NODE_ENV'] === 'production') throw new Error('Preparación disponible solo con --validation y fuera de producción.');
await mkdir(local, { recursive: true });
const ruta = resolve(local, 'backend.env');
let existente: Record<string, string> | undefined;
try { existente = parse(await readFile(ruta)); } catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error; }
if (existente && (existente['VALIDATION_MODE'] !== 'true' || !existente['DATABASE_URL']?.includes('/ayacucho_001_validacion'))) throw new Error('No se sobrescribe una configuración ajena a validación.');
if (!existente) {
  const password = randomBytes(24).toString('hex');
  const values = {
    NODE_ENV: 'validation', VALIDATION_MODE: 'true', PORT: '3000', PUBLIC_ORIGIN: 'https://localhost:8443', PUBLIC_URL: 'https://localhost:8443',
    DATABASE_URL: `postgresql://ayacucho_validacion:${password}@127.0.0.1:54329/ayacucho_001_validacion`,
    CATALOGO_MANIFIESTO: resolve(local, 'catalogo/manifest.json').replaceAll('\\', '/'),
    HMAC_KEY_ID: 'v1', HMAC_KEYS_JSON: JSON.stringify({ v1: randomBytes(32).toString('base64') }),
    AEAD_KEY_ID: 'v1', AEAD_KEYS_JSON: JSON.stringify({ v1: randomBytes(32).toString('base64') }),
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_SECURE: 'false', SMTP_FROM: 'seguridad@example.invalid',
    S3_ENDPOINT: 'http://127.0.0.1:3900', S3_REGION: 'garage', S3_BUCKET: 'usuarios-validacion', S3_ACCESS_KEY_ID: 'GK' + randomBytes(16).toString('hex'), S3_SECRET_ACCESS_KEY: randomBytes(32).toString('hex'),
  };
  await writeFile(ruta, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  const compose = { POSTGRES_PASSWORD: password, GARAGE_RPC_SECRET: randomBytes(32).toString('hex'), S3_ACCESS_KEY_ID: values.S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY: values.S3_SECRET_ACCESS_KEY };
  await writeFile(resolve(tecnologia, '.env'), Object.entries(compose).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
}
execFileSync('docker', ['compose', '-f', resolve(tecnologia, 'compose.yaml'), 'config', '--quiet'], { stdio: 'pipe' });
if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(tecnologia, 'scripts/preparar-tls.ps1')], { stdio: 'pipe' });
else throw new Error('Prepare los certificados locales con OpenSSL antes de iniciar el proxy en esta plataforma.');
process.stdout.write('Configuración local y TLS preparados; secretos conservados fuera de Git.\n');
