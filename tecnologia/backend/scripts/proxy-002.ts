import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { local002, origen002, proyecto002, puertos002 } from './entorno-002.js';
import { tecnologia } from './entorno.js';

/**
 * Comprobación de solo lectura del proxy Caddy de la 002. Parte de la plantilla de la 001 (`infra/Caddyfile`, no se modifica) y del origen y los puertos
 * de `puertos002` para obtener el Caddyfile esperado, y lo compara con:
 *  1. el archivo generado `.local/002/Caddyfile`,
 *  2. el archivo realmente montado en el contenedor del proxy.
 * No escribe archivos ni cambia la infraestructura.
 */
export const contenedorProxy002 = `${proyecto002}-proxy-1`;
export const rutaCaddyContenedor = '/etc/caddy/Caddyfile';

const normalizar = (texto: string): string => texto.replaceAll('\r\n', '\n');
const ocurrencias = (texto: string, parte: string): number => texto.split(parte).length - 1;

/** Caddyfile esperado: la plantilla con el origen, la API y la web de la 002. Falla si la plantilla ya no contiene los valores que se sustituyen. */
export function caddyfileEsperado002(plantilla: string): string {
  const base = normalizar(plantilla);
  const sustituciones: readonly (readonly [string, string])[] = [
    ['https://localhost:8443 {', `${origen002} {`],
    ['host.docker.internal:3000', `host.docker.internal:${puertos002.api}`],
    ['host.docker.internal:5173', `host.docker.internal:${puertos002.web}`],
  ];
  let esperado = base;
  for (const [antes, despues] of sustituciones) {
    if (ocurrencias(base, antes) !== 1) throw new Error('La plantilla de Caddy no coincide con la configuración esperada de la 002.');
    esperado = esperado.replace(antes, despues);
  }
  return esperado;
}

export interface FuentesProxy002 { readonly plantilla: string; readonly generado: string; readonly montado: string }
export interface ResultadoProxy002 { readonly ok: boolean; readonly detalle: string }

/** Líneas `reverse_proxy` y de origen, que son las que fijan los puertos; sirven para explicar una diferencia sin volcar el archivo completo. */
function destinos(texto: string): string {
  return normalizar(texto).split('\n').map(l => l.trim()).filter(l => l.startsWith('reverse_proxy') || l.startsWith('https://')).join(' | ');
}

/** Compara el archivo generado y el montado con el esperado. Devuelve un resultado por fuente, sin lanzar por diferencias de contenido. */
export function compararProxy002({ plantilla, generado, montado }: FuentesProxy002): { readonly generado: ResultadoProxy002; readonly montado: ResultadoProxy002 } {
  const esperado = caddyfileEsperado002(plantilla);
  const evaluar = (real: string): ResultadoProxy002 => normalizar(real) === esperado
    ? { ok: true, detalle: destinos(esperado) }
    : { ok: false, detalle: `esperado: ${destinos(esperado)}; real: ${destinos(real)}` };
  return { generado: evaluar(generado), montado: evaluar(montado) };
}

/** Lee el Caddyfile que el contenedor del proxy tiene montado, sin shell y con argumentos fijos. */
export function leerCaddyfileMontado002(): string {
  return execFileSync('docker', ['exec', contenedorProxy002, 'cat', rutaCaddyContenedor], { encoding: 'utf8', timeout: 20_000, windowsHide: true, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
}

/** Lee las tres fuentes reales: plantilla de la 001 (solo lectura), archivo generado y archivo montado en el contenedor. */
export async function leerFuentesProxy002(): Promise<FuentesProxy002> {
  const plantilla = await readFile(resolve(tecnologia, 'infra/Caddyfile'), 'utf8');
  const generado = await readFile(resolve(local002, 'Caddyfile'), 'utf8');
  return { plantilla, generado, montado: leerCaddyfileMontado002() };
}
