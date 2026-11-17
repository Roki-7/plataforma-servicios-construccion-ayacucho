import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { backend, local, cargarLocal } from './entorno.js';
import { cargarConfiguracion } from '../src/composicion/configuracion.js';

cargarLocal(); const config = cargarConfiguracion();
if (!config.validacion) throw new Error('La comprobación de contenedor solo usa el entorno local de validación.');
const marca = randomUUID(); const imagen = 'ayacucho-usuarios:fundacion'; const creados: string[] = []; const archivos: string[] = [];
function docker(args: string[], tolerar = false): string {
  const archivo = args[0] === 'build' ? openSync(resolve(local, 'docker-build.log'), 'w', 0o600) : undefined;
  let r: SpawnSyncReturns<string>;
  try { r = archivo === undefined
    ? spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    : spawnSync('docker', args, { encoding: 'utf8', stdio: ['ignore', archivo, archivo] }); }
  finally { if (archivo !== undefined) closeSync(archivo); }
  if (r.status !== 0 && !tolerar) {
    throw new Error('Falló una comprobación Docker. Verifique el motor, la red y las dependencias locales.');
  }
  return r.status === 0 ? (r.stdout ?? '').trim() : '';
}
async function arrancar(sufijo: string, cambios: Record<string, string> = {}): Promise<string> {
  const nombre = `ayacucho-001-smoke-${marca}-${sufijo}`;
  const env = parse(await readFile(resolve(local, 'backend.env')));
  const db = new URL(config.databaseUrl); db.hostname = 'postgres'; db.port = '5432';
  const valores = { ...env, NODE_ENV: 'validation', DATABASE_URL: db.href, CATALOGO_MANIFIESTO: '/validacion/catalogo/manifest.json', SMTP_HOST: 'correo', S3_ENDPOINT: 'http://objetos:3900', ...cambios };
  const archivo = resolve(local, `contenedor-${marca}-${sufijo}.env`); archivos.push(archivo);
  await writeFile(archivo, Object.entries(valores).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
  creados.push(nombre);
  docker(['run', '-d', '--name', nombre, '--label', `ayacucho.smoke=${marca}`, '--network', 'ayacucho-001-validacion_default', '--env-file', archivo,
    '--mount', `type=bind,source=${resolve(local, 'catalogo')},target=/validacion/catalogo,readonly`, imagen]);
  return nombre;
}
async function esperarSalud(nombre: string, esperado: number): Promise<void> {
  const consulta = "fetch('http://127.0.0.1:3000/api/v1/salud').then(async r=>console.log(JSON.stringify({status:r.status,body:await r.json()}))).catch(()=>process.exit(1))";
  for (let i = 0; i < 60; i++) {
    const salida = docker(['exec', nombre, 'node', '-e', consulta], true);
    if (salida) {
      const resultado = JSON.parse(salida) as { status: number; body: { estado?: string; codigo?: string } };
      if (resultado.status === esperado && (esperado === 200 ? resultado.body.estado === 'disponible' : resultado.body.codigo === 'DEPENDENCIA_NO_DISPONIBLE')) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('El contenedor no presentó el estado de salud esperado.');
}
try {
  docker(['info', '--format', '{{.OSType}}']);
  process.stdout.write('Construyendo imagen Linux fundacional desde Dockerfile y lockfile...\n');
  docker(['build', '--file', resolve(backend, 'Dockerfile'), '--tag', imagen, backend]);
  const correcto = await arrancar('correcto'); await esperarSalud(correcto, 200);
  const verificarSesiones = `const origen=process.env.PUBLIC_ORIGIN; const login=await fetch('http://127.0.0.1:3000/api/v1/sesiones',{method:'POST',headers:{Origin:origen,'Content-Type':'application/json'},body:JSON.stringify({correo:'cuenta-inexistente-smoke@example.invalid',contrasena:'Control ficticio Linux'})}); const refresh=await fetch('http://127.0.0.1:3000/api/v1/sesiones/renovacion',{method:'POST',headers:{Origin:origen}}); if(login.status!==401||refresh.status!==401||login.headers.has('set-cookie')||refresh.headers.has('set-cookie'))process.exit(1); console.log('sesiones:401/401; sin credenciales emitidas');`;
  docker(['exec', correcto, 'node', '--input-type=module', '-e', verificarSesiones]);
  const verificarRecuperacion = `const r=await fetch('http://127.0.0.1:3000/api/v1/recuperaciones',{method:'POST',headers:{Origin:process.env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({correo:'cuenta-inexistente-smoke@example.invalid'})}); const b=await r.json(); if(r.status!==202||b.mensaje!=='Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar el acceso'||r.headers.has('set-cookie'))process.exit(1); console.log('recuperacion:202; respuesta generica sin credenciales');`;
  docker(['exec', correcto, 'node', '--input-type=module', '-e', verificarRecuperacion]);
  const uid = docker(['exec', correcto, 'node', '-e', 'console.log(process.getuid())']);
  if (uid === '0' || !/^\d+$/.test(uid)) throw new Error('El contenedor no se ejecuta sin privilegios.');
  docker(['exec', correcto, 'node', '--input-type=module', '-e', "import {hash,verify,argon2id} from 'argon2'; const h=await hash('Clave ficticia de prueba Linux',{type:argon2id,memoryCost:65536,timeCost:3,parallelism:4}); if(!await verify(h,'Clave ficticia de prueba Linux'))process.exit(1); console.log('argon2id:OK')"]);
  const sinDbUrl = new URL(config.databaseUrl); sinDbUrl.hostname = 'postgres'; sinDbUrl.port = '65534';
  const sinDb = await arrancar('sin-db', { DATABASE_URL: sinDbUrl.href }); await esperarSalud(sinDb, 503);
  const sinCorpus = await arrancar('sin-corpus', { CATALOGO_MANIFIESTO: '/validacion/catalogo/inexistente.json' }); await esperarSalud(sinCorpus, 503);
  const digest = docker(['image', 'inspect', imagen, '--format', '{{.Id}}']);
  const carpeta = resolve(local, 'evidencia/001'); await mkdir(carpeta, { recursive: true });
  await writeFile(resolve(carpeta, 'contenedor.json'), JSON.stringify({ fecha: new Date().toISOString(), imagen, digest, uid: Number(uid), salud: [200, 503, 503], argon2id: 'verificado', sesiones: [401, 401], recuperacion: 202, alcance: 'Regresión fundacional con US1–US3 compiladas; rechazos de sesiones y recuperación genérica, sin sustituir CA' }, null, 2));
  process.stdout.write('Imagen verificada: usuario sin privilegios, Argon2id nativo y salud 200/503/503.\n');
} catch {
  process.stderr.write('Comprobación de contenedor fallida o bloqueada. No se acredita T023 hasta resolver motor, construcción, configuración y arranque.\n'); process.exitCode = 1;
} finally {
  for (const nombre of creados) {
    if (!nombre.startsWith(`ayacucho-001-smoke-${marca}-`)) continue;
    const propietario = docker(['inspect', '--format', '{{index .Config.Labels "ayacucho.smoke"}}', nombre], true);
    if (propietario === marca) docker(['rm', '-f', nombre], true);
  }
  for (const archivo of archivos) { if (archivo.startsWith(local + '/') || archivo.startsWith(local + '\\')) await unlink(archivo).catch(() => undefined); }
}
