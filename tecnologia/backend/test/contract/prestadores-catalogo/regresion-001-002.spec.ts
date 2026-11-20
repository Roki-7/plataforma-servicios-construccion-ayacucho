import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import request from 'supertest';
import { crearAplicacion } from '../../../src/composicion/app.module.js';
import { crearAplicacionCompleta002 } from '../../../src/composicion/aplicacion-002.js';
import { componerOpenApi, inventarioOpenApi, type DocumentoOpenApi } from '../../../src/composicion/componer-openapi.js';
import { aplicarMigraciones002 } from '../../../src/composicion/migraciones-002.js';
import { configuracionDePrueba002 } from '../../soporte/prestadores-catalogo/entorno.js';
import { almacenDePrueba002, origenWeb002 } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';
import { baseAislada002 } from '../../soporte/prestadores-catalogo/postgres.js';
import { registroValido } from '../../soporte/registro.js';

/**
 * Regresión de la 001 en la aplicación compuesta. X-08 de la 001 (`usuarios-acceso/openapi.spec.ts`) se ejecuta aparte, sin cambios, como referencia.
 * Aquí se comparan los contratos y se ejecuta la MISMA secuencia contra la composición base (17 operaciones) y la compuesta (40), sobre bases distintas:
 * estados, cabeceras (sin valores volátiles) y atributos de cookies deben coincidir.
 */
const leer = async (nombre: string) => JSON.parse(await readFile(resolve('contracts', nombre), 'utf8')) as DocumentoOpenApi;
type Aplicacion = Awaited<ReturnType<typeof crearAplicacion>>;
const volatiles = new Set(['date', 'etag', 'content-length', 'x-request-id', 'connection', 'keep-alive']);
const cabeceras = (h: Record<string, unknown>) => Object.fromEntries(Object.entries(h).filter(([k]) => !volatiles.has(k) && k !== 'set-cookie').sort(([a], [b]) => a.localeCompare(b)));
const cookie = (h: Record<string, unknown>) => ([] as string[]).concat((h['set-cookie'] ?? []) as string[]).map(c => c.split(';').map((p, i) => i === 0 ? p.split('=')[0]! : p.trim().replace(/^(Expires|Max-Age)=.*/, '$1=*')).join('; '));
const forma = (v: unknown): unknown => Array.isArray(v) ? v.map(forma) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, typeof x === 'string' || typeof x === 'number' ? typeof x : forma(x)])) : v;

async function secuencia(app: Aplicacion) {
  const http = request(app.app.getHttpServer()); const salida: Record<string, unknown>[] = [];
  const anotar = (nombre: string, r: { status: number; headers: Record<string, unknown>; body: unknown }) => salida.push({ nombre, status: r.status, cabeceras: cabeceras(r.headers), cookie: cookie(r.headers), forma: forma(r.body) });
  const post = (ruta: string, cuerpo?: object, extra: { origen?: string | null; clave?: string | null; token?: string; csrf?: string } = {}) => {
    const t = http.post(`/api/v1${ruta}`); if (extra.origen !== null) t.set('Origin', extra.origen ?? origenWeb002); if (extra.clave !== null) t.set('Idempotency-Key', extra.clave ?? randomUUID());
    if (extra.token) t.set('Authorization', `Bearer ${extra.token}`); if (extra.csrf !== undefined) t.set('X-CSRF-Token', extra.csrf); return cuerpo ? t.send(cuerpo) : t;
  };
  const persona = { ...registroValido() };
  anotar('registro', await post('/cuentas', persona));
  anotar('registro origen ajeno', await post('/cuentas', registroValido(), { origen: 'https://ajeno.example.invalid' }));
  anotar('registro sin origen', await post('/cuentas', registroValido(), { origen: null }));
  anotar('registro sin clave', await post('/cuentas', registroValido(), { clave: null }));
  anotar('registro cuerpo grande', await post('/cuentas', { ...registroValido(), nombreMostrar: 'x'.repeat(400_000) }));
  const login = await post('/sesiones', { correo: persona.correo, contrasena: persona.contrasena }, { clave: null });
  anotar('sesión', login);
  const token = String((login.body as { tokenAcceso?: string }).tokenAcceso);
  anotar('sesión contraseña incorrecta', await post('/sesiones', { correo: persona.correo, contrasena: 'incorrecta' }, { clave: null }));
  anotar('csrf', await http.get('/api/v1/sesiones/csrf').set('Authorization', `Bearer ${token}`).set('Origin', origenWeb002));
  anotar('renovación sin credencial', await post('/sesiones/renovacion', undefined, { clave: null }));
  anotar('renovación con csrf incorrecto', await post('/sesiones/renovacion', undefined, { clave: null, token, csrf: 'incorrecto' }));
  anotar('perfil', await http.get('/api/v1/perfil').set('Authorization', `Bearer ${token}`));
  anotar('perfil sin sesión', await http.get('/api/v1/perfil'));
  anotar('fotografía inexistente', await http.get(`/api/v1/perfil/fotografias/${randomUUID()}`).set('Authorization', `Bearer ${token}`));
  anotar('fotografía sin sesión', await http.get(`/api/v1/perfil/fotografias/${randomUUID()}`));
  anotar('salud', await http.get('/api/v1/salud'));
  anotar('ruta desconocida', await http.get('/api/v1/no-existe'));
  anotar('cierre con cuerpo', await http.delete('/api/v1/sesiones/actual').set('Authorization', `Bearer ${token}`).set('Origin', origenWeb002).send({ x: 1 }));
  // Concurrencia: cinco registros simultáneos con el mismo correo producen un solo alta.
  const igual = registroValido();
  const estados = (await Promise.all(Array.from({ length: 5 }, () => post('/cuentas', igual)))).map(r => r.status).sort();
  salida.push({ nombre: 'registros simultáneos', estados });
  // La misma clave de idempotencia devuelve el mismo resultado.
  const nueva = registroValido(); const clave = randomUUID();
  const a = await post('/cuentas', nueva, { clave }); const b = await post('/cuentas', nueva, { clave });
  salida.push({ nombre: 'replay idempotente', estados: [a.status, b.status], mismoCuerpo: isDeepStrictEqual(a.body, b.body) });
  return salida;
}

describe('contratos: la composición no cambia la 001', () => {
  test('las 17 operaciones de la 001 son idénticas en el contrato compuesto y la unión suma 40 sin colisiones', async () => {
    const base = await leer('openapi.json'); const oferta = await leer('prestadores-catalogo.openapi.json');
    const compuesto = componerOpenApi(base, oferta);
    const ops001 = inventarioOpenApi(base); const ops002 = inventarioOpenApi(oferta); const todas = inventarioOpenApi(compuesto);
    expect([ops001.length, ops002.length, todas.length]).toEqual([17, 23, 40]);
    expect(new Set(todas.map(o => o.operacion.operationId)).size).toBe(40);
    for (const { metodo, ruta, operacion } of ops001) expect(compuesto.paths[ruta]?.[metodo]).toEqual(operacion);
    for (const { metodo, ruta, operacion } of ops002) expect(compuesto.paths[ruta]?.[metodo]).toEqual(operacion);
    const solo001 = (await readFile(resolve('contracts/openapi.json'), 'utf8'));
    expect(JSON.parse(solo001)).toEqual(base);
  });
});

describe('comportamiento: misma secuencia en la composición base y en la compuesta', () => {
  let almacen: Awaited<ReturnType<typeof almacenDePrueba002>>; let b1: Awaited<ReturnType<typeof baseAislada002>>; let b2: Awaited<ReturnType<typeof baseAislada002>>;
  let sola: Aplicacion; let completa: Aplicacion;
  beforeAll(async () => {
    almacen = await almacenDePrueba002(); b1 = await baseAislada002(); b2 = await baseAislada002();
    await aplicarMigraciones002(b1.url); await aplicarMigraciones002(b2.url);
    sola = await crearAplicacion(await configuracionDePrueba002(b1.url), { worker: false });
    completa = await crearAplicacionCompleta002(await configuracionDePrueba002(b2.url), { prestadores: { almacen: almacen.almacen }, worker: false });
  }, 240000);
  afterAll(async () => {
    try { await sola?.app.close(); await completa?.app.close(); } finally { await b1?.cerrar(); await b2?.cerrar(); await almacen?.limpiar(); }
  }, 60000);

  test('sesión, Origin, CSRF, límites, cookies, fotografías de cuenta y concurrencia se comportan igual', async () => {
    const esperado = await secuencia(sola); const obtenido = await secuencia(completa);
    expect(obtenido).toEqual(esperado);
    const porNombre = (n: string) => esperado.find(x => x['nombre'] === n)!;
    // Comprobaciones absolutas para que la igualdad no sea vacía.
    expect(porNombre('registro')['status']).toBe(201);
    expect(porNombre('registro origen ajeno')['status']).toBe(403);
    expect(porNombre('registro cuerpo grande')['status']).toBe(413);
    expect(porNombre('sesión')['status']).toBe(200);
    expect((porNombre('sesión')['cookie'] as string[]).length).toBeGreaterThan(0);
    expect(String((porNombre('sesión')['cookie'] as string[])[0])).toMatch(/HttpOnly/);
    expect([401, 403]).toContain(porNombre('renovación con csrf incorrecto')['status']);
    expect(porNombre('perfil sin sesión')['status']).toBe(401);
    expect(porNombre('salud')['status']).toBe(200);
    expect(porNombre('registros simultáneos')['estados']).toEqual([201, 409, 409, 409, 409]);
    expect(porNombre('replay idempotente')).toMatchObject({ estados: [201, 201], mismoCuerpo: true });
  }, 240000);
});
