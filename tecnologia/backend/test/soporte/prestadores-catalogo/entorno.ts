import { mkdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { local } from '../../../scripts/entorno.js';

export const evidencia002 = resolve(local, 'evidencia/002');

export async function prepararEvidencia002(carpeta = evidencia002): Promise<{ JEST_JUNIT_OUTPUT_DIR: string; E2E_EVIDENCIA: string }> {
  const destino = resolve(carpeta);
  const desplazamiento = relative(evidencia002, destino);
  if (isAbsolute(desplazamiento) || desplazamiento === '..' || desplazamiento.startsWith(`..${sep}`)) {
    throw new Error('La evidencia debe quedar dentro de tecnologia/.local/evidencia/002.');
  }
  const baseReal = await realpath(local);
  for (let ruta = destino; relative(local, ruta) !== ''; ruta = dirname(ruta)) {
    const real = await realpath(ruta).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
      return undefined;
    });
    if (real && relative(baseReal, real) !== relative(local, ruta)) throw new Error('La evidencia apunta fuera de la 002.');
  }
  await mkdir(destino, { recursive: true });
  const destinoReal = await realpath(destino);
  if (relative(baseReal, destinoReal) !== relative(local, destino)) throw new Error('La evidencia apunta fuera de la 002.');
  return { JEST_JUNIT_OUTPUT_DIR: destinoReal, E2E_EVIDENCIA: destinoReal };
}
