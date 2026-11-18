import { spawnSync } from 'node:child_process';
import type { SpawnSyncReturns } from 'node:child_process';
import { openSync, closeSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { backend, local, cargarLocal } from './entorno.js';
import { cargarConfiguracion } from '../src/composicion/configuracion.js';

cargarLocal(); const config = cargarConfiguracion();
if (!config.validacion) throw new Error('La comprobación de contenedor solo usa el entorno local de validación.');
const marca = randomUUID(); const imagen = 'ayacucho-usuarios:fundacion'; const creados: string[] = []; const archivos: string[] = [];
const carpeta = resolve(process.env['EVIDENCIA_001'] ?? resolve(local, 'evidencia/001', `contenedor-${marca}`));
await mkdir(carpeta, { recursive: true });
interface DiagnosticoContenedor {
  comando: string;
  paso: string;
  codigoSalida?: number | null;
  senal?: NodeJS.Signals | null;
  httpEsperado?: number;
  httpRecibido?: number;
  codigos?: string[];
  indicios?: string[];
}
class FalloContenedor extends Error {
  constructor(readonly diagnostico: DiagnosticoContenedor) { super(diagnostico.paso); }
}
function resumirSalida(salida: string): Pick<DiagnosticoContenedor, 'codigos' | 'indicios'> {
  // Publicar solo valores predefinidos. Docker y los procesos hijos pueden imprimir datos sensibles.
  const codigos = [...new Set(salida.match(/\b(?:EACCES|EPERM|ENOENT|ENOSPC|ENOMEM|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|E401|E403|E404|EINTEGRITY|EBADENGINE|ETARGET)\b/g) ?? [])];
  const patrones: [string, RegExp][] = [
    ['permisos', /permission denied|access is denied/i],
    ['daemon no disponible', /cannot connect to the docker daemon|error during connect/i],
    ['problema de red', /network .* not found|no such network|temporary failure in name resolution/i],
    ['imagen inaccesible', /pull access denied|manifest unknown|no matching manifest|failed to resolve source metadata/i],
    ['montaje inválido', /invalid mount config|bind source path does not exist/i],
    ['instalación npm', /RUN npm ci|npm (?:error|ERR!)/i],
    ['compilación del backend', /RUN npm run build/i],
    ['inicio del catálogo', /"etapa":"catalogo\.inicializacion"/],
  ];
  return { codigos, indicios: patrones.filter(([, patron]) => patron.test(salida)).map(([indicio]) => indicio) };
}
function docker(args: string[], paso: string, tolerar = false): string {
  const rutaBuild = args[0] === 'build' ? resolve(carpeta, 'docker-build.log') : undefined;
  const archivo = rutaBuild ? openSync(rutaBuild, 'wx', 0o600) : undefined;
  let r: SpawnSyncReturns<string>;
  try { r = archivo === undefined
    ? spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
    : spawnSync('docker', args, { encoding: 'utf8', stdio: ['ignore', archivo, archivo] }); }
  finally { if (archivo !== undefined) closeSync(archivo); }
  if (r.status !== 0 && !tolerar) {
    const error = r.error as NodeJS.ErrnoException | undefined;
    const salida = rutaBuild ? readFileSync(rutaBuild, 'utf8') : (r.stdout ?? '') + '\n' + (r.stderr ?? '');
    throw new FalloContenedor({ comando: `docker ${args[0]}${args[0] === 'image' ? ' inspect' : ''}`, paso,
      codigoSalida: r.status, senal: r.signal, ...resumirSalida(`${error?.code ?? ''}\n${salida}`) });
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
    '--mount', `type=bind,source=${resolve(local, 'catalogo')},target=/validacion/catalogo,readonly`, imagen], `arranque ${sufijo}`);
  return nombre;
}
async function esperarSalud(nombre: string, esperado: number): Promise<void> {
  const consulta = "fetch('http://127.0.0.1:3000/api/v1/salud').then(async r=>console.log(JSON.stringify({status:r.status,body:await r.json()}))).catch(()=>process.exit(1))";
  let recibido: number | undefined;
  for (let i = 0; i < 60; i++) {
    const salida = docker(['exec', nombre, 'node', '-e', consulta], 'sondeo de salud', true);
    if (salida) {
      const resultado = JSON.parse(salida) as { status: number; body: { estado?: string; codigo?: string } };
      recibido = resultado.status;
      if (resultado.status === esperado && (esperado === 200 ? resultado.body.estado === 'disponible' : resultado.body.codigo === 'DEPENDENCIA_NO_DISPONIBLE')) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const registro = spawnSync('docker', ['logs', '--tail', '30', nombre], { encoding: 'utf8', maxBuffer: 256 * 1024 });
  throw new FalloContenedor({ comando: 'docker exec', paso: 'sondeo de salud agotado', httpEsperado: esperado,
    ...(recibido === undefined ? {} : { httpRecibido: recibido }), ...resumirSalida((registro.stdout ?? '') + '\n' + (registro.stderr ?? '')) });
}
try {
  docker(['info', '--format', '{{.OSType}}'], 'consulta del motor Docker');
  process.stdout.write('Construyendo imagen Linux del backend desde Dockerfile y lockfile.\n');
  docker(['build', '--file', resolve(backend, 'Dockerfile'), '--tag', imagen, backend], 'construcción de la imagen del backend');
  const correcto = await arrancar('correcto'); await esperarSalud(correcto, 200);
  const verificarSesiones = `const origen=process.env.PUBLIC_ORIGIN; const login=await fetch('http://127.0.0.1:3000/api/v1/sesiones',{method:'POST',headers:{Origin:origen,'Content-Type':'application/json'},body:JSON.stringify({correo:'cuenta-inexistente-smoke@example.invalid',contrasena:'Control ficticio Linux'})}); const refresh=await fetch('http://127.0.0.1:3000/api/v1/sesiones/renovacion',{method:'POST',headers:{Origin:origen}}); if(login.status!==401||refresh.status!==401||login.headers.has('set-cookie')||refresh.headers.has('set-cookie'))process.exit(1); console.log('sesiones:401/401; sin credenciales emitidas');`;
  docker(['exec', correcto, 'node', '--input-type=module', '-e', verificarSesiones], 'rechazos de sesión');
  const verificarRecuperacion = `const r=await fetch('http://127.0.0.1:3000/api/v1/recuperaciones',{method:'POST',headers:{Origin:process.env.PUBLIC_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({correo:'cuenta-inexistente-smoke@example.invalid'})}); const b=await r.json(); if(r.status!==202||b.mensaje!=='Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar el acceso'||r.headers.has('set-cookie'))process.exit(1); console.log('recuperacion:202; respuesta generica sin credenciales');`;
  docker(['exec', correcto, 'node', '--input-type=module', '-e', verificarRecuperacion], 'respuesta genérica de recuperación');
  const verificarPerfil = `for(const ruta of ['/perfil','/perfil/fotografias/550e8400-e29b-41d4-a716-446655440000']){const r=await fetch('http://127.0.0.1:3000/api/v1'+ruta);if(r.status!==401||r.headers.has('set-cookie'))process.exit(1);}console.log('perfil/foto:401/401; sin acceso publico');`;
  docker(['exec', correcto, 'node', '--input-type=module', '-e', verificarPerfil], 'protección de perfil y fotografía');
  const verificarCorreo = `
    import {randomUUID} from 'node:crypto';
    const correo=randomUUID()+'@example.invalid', contrasena='Control ficticio compilado Linux';
    const origen=process.env.PUBLIC_ORIGIN, base='http://127.0.0.1:3000/api/v1';
    const post=(ruta,datos,cabeceras={})=>fetch(base+ruta,{method:'POST',headers:{Origin:origen,'Content-Type':'application/json',...cabeceras},body:JSON.stringify(datos)});
    if((await post('/cuentas',{correo,contrasena,confirmacionContrasena:contrasena,nombreMostrar:'Validacion compilada',perfiles:['cliente'],politicaPrivacidadAceptada:true,politicaPrivacidadVersion:'001-v1'},{'Idempotency-Key':randomUUID()})).status!==201) process.exit(1);
    if((await post('/recuperaciones',{correo})).status!==202) process.exit(2);
    for(let intento=0;intento<30;intento++){
      const res=await fetch('http://correo:8025/api/v1/messages');
      if(!res.ok) process.exit(3);
      const correoPrueba=(await res.json()).messages.find(m=>m.Subject==='Recuperar acceso'&&m.To.some(d=>d.Address===correo));
      if(correoPrueba){
        const detalle=await (await fetch('http://correo:8025/api/v1/message/'+correoPrueba.ID)).json();
        const enlace=detalle.Text.match(/https:\\/\\/localhost:8443\\/recuperar#token=[A-Za-z0-9_-]{43}&version=1/);
        if(!enlace) process.exit(4);
        console.log('recuperacion: correo capturado en Mailpit');
        process.exit(0);
      }
      await new Promise(r=>setTimeout(r,500));
    }
    process.exit(5);
  `;
  docker(['exec', correcto, 'node', '--input-type=module', '-e', verificarCorreo], 'recorrido de correo en Mailpit');
  const uid = docker(['exec', correcto, 'node', '-e', 'console.log(process.getuid())'], 'lectura del UID');
  if (uid === '0' || !/^\d+$/.test(uid)) throw new FalloContenedor({ comando: 'docker exec', paso: 'UID no privilegiado requerido' });
  docker(['exec', correcto, 'node', '--input-type=module', '-e', "import {hash,verify,argon2id} from 'argon2'; const h=await hash('Clave ficticia de prueba Linux',{type:argon2id,memoryCost:65536,timeCost:3,parallelism:4}); if(!await verify(h,'Clave ficticia de prueba Linux'))process.exit(1); console.log('argon2id:OK')"], 'comprobación de Argon2 nativo');
  const sinDbUrl = new URL(config.databaseUrl); sinDbUrl.hostname = 'postgres'; sinDbUrl.port = '65534';
  const sinDb = await arrancar('sin-db', { DATABASE_URL: sinDbUrl.href }); await esperarSalud(sinDb, 503);
  const sinCorpus = await arrancar('sin-corpus', { CATALOGO_MANIFIESTO: '/validacion/catalogo/inexistente.json' }); await esperarSalud(sinCorpus, 503);
  const digest = docker(['image', 'inspect', imagen, '--format', '{{.Id}}'], 'lectura del digest de la imagen');
  await writeFile(resolve(carpeta, 'contenedor.json'), JSON.stringify({ fecha: new Date().toISOString(), commit: process.env['GITHUB_SHA'] ?? commitGit(), imagen, digest, uid: Number(uid), salud: [200, 503, 503], argon2id: 'verificado', sesiones: [401, 401], recuperacion: 202, perfil: [401,401], mailpit: 'correo de recuperación capturado por el worker del backend compilado', alcance: 'Arranque Linux del backend con US1–US7, controles fundacionales y recorrido de correo de validación' }, null, 2), { flag: 'wx' });
  process.stdout.write('Imagen verificada con Argon2id nativo, salud 200/503/503 y correo capturado en Mailpit.\n');
} catch (error) {
  const diagnostico = error instanceof FalloContenedor ? error.diagnostico : { comando: 'test:container', paso: 'preparación o escritura de evidencia' };
  process.stderr.write(`Fallo de contenedor: ${JSON.stringify(diagnostico)}\n`);
  process.exitCode = 1;
  await writeFile(resolve(carpeta, 'contenedor-diagnostico.json'), JSON.stringify(diagnostico, null, 2), { flag: 'wx' })
    .catch(() => { process.stderr.write('No se pudo guardar el diagnóstico del contenedor.\n'); });
} finally {
  for (const nombre of creados) {
    if (!nombre.startsWith(`ayacucho-001-smoke-${marca}-`)) continue;
    const propietario = docker(['inspect', '--format', '{{index .Config.Labels "ayacucho.smoke"}}', nombre], 'verificación para limpieza', true);
    if (propietario === marca) docker(['rm', '-f', nombre], 'limpieza', true);
  }
  for (const archivo of archivos) { if (archivo.startsWith(local + '/') || archivo.startsWith(local + '\\')) await unlink(archivo).catch(() => undefined); }
}

function commitGit(): string | null {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}
