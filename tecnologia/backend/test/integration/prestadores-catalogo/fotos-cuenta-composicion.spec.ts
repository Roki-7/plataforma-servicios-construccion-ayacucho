import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import pg from 'pg';
import request from 'supertest';
import { crearAplicacion } from '../../../src/composicion/app.module.js';
import { crearAplicacionCompleta002 } from '../../../src/composicion/aplicacion-002.js';
import type { Configuracion } from '../../../src/composicion/configuracion.js';
import { aplicarMigraciones002 } from '../../../src/composicion/migraciones-002.js';
import { PortafolioS3 } from '../../../src/modulos/prestadores/infraestructura/archivos/portafolio-s3.js';
import { validarRespuesta } from '../../soporte/contrato.js';
import { imagenPerfil } from '../../soporte/perfil.js';
import { registroValido } from '../../soporte/registro.js';
import { crearImagen, base64 } from '../../soporte/prestadores-catalogo/imagenes.js';
import { origenWeb002 } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

/**
 * Fotografías de cuenta de la 001 en la composición completa (T068): subida real a un almacenamiento S3 real, lectura propia, rechazo de imágenes inválidas, aislamiento entre cuentas
 * y subidas simultáneas, comparadas con la composición base de 17 operaciones. Es opt-in: usa el proyecto Docker descartable del ensayo (PostgreSQL y Garage propios, bucket
 * ensayo-origen), requiere ENSAYO_RESTAURACION_ENV y limpia sus bases y objetos al terminar. No usa la base de validación 002 ni su bucket.
 */
const archivoEnv = process.env['ENSAYO_RESTAURACION_ENV'];
const suite = archivoEnv ? describe : describe.skip;
type Aplicacion = Awaited<ReturnType<typeof crearAplicacion>>;
const bucket = 'ensayo-origen';
const volatiles = new Set(['date', 'etag', 'content-length', 'x-request-id', 'connection', 'keep-alive']);
const cabeceras = (h: Record<string, unknown>) => Object.fromEntries(Object.entries(h).filter(([k]) => !volatiles.has(k) && k !== 'set-cookie').sort(([a], [b]) => a.localeCompare(b)));
const forma = (v: unknown): unknown => Array.isArray(v) ? v.map(forma) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, typeof x === 'string' || typeof x === 'number' ? typeof x : forma(x)])) : v;

suite('fotografías de cuenta: composición base y completa', () => {
  let cfg: Record<string, string>; let cliente: S3Client; let urlAdmin: string; const bases: string[] = [];
  let sola: Aplicacion; let completa: Aplicacion;
  const urlDe = (base: string) => { const u = new URL(urlAdmin); u.pathname = `/${base}`; return u.href; };
  const configuracion = (url: string): Configuracion => ({ validacion: true, puerto: 3002, origen: origenWeb002, urlPublica: origenWeb002, databaseUrl: url, catalogo: resolve('../.local/002/catalogo/manifest.json'),
    contrato: resolve('contracts/openapi.json'), hmacId: 'f', hmac: new Map([['f', Buffer.alloc(32, 7)]]), aeadId: 'f', aead: new Map([['f', Buffer.alloc(32, 9)]]),
    smtp: { host: '127.0.0.1', port: 9, secure: false, from: 'ensayo@example.invalid', validacion: true },
    s3: { endpoint: 'http://127.0.0.1:3930', region: 'garage', bucket, accessKeyId: cfg['ENSAYO_S3_ACCESS_KEY_ID']!, secretAccessKey: cfg['ENSAYO_S3_SECRET_ACCESS_KEY']! } });
  const nuevaBase = async () => {
    const nombre = `ayacucho_002_test_fotos_${randomUUID().replaceAll('-', '')}`; bases.push(nombre);
    const c = new pg.Client({ connectionString: urlDe('postgres') }); await c.connect(); try { await c.query(`CREATE DATABASE "${nombre}"`); } finally { await c.end(); }
    await aplicarMigraciones002(urlDe(nombre)); return urlDe(nombre);
  };

  beforeAll(async () => {
    cfg = Object.fromEntries((await readFile(archivoEnv!, 'utf8')).split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^'|'$/g, '')]; }));
    if (!resolve(archivoEnv!).replaceAll('\\', '/').endsWith('/.local/ensayo-restauracion/ensayo.env')) throw new Error('Configuración del ensayo no permitida.');
    urlAdmin = `postgresql://ensayo_restauracion:${cfg['ENSAYO_PG_PASSWORD']}@127.0.0.1:54341/postgres`;
    cliente = new S3Client({ endpoint: 'http://127.0.0.1:3930', region: 'garage', forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: { accessKeyId: cfg['ENSAYO_S3_ACCESS_KEY_ID']!, secretAccessKey: cfg['ENSAYO_S3_SECRET_ACCESS_KEY']! } });
    sola = await crearAplicacion(configuracion(await nuevaBase()), { worker: false });
    completa = await crearAplicacionCompleta002(configuracion(await nuevaBase()), { prestadores: { almacen: new PortafolioS3(cliente, bucket, 'portafolio/') }, worker: false });
  }, 240000);
  afterAll(async () => {
    try { await sola?.app.close(); await completa?.app.close(); } finally {
      const c = new pg.Client({ connectionString: urlDe('postgres') }); await c.connect();
      try { for (const b of bases) await c.query(`DROP DATABASE IF EXISTS "${b}" WITH (FORCE)`); } finally { await c.end(); }
      for (;;) { const r = await cliente.send(new ListObjectsV2Command({ Bucket: bucket })); if (!r.Contents?.length) break; for (const o of r.Contents) await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.Key! })); }
      cliente.destroy();
    }
  }, 120000);

  async function secuencia(app: Aplicacion) {
    const http = request(app.app.getHttpServer()); const salida: Record<string, unknown>[] = [];
    const resp = (r: { status: number; headers: Record<string, unknown>; body: unknown }) => ({ status: r.status, cabeceras: cabeceras(r.headers), forma: forma(r.body) });
    const escribir = (ruta: string, cuerpo: object, token?: string) => { const t = http.post(`/api/v1${ruta}`).set('Origin', origenWeb002).set('Idempotency-Key', randomUUID()); if (token) t.set('Authorization', `Bearer ${token}`); return t.send(cuerpo); };
    const cuenta = async () => { const p = registroValido(); await escribir('/cuentas', p); const s = await http.post('/api/v1/sesiones').set('Origin', origenWeb002).send({ correo: p.correo, contrasena: p.contrasena }); return String(s.body.tokenAcceso); };
    const token = await cuenta(); const otra = await cuenta(); const imagen = await imagenPerfil();
    const sube = await escribir('/perfil/fotografias', imagen, token); salida.push({ paso: 'subida', ...resp(sube) });
    await validarRespuesta('FotografiaResultado', sube.body);
    const id = String(sube.body.fotografiaId);
    const lee = await http.get(`/api/v1/perfil/fotografias/${id}`).set('Authorization', `Bearer ${token}`); salida.push({ paso: 'lectura propia', ...resp(lee) });
    await validarRespuesta('FotografiaLectura', lee.body); salida.push({ paso: 'mismo contenido', igual: lee.body.contenidoBase64 === imagen.contenidoBase64 });
    salida.push({ paso: 'imagen inválida', ...resp(await escribir('/perfil/fotografias', { tipoContenido: 'image/png', contenidoBase64: Buffer.from('no es una imagen').toString('base64') }, token)) });
    salida.push({ paso: 'formato no admitido', ...resp(await escribir('/perfil/fotografias', { tipoContenido: 'image/gif', contenidoBase64: imagen.contenidoBase64 }, token)) });
    salida.push({ paso: 'sin sesión', ...resp(await escribir('/perfil/fotografias', imagen)) });
    salida.push({ paso: 'otra cuenta no la lee', ...resp(await http.get(`/api/v1/perfil/fotografias/${id}`).set('Authorization', `Bearer ${otra}`)) });
    salida.push({ paso: 'sin sesión no la lee', ...resp(await http.get(`/api/v1/perfil/fotografias/${id}`)) });
    const simultaneas = await Promise.all(Array.from({ length: 6 }, async (_, i) => (await escribir('/perfil/fotografias', { tipoContenido: 'image/jpeg', contenidoBase64: base64(await crearImagen({ color: `#${(i + 1).toString(16).repeat(6)}` })) }, token)).status));
    salida.push({ paso: 'subidas simultáneas', estados: simultaneas.sort() });
    return salida;
  }

  test('subida, lectura, rechazos, aislamiento y concurrencia se comportan igual en la composición base y en la completa', async () => {
    const esperado = await secuencia(sola); const obtenido = await secuencia(completa);
    expect(isDeepStrictEqual(obtenido, esperado)).toBe(true);
    expect(obtenido).toEqual(esperado);
    const paso = (n: string) => esperado.find(x => x['paso'] === n)!;
    expect(paso('subida')['status']).toBe(201); expect(paso('lectura propia')['status']).toBe(200); expect(paso('mismo contenido')).toMatchObject({ igual: true });
    expect([400, 422]).toContain(paso('imagen inválida')['status']); expect([400, 422]).toContain(paso('formato no admitido')['status']); expect(paso('sin sesión')['status']).toBe(401);
    expect(paso('otra cuenta no la lee')['status']).toBe(404); expect(paso('sin sesión no la lee')['status']).toBe(401);
    expect((paso('subidas simultáneas')['estados'] as number[]).every(s => s === 201)).toBe(true);
  }, 300000);
});
