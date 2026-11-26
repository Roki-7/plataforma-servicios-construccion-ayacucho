import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { request as httpsRequest } from 'node:https';

/**
 * T083 · Réplicas de la API de la 002 en contenedores con límites efectivos de CPU y memoria, detrás de un balanceador Caddy (round robin) y con el presupuesto de PostgreSQL fijado.
 * Solo crea y retira contenedores `ayacucho-002-t083-*`; no modifica el contenedor de PostgreSQL de la 002 (solo registra su configuración).
 */
export const imagenEnsayo = 'ayacucho-backend-ensayo-002:t083';
const imagenCaddy = 'caddy:2-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0';
export const puertoBalanceador = 8446;
const docker = (args, opciones = {}) => spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opciones });
const unidadAMB = (m) => { const n = /^(\d+)([mg])$/i.exec(m); if (!n) throw new Error('--memoria debe tener la forma 512m o 1g.'); return Number(n[1]) * (n[2].toLowerCase() === 'g' ? 1024 : 1); };

export function limitesEfectivos(nombre) {
  const i = JSON.parse(docker(['inspect', nombre]).stdout)[0].HostConfig;
  const leer = (ruta) => (docker(['exec', nombre, 'cat', ruta]).stdout ?? '').trim();
  return { contenedor: nombre, nanoCpus: i.NanoCpus, cpus: i.NanoCpus / 1e9, memoriaBytes: i.Memory, memoriaMB: Math.round(i.Memory / 2 ** 20), swapBytes: i.MemorySwap,
    // El anfitrión usa cgroup v1 (Docker Desktop); si fuera v2 se leen cpu.max y memory.max.
    cgroup: { cpuCuotaUs: Number(leer('/sys/fs/cgroup/cpu/cpu.cfs_quota_us') || NaN), cpuPeriodoUs: Number(leer('/sys/fs/cgroup/cpu/cpu.cfs_period_us') || NaN), memoriaLimiteBytes: Number(leer('/sys/fs/cgroup/memory/memory.limit_in_bytes') || NaN), cpuMaxV2: leer('/sys/fs/cgroup/cpu.max'), memoryMaxV2: leer('/sys/fs/cgroup/memory.max') } };
}

export async function levantarReplicas({ id, replicas, cpus, memoria, red, contenedorPostgres, local, alRegistrar = () => {} }) {
  const mb = unidadAMB(memoria);
  const apis = Array.from({ length: replicas }, (_, i) => `ayacucho-002-t083-api-${i + 1}`);
  const balanceador = 'ayacucho-002-t083-balanceador';
  const hostPg = JSON.parse(docker(['inspect', contenedorPostgres]).stdout)[0].HostConfig;
  const estado = { apis, balanceador, carpeta: await mkdtemp(resolve(tmpdir(), 'ayacucho-002-t083-')) };
  const retirar = async () => {
    for (const n of [balanceador, ...apis]) docker(['rm', '-f', n]);
    await rm(estado.carpeta, { recursive: true, force: true }).catch(() => undefined);
  };
  try {
    for (const n of [balanceador, ...apis]) docker(['rm', '-f', n]);
    for (const n of apis) {
      const r = docker(['run', '-d', '--name', n, '--network', red, '--cpus', String(cpus), '--memory', `${mb}m`, '--memory-swap', `${mb}m`, '--restart', 'no',
        '--mount', `type=bind,source=${resolve(local, '002')},target=/tecnologia/.local/002,readonly`, '-e', 'CATALOGO_MANIFIESTO=/tecnologia/.local/002/catalogo/manifest.json',
        imagenEnsayo, 'node', '--import', 'tsx', 'scripts/servir-replica-002.ts', id]);
      if (r.status !== 0) throw new Error(`No se pudo iniciar ${n}: ${(r.stderr ?? '').trim().slice(0, 300)}`);
    }
    const caddyfile = `{\n  auto_https off\n  admin off\n}\nhttps://localhost:${puertoBalanceador} {\n  tls /certs/localhost.crt /certs/localhost.key\n  log {\n    output stdout\n    format json\n  }\n  header {\n    >Cache-Control no-store\n    >Referrer-Policy no-referrer\n    >X-Content-Type-Options nosniff\n  }\n  reverse_proxy ${apis.map((n) => `${n}:3003`).join(' ')} {\n    lb_policy round_robin\n    header_down X-Replica {http.reverse_proxy.upstream.hostport}\n  }\n}\n`;
    await writeFile(resolve(estado.carpeta, 'Caddyfile'), caddyfile, 'utf8');
    const b = docker(['run', '-d', '--name', balanceador, '--network', red, '--restart', 'no', '-p', `127.0.0.1:${puertoBalanceador}:${puertoBalanceador}`,
      '--mount', `type=bind,source=${resolve(estado.carpeta, 'Caddyfile')},target=/etc/caddy/Caddyfile,readonly`,
      '--mount', `type=bind,source=${resolve(local, '002/tls/localhost.crt')},target=/certs/localhost.crt,readonly`,
      '--mount', `type=bind,source=${resolve(local, '002/tls/localhost.key')},target=/certs/localhost.key,readonly`, imagenCaddy]);
    if (b.status !== 0) throw new Error(`No se pudo iniciar el balanceador: ${(b.stderr ?? '').trim().slice(0, 300)}`);
    alRegistrar({ apis, balanceador });
    estado.limites = apis.map(limitesEfectivos);
    for (const l of estado.limites) {
      const g = l.cgroup; const cpuEfectiva = Number.isFinite(g.cpuCuotaUs) && g.cpuCuotaUs > 0 ? g.cpuCuotaUs / g.cpuPeriodoUs : Number(g.cpuMaxV2.split(' ')[0]) / Number(g.cpuMaxV2.split(' ')[1]); const memEfectiva = Number.isFinite(g.memoriaLimiteBytes) ? g.memoriaLimiteBytes : Number(g.memoryMaxV2);
      if (Math.abs(l.cpus - Number(cpus)) > 1e-9 || l.memoriaMB !== mb || Math.abs(cpuEfectiva - Number(cpus)) > 1e-6 || memEfectiva !== mb * 2 ** 20) throw new Error(`Docker no aplicó los límites previstos a ${l.contenedor}: ${JSON.stringify(l)}`);
    }
    // PostgreSQL no se modifica: es el mismo contenedor, con la misma configuración y sin límites propios de CPU ni memoria (comparten el mismo anfitrión de Docker) en las tres configuraciones.
    estado.postgres = { contenedor: contenedorPostgres, nanoCpus: hostPg.NanoCpus, memoriaBytes: hostPg.Memory, nota: 'sin límites propios; idéntico en las tres configuraciones' };
  } catch (error) { await retirar(); throw error; }
  const esperar = async (ruta, ca, ms = 90000) => {
    // Con round robin cada petición va a una réplica distinta: una ruta está lista cuando 3 respuestas 200 consecutivas por réplica llegan realmente de las réplicas (cabecera X-Replica) y se vieron todas.
    const fin = Date.now() + ms; const necesarias = 3 * replicas; let seguidas = 0; const vistas = new Set();
    while (Date.now() < fin) {
      const r = await new Promise((ok) => { const q = httpsRequest({ host: '127.0.0.1', port: puertoBalanceador, servername: 'localhost', headers: { host: `localhost:${puertoBalanceador}` }, path: ruta, ca, rejectUnauthorized: true, timeout: 5000 }, (res) => { res.resume(); ok({ estado: res.statusCode, replica: res.headers['x-replica'] }); }); q.on('error', () => ok({ estado: 0 })); q.on('timeout', () => { q.destroy(); ok({ estado: 0 }); }); q.end(); });
      if (r.estado === 200 && r.replica) { seguidas += 1; vistas.add(r.replica); if (seguidas >= necesarias && vistas.size === replicas) return; continue; }
      seguidas = 0; vistas.clear(); await new Promise((x) => setTimeout(x, 500));
    }
    throw new Error(`El balanceador no entrega ${ruta} desde todas las réplicas a tiempo.`);
  };
  return {
    ...estado, origen: `https://localhost:${puertoBalanceador}`, esperar, retirar,
    /** Distribución del tráfico por réplica (y por estado) según el registro de accesos del balanceador, solo desde `desdeMs` (inicio de k6: excluye el calentamiento). */
    distribucion(desdeMs = 0) {
      const texto = docker(['logs', balanceador]); const lineas = `${texto.stdout ?? ''}\n${texto.stderr ?? ''}`.split(/\r?\n/);
      const porReplica = {}; const porEstado = {}; let total = 0;
      for (const l of lineas) {
        if (!l.startsWith('{') || !l.includes('"msg":"handled request"')) continue;
        try { const j = JSON.parse(l); if (j.ts * 1000 < desdeMs) continue; total += 1; const r = (j.resp_headers?.['X-Replica'] ?? ['desconocida'])[0]; porReplica[r] = (porReplica[r] ?? 0) + 1; porEstado[j.status] = (porEstado[j.status] ?? 0) + 1; } catch { /* línea parcial */ }
      }
      return { totalSolicitudes: total, porReplica, porEstado };
    },
    estadoContenedores() {
      return Object.fromEntries(apis.map((n) => { const c = JSON.parse(docker(['inspect', n]).stdout)[0]; return [n, { estado: c.State.Status, codigoSalida: c.State.ExitCode, oomKilled: c.State.OOMKilled, reinicios: c.RestartCount }]; }));
    },
    registrosApi() { return Object.fromEntries(apis.map((n) => { const l = docker(['logs', '--tail', '40', n]); return [n, `${l.stdout ?? ''}${l.stderr ?? ''}`.slice(-4000)]; })); },
  };
}

/** Muestras cada 30 s del consumo real (CPU % y memoria) de las réplicas, el balanceador, PostgreSQL y Redis. */
export function iniciarMuestreoContenedores(nombres, intervaloMs = 30000) {
  const muestras = []; let activo = true; let pendiente = Promise.resolve();
  const tomar = () => new Promise((fin) => {
    const m = { t: new Date().toISOString() }; let texto = '';
    const s = spawn('docker', ['stats', '--no-stream', '--format', '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.PIDs}}', ...nombres], { stdio: ['ignore', 'pipe', 'ignore'] });
    s.stdout.on('data', (d) => { texto += d; });
    s.on('close', () => { m.contenedores = Object.fromEntries(texto.split(/\r?\n/).filter(Boolean).map((l) => { const [n, cpu, mem, pct, pids] = l.split('|'); return [n, { cpu, memoria: mem, memoriaPct: pct, procesos: pids }]; })); muestras.push(m); fin(); });
  });
  const temporizador = setInterval(() => { if (activo) pendiente = pendiente.then(tomar); }, intervaloMs); pendiente = tomar();
  return { async detener() { activo = false; clearInterval(temporizador); await pendiente; return muestras; } };
}
