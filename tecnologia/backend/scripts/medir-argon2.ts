import { arch, platform, availableParallelism } from 'node:os';
import { performance } from 'node:perf_hooks';
import { HashArgon2id } from '../src/modulos/usuarios-acceso/infraestructura/seguridad/argon2id.js';

const hash = new HashArgon2id();
const frase = ' frase de caracterización ficticia ';
const phc = await hash.crear(frase);
const medidas = [];
for (const concurrencia of [1,2]) {
  const rssInicial = process.memoryUsage.rss();
  let rssPico = rssInicial;
  const muestreo = setInterval(() => { rssPico = Math.max(rssPico,process.memoryUsage.rss()); },5);
  const t = performance.now();
  try {
    const verificaciones = await Promise.all(Array.from({length:concurrencia},()=>hash.verificar(frase,phc)));
    if (!verificaciones.every(Boolean)) throw new Error('Falló el control de verificación.');
    medidas.push({concurrencia, duracionMs: performance.now()-t, rssInicial, rssPico: Math.max(rssPico,process.memoryUsage.rss())});
  } finally { clearInterval(muestreo); }
}
process.stdout.write(JSON.stringify({node:process.version,plataforma:platform(),arquitectura:arch(),cpus:availableParallelism(),memoria:'RSS total del proceso en bytes, muestreo de 5 ms',medidas},null,2)+'\n');
