import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { request } from 'node:https';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { PRIVACIDAD_VERSION } from '../src/modulos/usuarios-acceso/dominio/cuenta.js';
import { local002, origen002, puertos002 } from './entorno-002.js';

/**
 * Verificación HTTPS de la aplicación integrada a través del proxy de validación 002 (https://localhost:8444, solo 127.0.0.1).
 * Requiere: contenedores de la 002 y proxy iniciados, backend en marcha (start:validation:002) y la semilla aplicada (test:seed:002).
 * Valida el certificado con la CA local de la 002 y usa solo la cuenta ficticia de la semilla y cuentas ficticias nuevas. No cambia infraestructura.
 */
const base = `${origen002}/api/v1`;
const ca = await readFile(resolve(local002, 'tls/ca.crt'));
const operador = JSON.parse(await readFile(resolve(local002, 'operador-ficticio.json'), 'utf8')) as { correo: string; contrasena: string };
interface Respuesta { status: number; headers: Record<string, string | string[] | undefined>; json: any } // eslint-disable-line @typescript-eslint/no-explicit-any
interface Opciones { cuerpo?: unknown; origen?: string | null; clave?: string; token?: string; sinCa?: boolean }

function llamar(metodo: string, ruta: string, o: Opciones = {}): Promise<Respuesta> {
  const texto = o.cuerpo === undefined ? undefined : typeof o.cuerpo === 'string' ? o.cuerpo : JSON.stringify(o.cuerpo);
  const headers: Record<string, string> = {};
  if (texto !== undefined) { headers['content-type'] = 'application/json'; headers['content-length'] = String(Buffer.byteLength(texto)); }
  const origenCab = o.origen === undefined ? origen002 : o.origen;
  if (origenCab) headers['origin'] = origenCab;
  if (o.clave) headers['idempotency-key'] = o.clave;
  if (o.token) headers['authorization'] = `Bearer ${o.token}`;
  return new Promise((ok, fallo) => {
    const r = request(`${base}${ruta}`, { method: metodo, headers, ...(o.sinCa ? {} : { ca }), rejectUnauthorized: true, agent: false }, res => {
      const partes: Buffer[] = []; res.on('data', (d: Buffer) => partes.push(d));
      res.on('end', () => { const t = Buffer.concat(partes).toString('utf8'); let json: unknown = t; try { json = JSON.parse(t); } catch { /* texto */ }
        ok({ status: res.statusCode ?? 0, headers: res.headers, json }); });
    });
    r.on('error', fallo); if (texto !== undefined) r.write(texto); r.end();
  });
}

const documento = JSON.parse(await readFile(resolve(import.meta.dirname, '../../../specs/002-prestadores-y-catalogo/contracts/openapi.json'), 'utf8')) as object;
const contrato001 = JSON.parse(await readFile(resolve(import.meta.dirname, '../contracts/openapi.json'), 'utf8')) as object;
const ajv = new Ajv2020({ strict: false, validateFormats: false, allErrors: true }); ajv.addSchema(documento, 'contrato'); ajv.addSchema(contrato001, 'base');
/** Valida un cuerpo contra un componente del contrato 002 (los formatos se comprueban en el servidor). */
const cumple = (componente: string, cuerpo: unknown, contrato: 'contrato' | 'base' = 'contrato') => ajv.compile({ $ref: `${contrato}#/components/schemas/${componente}` })(cuerpo) === true;
const resultados: { nombre: string; ok: boolean }[] = [];
const comprobar = (nombre: string, condicion: boolean, detalle = '') => { resultados.push({ nombre, ok: condicion }); process.stdout.write(`${condicion ? 'OK   ' : 'FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}\n`); };
const cookies = (r: Respuesta) => ([] as string[]).concat((r.headers['set-cookie'] ?? []) as string[]);

if (puertos002.api !== 3002) throw new Error('Configuración 002 inesperada.');
const salud = await llamar('GET', '/salud', { origen: null });
comprobar('HTTPS con la CA local responde 200 en /salud y cumple Salud', salud.status === 200 && cumple('Salud', salud.json, 'base') && salud.json.estado === 'disponible');
comprobar('El proxy fija no-store, no-referrer y nosniff', salud.headers['cache-control'] === 'no-store' && salud.headers['referrer-policy'] === 'no-referrer' && salud.headers['x-content-type-options'] === 'nosniff');
const sinCa = await llamar('GET', '/salud', { origen: null, sinCa: true }).then(() => 'conectó', (e: NodeJS.ErrnoException) => e.code);
comprobar('Sin la CA local el certificado se rechaza', sinCa === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || sinCa === 'SELF_SIGNED_CERT_IN_CHAIN', String(sinCa));

comprobar('001 POST /cuentas sin Origin: 400', (await llamar('POST', '/cuentas', { cuerpo: {}, origen: null, clave: randomUUID() })).status === 400);
comprobar('001 POST /cuentas con Origin ajeno: 403', (await llamar('POST', '/cuentas', { cuerpo: {}, origen: 'https://ajeno.example.invalid', clave: randomUUID() })).status === 403);
comprobar('001 cuerpo grande: 413', (await llamar('POST', '/cuentas', { cuerpo: JSON.stringify({ nombreMostrar: 'x'.repeat(400_000) }), clave: randomUUID() })).status === 413);
comprobar('001 contraseña incorrecta: 401', (await llamar('POST', '/sesiones', { cuerpo: { correo: operador.correo, contrasena: 'incorrecta' } })).status === 401);
const login = await llamar('POST', '/sesiones', { cuerpo: { correo: operador.correo, contrasena: operador.contrasena } });
comprobar('001 inicio de sesión del operador ficticio: 200', login.status === 200);
const token = String(login.json.tokenAcceso); const cookie = cookies(login).join(' | ');
comprobar('001 cookie __Secure- con HttpOnly, Secure, SameSite y ruta restringida', /__Secure-/.test(cookie) && /HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=/.test(cookie) && /Path=\/api\/v1\/sesiones/.test(cookie));
comprobar('001 GET /perfil con sesión: 200; sin sesión: 401', (await llamar('GET', '/perfil', { origen: null, token })).status === 200 && (await llamar('GET', '/perfil', { origen: null })).status === 401);
comprobar('001 renovación sin CSRF se rechaza', [401, 403].includes((await llamar('POST', '/sesiones/renovacion', { clave: randomUUID(), token })).status));

const categorias = await llamar('GET', '/categorias', { origen: null });
comprobar('002 GET /categorias público: 200 y cumple C002CategoriasPublicas', categorias.status === 200 && cumple('C002CategoriasPublicas', categorias.json));
const servicios = await llamar('GET', '/servicios', { origen: null }); const prestadores = await llamar('GET', '/prestadores', { origen: null });
comprobar('002 GET /servicios y /prestadores públicos: 200 y cumplen C002PaginaServicios y C002PaginaPrestadores', servicios.status === 200 && prestadores.status === 200 && cumple('C002PaginaServicios', servicios.json) && cumple('C002PaginaPrestadores', prestadores.json));
comprobar('002 filtro no admitido: 400', (await llamar('GET', '/servicios?calificacion=5', { origen: null })).status === 400);
comprobar('002 rutas internas sin sesión: 401', (await llamar('GET', '/admin/categorias', { origen: null })).status === 401 && (await llamar('GET', '/servicios/mios', { origen: null })).status === 401);
const admin = await llamar('GET', '/admin/categorias', { origen: null, token });
comprobar('002 operador con permiso RF39 lista categorías: 200, sin caché y cumple C002CategoriasAdmin', admin.status === 200 && admin.headers['cache-control'] === 'no-store' && cumple('C002CategoriasAdmin', admin.json));
const clave = randomUUID(); const nombre = `Prueba HTTPS ${clave.slice(0, 8)}`;
const crear = await llamar('POST', '/admin/categorias', { token, clave, cuerpo: { nombre, motivo: 'Verificación HTTPS de la fase 7' } });
comprobar('002 alta con Origin e Idempotency-Key: 201 inactiva y cumple C002CategoriaAdmin', crear.status === 201 && crear.json.activaPropia === false && cumple('C002CategoriaAdmin', crear.json));
const replay = await llamar('POST', '/admin/categorias', { token, clave, cuerpo: { nombre, motivo: 'Verificación HTTPS de la fase 7' } });
comprobar('002 replay de la misma clave devuelve la misma categoría', replay.status === 201 && replay.json.categoriaId === crear.json.categoriaId);
comprobar('002 Origin ajeno: 403; sin Idempotency-Key: 400; propiedad de identidad: 400',
  (await llamar('POST', '/admin/categorias', { token, origen: 'https://ajeno.example.invalid', clave: randomUUID(), cuerpo: { nombre: 'X', motivo: 'M' } })).status === 403
  && (await llamar('POST', '/admin/categorias', { token, cuerpo: { nombre: 'X', motivo: 'M' } })).status === 400
  && (await llamar('POST', '/admin/categorias', { token, clave: randomUUID(), cuerpo: { nombre: 'X', motivo: 'M', cuentaId: randomUUID() } })).status === 400);
const correo = `${randomUUID()}@example.invalid`; const contrasena = ' una frase privada de prueba ';
const alta = await llamar('POST', '/cuentas', { clave: randomUUID(), cuerpo: { nombreMostrar: 'Cuenta ficticia HTTPS', correo, contrasena, confirmacionContrasena: contrasena, perfiles: ['prestador'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: PRIVACIDAD_VERSION } });
comprobar('001 alta de una cuenta ficticia con perfil de prestador: 201', alta.status === 201);
const otro = String((await llamar('POST', '/sesiones', { cuerpo: { correo, contrasena } })).json.tokenAcceso);
comprobar('002 una cuenta sin permiso RF39 recibe 403 en lectura y escritura', (await llamar('GET', '/admin/categorias', { origen: null, token: otro })).status === 403
  && (await llamar('POST', '/admin/categorias', { token: otro, clave: randomUUID(), cuerpo: { nombre: 'X', motivo: 'M' } })).status === 403);
comprobar('001 cierre de sesión: 204 y el token deja de servir en 002 (401)', (await llamar('DELETE', '/sesiones/actual', { token })).status === 204 && (await llamar('GET', '/admin/categorias', { origen: null, token })).status === 401);

const fallos = resultados.filter(r => !r.ok).length;
process.stdout.write(`\nTotal ${resultados.length}, correctas ${resultados.length - fallos}, fallidas ${fallos}.\n`);
process.exitCode = fallos ? 1 : 0;
