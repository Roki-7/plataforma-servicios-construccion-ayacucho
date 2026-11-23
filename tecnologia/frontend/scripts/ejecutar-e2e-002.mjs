// T075 · Ejecutor de navegadores de la 002 en el anfitrión, con recursos DESCARTABLES por corrida.
// Cada corrida crea su propia base (migrada y sembrada), su bucket y su espacio Redis; levanta su propia API y su propia web sobre ellos, ejecuta Chromium, Firefox
// y WebKit (360, 768 y 1366 px) en un contenedor Linux efímero, exporta la auditoría y retira SOLO lo que creó. La validación local (ayacucho_002_validacion, su bucket,
// su espacio Redis y los mensajes previos de Mailpit) nunca se escribe: se comprueba su estado antes y después. No se usa ningún `down -v` ni se borran volúmenes.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID, X509Certificate } from 'node:crypto';
import { openSync, readFileSync, rmSync } from 'node:fs';
import { access, mkdir, open, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { hostname, tmpdir } from 'node:os';
import { connect } from 'node:tls';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';
import {
  clasificarPropietarioBloqueo, conteosDeTablas, diferenciaDeConteos, elementosNuevos, filasDeClasificaciones, identidad002Esperada, leerEnv, recursosEfimeros, validarIndependencia, validarRecursosEfimeros, validarSemilla,
} from './independencia-002.mjs';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tecnologia = resolve(frontend, '..');
const local = resolve(tecnologia, '.local');
const backend = resolve(tecnologia, 'backend');
const raizEvidencia = resolve(local, 'evidencia/002');
const evidencia = resolve(process.env.E2E_EVIDENCIA ?? resolve(raizEvidencia, 'e2e-linux'));
const ca = resolve(local, '002/tls/ca.crt');
const imagen = process.env.E2E_IMAGEN_002 ?? 'ayacucho-001-e2e:fundacion';
const proyecto = identidad002Esperada.proyectoCompose;
const contenedor = (servicio) => `${proyecto}-${servicio}-1`;
const red = `${proyecto}_default`;
const operadorEnContenedor = '/app/.local/evidencia/002/e2e-linux/operador-efimero.json';

const argumentos = process.argv.slice(2);
const valor = (nombre) => argumentos.find((a) => a.startsWith(`${nombre}=`))?.slice(nombre.length + 1);
const resto = argumentos.filter((a) => !a.startsWith('--especificaciones='));
const especificaciones = (valor('--especificaciones') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

function docker(args, opciones = {}) {
  const r = spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...opciones });
  if (r.error) throw r.error;
  return r;
}
const salida = (r, mensaje) => { assert.equal(r.status, 0, `${mensaje}${r.stderr ? `: ${r.stderr.trim().slice(0, 300)}` : ''}`); return r.stdout; };
/** Consulta de solo lectura a PostgreSQL 002 sobre la base indicada (la validación o la descartable). */
const psql = (base, consulta, opciones = {}) => salida(docker(['exec', '-i', contenedor('postgres'), 'psql', '-X', '-U', 'ayacucho_validacion_002', '-d', base, '-v', 'ON_ERROR_STOP=1', '-tA', '-F', '|', ...(opciones.input === undefined ? ['-c', consulta] : [])], opciones.input === undefined ? {} : { input: opciones.input }), 'Consulta a PostgreSQL 002 fallida');
const garage = (...args) => docker(['exec', contenedor('objetos'), '/garage', ...args]);

// --- Evidencia dedicada, sin redirecciones fuera de tecnologia/.local/evidencia/002 ---
const desplazamiento = relative(raizEvidencia, evidencia);
assert.ok(!isAbsolute(desplazamiento) && desplazamiento !== '..' && !desplazamiento.startsWith(`..${sep}`), 'La evidencia debe quedar dentro de tecnologia/.local/evidencia/002.');
await mkdir(evidencia, { recursive: true });
assert.equal(relative(await realpath(local), await realpath(evidencia)), relative(local, evidencia), 'La evidencia apunta fuera de la 002.');

// --- Bloqueo exclusivo de la ejecución ---
// Se adquiere ANTES de comprobar Docker, recuperar huérfanos o tocar ningún recurso y se mantiene hasta el final (también durante la limpieza). Una segunda ejecución
// se rechaza sin modificar nada de la primera: no escribe, no detiene procesos y no retira recursos. Solo se recupera un bloqueo cuyo propietario se HA COMPROBADO muerto.
const bloqueo = resolve(evidencia, 'bloqueo-e2e-002.lock');
const bloqueoRecuperacion = `${bloqueo}.recuperando`;
const miBloqueo = { pid: process.pid, token: randomUUID(), anfitrion: hostname(), inicio: new Date().toISOString() };
let poseoBloqueo = false;
const escribirExclusivo = async (ruta, datos) => { const f = await open(ruta, 'wx', 0o600); try { await f.writeFile(JSON.stringify(datos)); } finally { await f.close(); } };
const leerJson = (ruta) => readFile(ruta, 'utf8').then((t) => { try { return JSON.parse(t); } catch { return undefined; } }, () => undefined);
function comandoDe(pid) {
  const r = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`], { encoding: 'utf8' })
    : spawnSync('ps', ['-p', String(Number(pid)), '-o', 'args='], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout ?? '').trim() : undefined;
}
function propietarioDe(b) {
  let pid = 'desconocido';
  if (b && Number.isInteger(b.pid) && b.pid > 0) {
    try { process.kill(b.pid, 0); pid = 'existe'; } catch (e) { pid = e?.code === 'ESRCH' ? 'no-existe' : 'desconocido'; }
  }
  return clasificarPropietarioBloqueo(b, { anfitrion: hostname(), pid, comando: pid === 'existe' ? comandoDe(b.pid) : undefined });
}
const rechazoBloqueo = (b, estadoProp) => new Error(`Otra ejecución del ejecutor E2E 002 está activa o su estado no puede comprobarse (propietario ${estadoProp}${b?.pid ? `, PID ${b.pid}, iniciada ${b.inicio ?? 'a hora desconocida'}` : ''}). Esta ejecución no modifica nada. Si está seguro de que no hay ninguna ejecución, elimine manualmente ${bloqueo}.`);
async function adquirirBloqueo() {
  try { await escribirExclusivo(bloqueo, miBloqueo); poseoBloqueo = true; return; } catch (e) { if (e?.code !== 'EEXIST') throw e; }
  const actual = await leerJson(bloqueo); const propietario = propietarioDe(actual);
  if (propietario !== 'muerto') throw rechazoBloqueo(actual, propietario);
  // Propietario muerto: la recuperación se serializa con un segundo archivo exclusivo y se revalida antes de retirar el bloqueo.
  try { await escribirExclusivo(bloqueoRecuperacion, miBloqueo); } catch (e) { if (e?.code === 'EEXIST') throw new Error('Otra ejecución está recuperando el bloqueo. Esta ejecución no modifica nada.'); throw e; }
  try {
    const revisado = await leerJson(bloqueo);
    if (!revisado || revisado.token !== actual.token || propietarioDe(revisado) !== 'muerto') throw new Error('El bloqueo cambió durante la recuperación; esta ejecución no modifica nada.');
    await rm(bloqueo, { force: true });
    try { await escribirExclusivo(bloqueo, miBloqueo); poseoBloqueo = true; } catch (e) { if (e?.code === 'EEXIST') throw new Error('Otra ejecución adquirió el bloqueo; esta ejecución se rechaza sin modificar nada.'); throw e; }
    process.stdout.write(`Bloqueo abandonado recuperado (el PID ${actual.pid} de su propietario ya no es una ejecución de este ejecutor).\n`);
  } finally { await rm(bloqueoRecuperacion, { force: true }); }
}
/** Libera únicamente el bloqueo de ESTA ejecución (por su token); nunca el de otra. Síncrona: se usa en 'exit'. */
function liberarBloqueo() {
  if (!poseoBloqueo) return; poseoBloqueo = false;
  try { if (JSON.parse(readFileSync(bloqueo, 'utf8')).token === miBloqueo.token) rmSync(bloqueo, { force: true }); } catch { /* ya no existe o no es nuestro */ }
}
process.on('exit', liberarBloqueo);
await adquirirBloqueo().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}
`); process.exit(1); });

// --- Infraestructura propia de la 002 en marcha ---
await access(ca);
const estado = docker(['ps', '--filter', `label=com.docker.compose.project=${proyecto}`, '--format', '{{.Names}}|{{.Status}}']);
const activos = new Map(salida(estado, 'Docker no está disponible').split(/\r?\n/).filter(Boolean).map((l) => l.split('|')));
for (const s of ['postgres', 'redis', 'objetos', 'correo', 'proxy']) assert.ok(activos.get(contenedor(s))?.startsWith('Up'), `Falta el servicio ${s} del proyecto ${proyecto}. Inicie la infraestructura 002 (quickstart.md).`);
assert.equal(docker(['image', 'inspect', imagen, '--format', '{{.Id}}']).status, 0, `No existe la imagen ${imagen}; constrúyala con Dockerfile.e2e (ver TLS-PRUEBAS.md).`);
// --- Recuperación: lo que una ejecución anterior interrumpida dejó registrado (y SOLO eso) se retira antes de empezar ---
const registro = resolve(evidencia, 'entornos-efimeros.json');
const registrar = async (entradas) => writeFile(registro, JSON.stringify(entradas, null, 2));
const entornos = await readFile(registro, 'utf8').then((t) => JSON.parse(t), () => []);
const tsx = (accion, id, ...extra) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/e2e-efimero-002.ts', accion, id, ...extra], { cwd: resolve(tecnologia, 'backend'), encoding: 'utf8' });
/** Un PID solo se detiene si su línea de comandos sigue siendo la de nuestros servicios (evita reutilización de PID). */
function esNuestro(pid, patron) {
  const r = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`], { encoding: 'utf8' })
    : spawnSync('ps', ['-p', String(Number(pid)), '-o', 'args='], { encoding: 'utf8' });
  return r.status === 0 && patron.test(r.stdout ?? '');
}
const matar = (pid) => process.platform === 'win32' ? spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' }) : spawnSync('kill', ['-TERM', String(pid)]);
const huerfanos = [];
for (const previo of entornos.filter((e) => !String(e.estado).startsWith('retirado') && /^[0-9a-f]{32}$/.test(e.id ?? ''))) {
  if (previo.pids?.api && esNuestro(previo.pids.api, /e2e-efimero-002/)) matar(previo.pids.api);
  if (previo.pids?.web && esNuestro(previo.pids.web, /vite/)) matar(previo.pids.web);
  if (previo.pids?.agente && esNuestro(previo.pids.agente, /agente-retencion-e2e-002/)) matar(previo.pids.agente);
  const r = tsx('retirar', previo.id, `--operador=${resolve(evidencia, 'operador-efimero.json')}`);
  assert.equal(r.status, 0, `No se pudo retirar el entorno descartable huérfano ${previo.id.slice(0, 8)}: ${(r.stderr ?? '').trim().slice(0, 200)}`);
  huerfanos.push(previo.id); previo.estado = 'retirado (huérfano de una ejecución interrumpida)';
}
if (huerfanos.length) { await registrar(entornos); process.stdout.write(`Retirados ${huerfanos.length} entorno(s) descartable(s) huérfano(s) registrado(s).\n`); await new Promise((r) => setTimeout(r, 1500)); }
const libre = (puerto) => new Promise((ok) => { const s = createServer(); s.once('error', () => ok(false)); s.listen(puerto, '127.0.0.1', () => s.close(() => ok(true))); });
for (const [nombre, puerto] of [['la API', identidad002Esperada.puertoApi], ['la web', identidad002Esperada.puertoWeb]]) {
  assert.ok(await libre(puerto), `El puerto ${puerto} de ${nombre} está ocupado. Detenga la API/web de validación 002: el ejecutor levanta las suyas contra recursos descartables (el proxy 8444 enruta a esos puertos).`);
}

// --- 1) Independencia de la configuración 002 ---
const env002 = leerEnv(await readFile(resolve(local, '002/backend.env'), 'utf8'));
const env001 = await readFile(resolve(local, 'backend.env'), 'utf8').then(leerEnv, () => undefined);
const independencia = validarIndependencia({ env002, env001 });
assert.ok(independencia.ok, `Independencia de la 002 no verificada:\n- ${independencia.problemas.join('\n- ')}`);
const identidad002 = { ...independencia.identidad002, proyectoCompose: proyecto, puertoWeb: identidad002Esperada.puertoWeb, puertoCorreoWeb: identidad002Esperada.puertoCorreoWeb };
const caPem = await readFile(ca);
const certificadoCa = new X509Certificate(caPem);
assert.ok(certificadoCa.ca && certificadoCa.subject.includes('Ayacucho Validacion Local 002 CA'), 'El archivo de CA no es la CA 002.');
const servidor = await new Promise((ok, no) => {
  const socket = connect({ host: '127.0.0.1', port: 8444, servername: 'localhost', ca: caPem, rejectUnauthorized: true }, () => { const c = new X509Certificate(socket.getPeerCertificate().raw); socket.end(); ok(c); });
  socket.setTimeout(10000, () => socket.destroy(new Error('TLS_TIEMPO_AGOTADO'))); socket.once('error', no);
});
assert.equal(servidor.checkIssued(certificadoCa), true, 'El certificado de 8444 no está firmado por la CA 002.');

// --- 2) Estado de la validación local ANTES: no debe cambiar nunca ---
const huellaSql = await readFile(resolve(tecnologia, 'scripts/huella-bd-002.sql'), 'utf8');
const mailpit = `http://127.0.0.1:${identidad002Esperada.puertoCorreoWeb}/api/v1/messages`;
const idsMailpit = async () => ((await (await fetch(`${mailpit}?limit=1000`)).json()).messages ?? []).map((m) => m.ID);
const clavesValidacion = () => salida(docker(['exec', contenedor('redis'), 'redis-cli', '--scan', '--pattern', `${identidad002Esperada.espacioRedis}:*`]), 'No se pudo listar Redis 002').split(/\r?\n/).filter(Boolean).sort();
const fotoValidacion = async () => ({ huellaTablas: psql(identidad002Esperada.baseDatos, '', { input: huellaSql }).trim(), clavesRedis: clavesValidacion(), bucket: salida(garage('bucket', 'info', identidad002Esperada.bucket), 'No se pudo leer el bucket de validación').trim(), mensajes: await idsMailpit() });
const validacionAntes = await fotoValidacion();

// --- Servicios descartables de la corrida: API 3002 y web 5175 (los que enruta el proxy 8444) ---
const detener = (hijo) => { if (!hijo || hijo.exitCode !== null) return; if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(hijo.pid), '/T', '/F'], { stdio: 'ignore' }); else hijo.kill('SIGTERM'); };
const esperar = async (url, ms = 60000) => { const fin = Date.now() + ms; while (Date.now() < fin) { try { if ((await fetch(url)).ok) return; } catch { /* aún no responde */ } await new Promise((r) => setTimeout(r, 500)); } throw new Error(`No respondió ${url}.`); };

const consultaSemilla = "select id, nombre, nivel, coalesce(categoria_padre_id::text, ''), activa from public.catalogo_clasificaciones order by id";
const consultaConteos = "select table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name";
const consultaAuditoria = "select coalesce(json_agg(t order by t.ocurrio_en), '[]'::json) from (select ocurrio_en, accion, recurso_tipo, recurso_id, motivo, responsable from public.administracion_auditoria) t";

const lotes = especificaciones.length ? especificaciones : [''];
// Las evidencias por historia (hu03, hu04…) de una serie anterior no se mezclan con las de esta.
for (const nombre of await readdir(evidencia)) if (/^hu\d{2}$/.test(nombre)) await rm(resolve(evidencia, nombre), { recursive: true, force: true });
// Corpus de imágenes ficticias (T076) y carpeta de señales del agente de retención: ambos viven en la evidencia y se retiran al terminar.
const carpetaImagenes = resolve(evidencia, 'imagenes'); const carpetaSenales = resolve(evidencia, 'senales');
if (especificaciones.length === 0 || especificaciones.some((e) => e.includes('perfil-y-portafolio'))) {
  salida(spawnSync(process.execPath, ['--import', 'tsx', 'scripts/generar-imagenes-e2e-002.ts', `--salida=${carpetaImagenes}`], { cwd: backend, encoding: 'utf8' }), 'No se pudo generar el corpus de imágenes ficticias');
}
const corridas = []; const iniciales = []; let codigoFinal = 0;
let serviciosActivos = [];
for (const senal of ['SIGINT', 'SIGTERM']) process.once(senal, () => { for (const h of serviciosActivos) detener(h); process.stderr.write('Interrumpido: los recursos descartables registrados se retirarán en la próxima ejecución.\n'); process.exit(130); });

for (const [i, especificacion] of lotes.entries()) {
  const id = randomUUID().replaceAll('-', '');
  const recursos = recursosEfimeros(id);
  const validos = validarRecursosEfimeros(recursos); assert.ok(validos.ok, validos.problemas.join(' '));
  const operador = resolve(evidencia, 'operador-efimero.json');
  const entrada = { corrida: i + 1, id, ...recursos, estado: 'creando' }; entornos.push(entrada); await registrar(entornos);
  let api; let web; let agente; const inicio = new Date().toISOString(); let resultado = { codigo: 1 }; let fallo;
  const registroApi = resolve(tmpdir(), `ayacucho-002-e2e-${id}-api.log`); const registroWeb = resolve(tmpdir(), `ayacucho-002-e2e-${id}-web.log`);
  const mensajesAntes = await idsMailpit();
  try {
    const creado = tsx('crear', id, `--operador=${operador}`); salida(creado, 'No se pudo crear el entorno descartable');
    // La semilla de una base nueva debe ser EXACTAMENTE la determinista y su estado inicial se registra para compararlo entre corridas.
    const semilla = validarSemilla(filasDeClasificaciones(psql(recursos.baseDatos, consultaSemilla)), { estricta: true });
    assert.ok(semilla.ok, `La semilla de la base descartable no es la determinista: faltantes=${semilla.faltantes.length}, alteradas=${semilla.alteradas.length}, adicionales=${semilla.adicionales}.`);
    const conteosIniciales = conteosDeTablas(psql(recursos.baseDatos, consultaConteos)); iniciales.push(conteosIniciales);
    api = spawn(process.execPath, ['--import', 'tsx', 'scripts/e2e-efimero-002.ts', 'servir', id], { cwd: backend, stdio: ['ignore', openSync(registroApi, 'w'), openSync(registroApi, 'a')] });
    web = spawn(process.execPath, [resolve(frontend, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(identidad002Esperada.puertoWeb), '--strictPort', '--mode', 'validation'], { cwd: frontend, stdio: ['ignore', openSync(registroWeb, 'w'), openSync(registroWeb, 'a')] });
    serviciosActivos = [api, web];
    entrada.pids = { api: api.pid, web: web.pid }; await registrar(entornos);
    await esperar(`http://127.0.0.1:${identidad002Esperada.puertoApi}/api/v1/salud`); await esperar(`http://127.0.0.1:${identidad002Esperada.puertoWeb}/`);
    // Agente que, a petición de la prueba, retiene la confirmación de una fotografía (CA-PRE-06) en la base descartable de ESTA corrida.
    await rm(carpetaSenales, { recursive: true, force: true }); await mkdir(carpetaSenales, { recursive: true });
    const registroAgente = resolve(tmpdir(), `ayacucho-002-e2e-${id}-agente.log`);
    agente = spawn(process.execPath, ['--import', 'tsx', 'scripts/agente-retencion-e2e-002.ts', id, `--senales=${carpetaSenales}`], { cwd: backend, stdio: ['ignore', openSync(registroAgente, 'w'), openSync(registroAgente, 'a')] });
    serviciosActivos = [api, web, agente];
    entrada.estado = 'en uso'; entrada.pids = { api: api.pid, web: web.pid, agente: agente.pid }; await registrar(entornos);

    await writeFile(resolve(evidencia, 'preparacion-002.json'), JSON.stringify({
      ejecucion: id, fecha: new Date().toISOString(), independencia: { ok: true, identidad002, referencia001: independencia.referencia001 },
      semilla: { ok: true, estricta: true, adicionales: 0 }, recursos: { aislamiento: 'efimero', baseDatos: recursos.baseDatos, bucket: recursos.bucket, espacioRedis: recursos.espacioRedis },
      tls: { caSha256: certificadoCa.fingerprint256, servidorSha256: servidor.fingerprint256 },
    }, null, 2));
    const montajes = [
      ['--mount', `type=bind,source=${ca},target=/validacion/ca.crt,readonly`], ['--mount', `type=bind,source=${evidencia},target=/app/.local/evidencia/002/e2e-linux`],
      ['--mount', `type=bind,source=${resolve(frontend, 'scripts')},target=/app/frontend/scripts,readonly`], ['--mount', `type=bind,source=${resolve(frontend, 'test')},target=/app/frontend/test,readonly`],
      ['--mount', `type=bind,source=${resolve(frontend, 'playwright.002.config.ts')},target=/app/frontend/playwright.002.config.ts,readonly`],
    ].flat();
    const entorno = ['E2E_PREPARACION_002=/app/.local/evidencia/002/e2e-linux/preparacion-002.json', `E2E_EJECUCION_002=${id}`, 'E2E_EVIDENCIA=/app/.local/evidencia/002/e2e-linux', `E2E_OPERADOR_002=${operadorEnContenedor}`, 'E2E_TLS_NEGATIVAS=true', 'MAILPIT_API=http://correo:8025', 'E2E_IMAGENES_002=/app/.local/evidencia/002/e2e-linux/imagenes', 'E2E_SENALES_002=/app/.local/evidencia/002/e2e-linux/senales'].flatMap((e) => ['-e', e]);
    const r = docker(['run', '--rm', '--init', '--name', `ayacucho-002-e2e-${id.slice(0, 8)}`, '--label', `ayacucho.e2e002=${id}`, '--network', red, '--shm-size=1g', ...montajes, ...entorno,
      '--entrypoint', '/bin/bash', imagen, '/app/frontend/scripts/confianza-e2e-002.sh', ...(especificacion ? [especificacion] : []), ...resto], { stdio: 'inherit' });
    resultado = { codigo: r.status ?? 1 };
    // Estado final de la base descartable y su auditoría, conservada como evidencia antes de retirarla.
    const conteosFinales = conteosDeTablas(psql(recursos.baseDatos, consultaConteos));
    const auditoria = JSON.parse(psql(recursos.baseDatos, consultaAuditoria).trim() || '[]');
    await writeFile(resolve(evidencia, `auditoria-corrida-${i + 1}.json`), JSON.stringify({ ejecucion: id, filas: auditoria.length, registros: auditoria }, null, 2));
    resultado.cambios = diferenciaDeConteos(conteosIniciales, conteosFinales); resultado.auditoria = auditoria.length;
  } catch (error) { fallo = error instanceof Error ? error.message : String(error); resultado = { codigo: 1 }; }
  finally {
    detener(api); detener(web); detener(agente);
    await new Promise((r) => setTimeout(r, 1500));
    await rm(carpetaSenales, { recursive: true, force: true });
    // Mensajes de correo generados por ESTA corrida; los anteriores no se tocan.
    const nuevos = elementosNuevos(mensajesAntes, await idsMailpit());
    if (nuevos.length) await fetch(mailpit, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ IDs: nuevos }) });
    const retirado = tsx('retirar', id, `--operador=${operador}`);
    const baseResidual = psql('postgres', `select count(*) from pg_database where datname = '${recursos.baseDatos}'`).trim() !== '0';
    const bucketResidual = garage('bucket', 'info', recursos.bucket).status === 0;
    const redisResidual = salida(docker(['exec', contenedor('redis'), 'redis-cli', '--scan', '--pattern', `${recursos.espacioRedis}:*`]), 'No se pudo listar Redis 002').trim() !== '';
    const limpio = retirado.status === 0 && !baseResidual && !bucketResidual && !redisResidual;
    entrada.estado = limpio ? 'retirado' : 'RESIDUOS'; await registrar(entornos);
    if (!limpio) fallo = `${fallo ?? ''} Recursos descartables sin retirar (base=${baseResidual}, bucket=${bucketResidual}, redis=${redisResidual}).`.trim();
    if (!fallo && resultado.codigo === 0) { await rm(registroApi, { force: true }); await rm(registroWeb, { force: true }); }
    else process.stderr.write(`Registros de servicios de la corrida ${i + 1}: ${registroApi} y ${registroWeb}\n`);
    corridas.push({ corrida: i + 1, id, especificacion: especificacion || '(todas)', inicio, fin: new Date().toISOString(), resultado: resultado.codigo, tablasConDatosNuevos: resultado.cambios ?? null, filasAuditoria: resultado.auditoria ?? null, retirado: limpio, ...(fallo ? { fallo } : {}) });
    if (resultado.codigo !== 0 || !limpio || fallo) codigoFinal = codigoFinal || resultado.codigo || 1;
    if (fallo) process.stderr.write(`Corrida ${i + 1}: ${fallo}\n`);
  }
  if (!corridas.at(-1).retirado) break;
}

await rm(carpetaImagenes, { recursive: true, force: true });

// --- 3) Cada corrida empezó desde el mismo estado inicial ---
const igualesIniciales = iniciales.every((c) => Object.keys(diferenciaDeConteos(iniciales[0], c)).length === 0);
if (!igualesIniciales) codigoFinal = codigoFinal || 1;
// --- 4) La validación local no cambió ---
const validacionDespues = await fotoValidacion();
const sinCambios = {
  huellaTablas: validacionAntes.huellaTablas === validacionDespues.huellaTablas, bucket: validacionAntes.bucket === validacionDespues.bucket,
  clavesRedisNuevas: elementosNuevos(validacionAntes.clavesRedis, validacionDespues.clavesRedis).length, mensajesPrevios: elementosNuevos(validacionAntes.mensajes, validacionDespues.mensajes).length,
  mensajesPreviosConservados: validacionAntes.mensajes.every((m) => validacionDespues.mensajes.includes(m)),
};
const validacionIntacta = sinCambios.huellaTablas && sinCambios.bucket && sinCambios.clavesRedisNuevas === 0 && sinCambios.mensajesPrevios === 0 && sinCambios.mensajesPreviosConservados;
if (!validacionIntacta) codigoFinal = codigoFinal || 1;
await writeFile(resolve(evidencia, 'serie-002.json'), JSON.stringify({
  ejecucion: corridas[0]?.id ?? null, imagen, red, evidencia: relative(local, evidencia).replaceAll('\\', '/'), aislamiento: 'recursos descartables por corrida', corridas,
  estadoInicialIgualEntreCorridas: igualesIniciales, validacionLocalSinCambios: validacionIntacta, detalleValidacion: sinCambios, resultado: codigoFinal,
}, null, 2));
if (!validacionIntacta) process.stderr.write('La validación local cambió durante la serie; revise serie-002.json.\n');
process.exitCode = codigoFinal;
