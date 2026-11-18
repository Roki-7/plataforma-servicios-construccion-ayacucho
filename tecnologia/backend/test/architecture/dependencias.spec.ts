import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

function analizar(entradas: string[]) {
  const ejecucion = spawnSync(process.execPath, [
    resolve('node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'),
    '--config', '../dependency-cruiser.cjs', '--output-type', 'json', ...entradas,
  ], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024});
  if (ejecucion.error) throw ejecucion.error;
  if (ejecucion.status !== 0 || !ejecucion.stdout) throw new Error('El analizador no produjo JSON: ' + ejecucion.stderr);
  const salida = JSON.parse(ejecucion.stdout) as {summary: {totalCruised: number; violations: {rule: {name: string}}[]}};
  if (salida.summary.totalCruised < 1) throw new Error('PR12 no analizó los archivos de entrada: ' + entradas.join(', '));
  return salida.summary.violations.map(v => v.rule.name);
}

test('PR12 analiza las dependencias reales de backend y frontend', () => {
  expect(analizar(['src', '../frontend/src'])).toEqual([]);
}, 45000);

test('PR12 el detector rechaza dependencias cruzadas, adaptadores y tipos de persistencia', async () => {
  const base = resolve('test');
  await mkdir(base, {recursive: true});
  const espacio = await mkdtemp(resolve(base, 'arquitectura-'));
  try {
    const archivos = {
      'modulos/usuarios-acceso/dominio/prueba.ts': "import 'node:https'; import '../../otro/dominio/entidad.js'; import '../infraestructura/repositorio.js';",
      'modulos/otro/dominio/entidad.ts': 'export const dato = 1;',
      'modulos/usuarios-acceso/infraestructura/repositorio.ts': "import '../../notificaciones/infraestructura/detalle.js';",
      'modulos/usuarios-acceso/aplicacion/puertos/prueba.ts': "export type { QueryRunner } from '../../../node_modules/typeorm/index.js'; import '../../infraestructura/repositorio.js';",
      'modulos/node_modules/typeorm/index.d.ts': 'export interface QueryRunner { id: string }',
      'modulos/notificaciones/infraestructura/detalle.ts': 'export const detalle = 1;',
      'frontend/src/features/ejemplo/aplicacion/uso.ts': "import '../../../../node_modules/react/index.js';",
      'frontend/node_modules/react/index.js': 'export const biblioteca = 1;',
    };
    for (const [archivo, contenido] of Object.entries(archivos)) {
      const destino = resolve(espacio, archivo);
      await mkdir(resolve(destino, '..'), {recursive: true});
      await writeFile(destino, contenido);
    }
    const analisis = analizar([relative(process.cwd(), espacio).replaceAll(sep, '/')]);
    expect(analisis).toEqual(expect.arrayContaining([
      'dominio-sin-detalles', 'dominio-sin-otro-modulo', 'aplicacion-sin-implementaciones', 'capas-puras-sin-http',
      'puertos-usuarios-sin-persistencia', 'usuarios-no-importa-notificaciones-privadas', 'frontend-puro',
    ]));
  } finally {
    const ruta = await realpath(espacio);
    const hijo = relative(await realpath(base), ruta);
    if (hijo.startsWith('arquitectura-') && !hijo.includes(sep) && !isAbsolute(hijo)) await rm(ruta, {recursive: true, force: true});
  }
}, 45000);
