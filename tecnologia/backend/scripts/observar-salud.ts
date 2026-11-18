import { setTimeout as esperar } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { platform } from 'node:os';

const url = 'https://localhost:8443/api/v1/salud';
const cantidad = Number(process.argv[2] ?? 2);
const archivo = process.argv[3];
const version = process.argv[4];
if (process.env['VALIDATION_MODE'] !== 'true' || !Number.isSafeInteger(cantidad) || cantidad < 2 || !archivo || !version) {
  throw new Error('Use VALIDATION_MODE=true, cantidad >=2, un nuevo archivo JSONL y la versión probada.');
}
const destino = resolve(archivo);
await mkdir(dirname(destino), {recursive:true});
await appendFile(destino, JSON.stringify({evento:'inicio',fecha:new Date().toISOString(),version,plataforma:platform(),node:process.version,url,intervaloMs:60000,muestras:cantidad})+'\n',{flag:'wx'});
const inicio = performance.now();
let incidencia = false;
for (let n=0;n<cantidad;n++) {
  if (n) await esperar(Math.max(0,60000*n-(performance.now()-inicio)));
  const instante = new Date().toISOString();
  const t = performance.now();
  let http: number | null = null, disponible = false, huella: string | null = null;
  try {
    const respuesta = await fetch(url,{signal:AbortSignal.timeout(10000)});
    http = respuesta.status;
    const cuerpo = await respuesta.text();
    huella = createHash('sha256').update(cuerpo).digest('hex');
    disponible = http===200 && JSON.parse(cuerpo).estado==='disponible';
  } catch { /* Solo se registra el estado, sin errores con datos de conexión. */ }
  incidencia ||= !disponible;
  await appendFile(destino,JSON.stringify({evento:'muestra',instante,http,disponible,duracionMs:performance.now()-t,huella})+'\n');
}
const fin = { evento: 'fin', fecha: new Date().toISOString(), duracionMs: performance.now() - inicio, incidencia };
await appendFile(destino, JSON.stringify(fin) + '\n');
process.stdout.write(JSON.stringify({ ...fin, version, muestras: cantidad }) + '\n');
if(incidencia)process.exitCode=1;
