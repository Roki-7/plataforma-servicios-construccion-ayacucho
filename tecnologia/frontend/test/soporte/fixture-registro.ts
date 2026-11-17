import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Perfil } from '../../src/features/usuarios-acceso/modelos/contratos.js';
const ejecutar = promisify(execFile);
export async function crearFixtureRegistro(proyecto: string) {
  if (process.env['E2E_FIXTURES_US1']) {
    const matriz = JSON.parse(await readFile(process.env['E2E_FIXTURES_US1'], 'utf8')) as Record<string, { acceso: string; perfil: Perfil }>;
    const datos = matriz[proyecto]; if (!datos) throw new Error('Falta fixture US1 del proyecto.');
    return { ...datos, cerrar: async () => undefined }; // El ejecutor host retira las cuentas al finalizar.
  }
  const backend = resolve('../backend');
  const args = [resolve(backend, 'node_modules/tsx/dist/cli.mjs'), resolve(backend, 'test/soporte/fixture-registro-e2e.ts')];
  const { stdout } = await ejecutar(process.execPath, [...args, 'crear'], { cwd: backend });
  const datos = JSON.parse(stdout) as { acceso: string; perfil: Perfil };
  return { ...datos, cerrar: async () => { await ejecutar(process.execPath, [...args, 'cerrar', datos.perfil.cuentaId], { cwd: backend }); } };
}
