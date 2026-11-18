import { request } from 'node:https';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { local, cargarLocal } from './entorno.js';
import { cargarConfiguracion } from '../src/composicion/configuracion.js';

cargarLocal();
const config = cargarConfiguracion();
if (!config.validacion) throw new Error('Esta comprobación requiere validación local.');
const ca = await readFile(resolve(local, 'tls/ca.crt'));
async function consultar(ruta: string, metodo = 'GET', cuerpo?: Buffer) {
  return new Promise<{ status: number; tipo: string; cache: string; referrer: string; body: string }>((aceptar, rechazar) => {
    const req = request(new URL(ruta, config.origen), { method: metodo, ca, rejectUnauthorized: true,
      headers: cuerpo ? { 'Content-Type': 'application/json', 'Content-Length': cuerpo.length } : {} }, (res) => {
      let body = '';
      res.setEncoding('utf8'); res.on('data', (bloque: string) => { body += bloque; });
      res.on('end', () => aceptar({ status: res.statusCode ?? 0, tipo: res.headers['content-type'] ?? '', cache: String(res.headers['cache-control']), referrer: String(res.headers['referrer-policy']), body }));
      res.on('error', rechazar);
    });
    req.setTimeout(15000, () => req.destroy(new Error('Tiempo de espera agotado.')));
    req.on('error', rechazar); req.end(cuerpo);
  });
}
let paso = 'salud HTTPS';
try {
  const salud = await consultar('/api/v1/salud'); assert.equal(salud.status, 200); assert.equal(JSON.parse(salud.body).estado, 'disponible');
  paso = 'web HTTPS'; const web = await consultar('/'); assert.equal(web.status, 200); assert.match(web.tipo, /text\/html/);
  paso = 'límites y cabeceras';
  const grande = await consultar('/api/v1/salud', 'GET', Buffer.from('1' + ' '.repeat(65536)));
  const proxy = await consultar('/api/v1/cuentas', 'POST', Buffer.from('1' + ' '.repeat(14000000)));
  for (const res of [grande, proxy]) {
    paso = res === grande ? 'límite de aplicación' : 'límite del proxy';
    assert.equal(res.status, 413); assert.match(res.tipo, /application\/json/);
    paso += ': código';
    assert.equal(JSON.parse(res.body).codigo, 'CUERPO_DEMASIADO_GRANDE');
    paso += ': cache'; assert.equal(res.cache, 'no-store');
    paso += ': referrer'; assert.equal(res.referrer, 'no-referrer');
  }
  const destino = process.env['EVIDENCIA_001'];
  const carpeta = resolve(destino ?? resolve(local, 'evidencia/001')); await mkdir(carpeta, { recursive: true });
  await writeFile(resolve(carpeta, 'proxy.json'), JSON.stringify({ fecha: new Date().toISOString(), tls: 'CA explícita; validación activa; no modifica confianza del sistema', salud: 200, web: 200, limites: [65536, 14000000], excesos: [413, 413] }, null, 2), { flag: destino ? 'wx' : 'w' });
  process.stdout.write('HTTPS verificado con CA explícita: salud/web 200 y límites de aplicación/proxy 413 JSON sin caché.\n');
} catch (error) {
  const codigo = error && typeof error === 'object' && 'code' in error ? String(error.code).replace(/[^A-Z0-9_]/g, '') : 'FALLO';
  const estado = error && typeof error === 'object' && 'actual' in error && typeof error.actual === 'number' ? `; HTTP/valor ${error.actual}` : '';
  process.stderr.write(`No se pudo verificar ${paso}: ${codigo}${estado}. No se desactiva TLS.\n`); process.exitCode = 1;
}
