import { resolve } from 'node:path';
import { comprobarRuntime } from './runtime.js';

export interface Configuracion {
  validacion: boolean; puerto: number; origen: string; urlPublica: string; databaseUrl: string; catalogo: string; contrato: string;
  hmacId: string; hmac: ReadonlyMap<string, Buffer>; aeadId: string; aead: ReadonlyMap<string, Buffer>;
  smtp: { host: string; port: number; secure: boolean; from: string; validacion: boolean; usuario?: string; contrasena?: string };
  s3: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };
}
function requerido(env: NodeJS.ProcessEnv, nombre: string): string { const valor = env[nombre]; if (!valor) throw new Error(`Falta configuración: ${nombre}.`); return valor; }
function claves(valor: string): ReadonlyMap<string, Buffer> {
  const parsed: unknown = JSON.parse(valor);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Configuración de claves no válida.');
  const result = new Map<string, Buffer>();
  for (const [id, entrada] of Object.entries(parsed)) {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id) || typeof entrada !== 'string') throw new Error('Configuración de claves no válida.');
    const key = Buffer.from(entrada, 'base64'); if (key.length !== 32 || key.toString('base64') !== entrada) throw new Error('Se requieren claves aleatorias de 32 bytes en base64.');
    result.set(id, key);
  }
  return result;
}
export function cargarConfiguracion(env: NodeJS.ProcessEnv = process.env): Configuracion {
  comprobarRuntime();
  const validacion = env['VALIDATION_MODE'] === 'true';
  if (validacion && env['NODE_ENV'] !== 'validation' && env['NODE_ENV'] !== 'test') throw new Error('El modo de validación no puede habilitarse en producción.');
  const origen = requerido(env, 'PUBLIC_ORIGIN'); const urlPublica = requerido(env, 'PUBLIC_URL');
  if (new URL(origen).protocol !== 'https:' || new URL(origen).origin !== origen || new URL(urlPublica).origin !== origen) throw new Error('Se requiere un origen HTTPS exacto y URL pública confiable del mismo origen.');
  const databaseUrl = requerido(env, 'DATABASE_URL'); const db = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(db.protocol)) throw new Error('Se requiere PostgreSQL.');
  if (validacion && (!['localhost', '127.0.0.1', 'postgres', 'host.docker.internal'].includes(db.hostname) || !/^\/ayacucho_001_(validacion|test_[a-z0-9_]+)$/.test(db.pathname))) throw new Error('El entorno de validación requiere una DB local identificada.');
  const hmac = claves(requerido(env, 'HMAC_KEYS_JSON')); const aead = claves(requerido(env, 'AEAD_KEYS_JSON')); const hmacId = requerido(env, 'HMAC_KEY_ID'); const aeadId = requerido(env, 'AEAD_KEY_ID');
  if (!hmac.has(hmacId) || !aead.has(aeadId) || [...hmac.values()].some((h) => [...aead.values()].some((a) => h.equals(a)))) throw new Error('Las claves HMAC y AEAD deben ser independientes y conservar sus identificadores.');
  const endpoint = requerido(env, 'S3_ENDPOINT'); if (!validacion && new URL(endpoint).protocol !== 'https:') throw new Error('El almacenamiento productivo requiere HTTPS.');
  const puerto = Number(env['PORT'] ?? 3000); const port = Number(env['SMTP_PORT'] ?? 587);
  if (![puerto, port].every((p) => Number.isInteger(p) && p > 0 && p <= 65535)) throw new Error('Puerto no válido.');
  return {
    validacion, puerto, origen, urlPublica, databaseUrl, catalogo: resolve(requerido(env, 'CATALOGO_MANIFIESTO')), contrato: resolve(env['CONTRATO_PATH'] ?? 'contracts/openapi.json'), hmacId, hmac, aeadId, aead,
    smtp: { host: requerido(env, 'SMTP_HOST'), port, secure: env['SMTP_SECURE'] === 'true', from: requerido(env, 'SMTP_FROM'), validacion,
      ...(env['SMTP_USER'] ? { usuario: env['SMTP_USER'] } : {}), ...(env['SMTP_PASSWORD'] ? { contrasena: env['SMTP_PASSWORD'] } : {}) },
    s3: { endpoint, region: requerido(env, 'S3_REGION'), bucket: requerido(env, 'S3_BUCKET'), accessKeyId: requerido(env, 'S3_ACCESS_KEY_ID'), secretAccessKey: requerido(env, 'S3_SECRET_ACCESS_KEY') },
  };
}
