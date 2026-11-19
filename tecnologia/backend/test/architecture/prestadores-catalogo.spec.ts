import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

function analizar(entradas: string[]) {
  const resultado = spawnSync(process.execPath, [resolve('node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'),
    '--config', '../dependency-cruiser.cjs', '--output-type', 'json', ...entradas], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  expect(resultado.status).toBe(0);
  const salida: { summary: { totalCruised: number; violations: { rule: { name: string } }[] } } = JSON.parse(resultado.stdout);
  expect(salida.summary.totalCruised).toBeGreaterThan(0);
  return salida.summary.violations.map(v => v.rule.name);
}

test('PR12 preserva las APIs internas y capas en la composición común', () => {
  expect(analizar(['src', '../frontend/src'])).toEqual([]);
}, 45000);

test('PR12 detecta framework en dominio, persistencia en puerto, acceso privado y ciclos', async () => {
  const base = resolve('test');
  const carpeta = await mkdtemp(resolve(base, 'arquitectura-002-'));
  const archivos = {
    'modulos/prestadores/dominio/prueba.ts': "import '@nestjs/common'; import '../../catalogo/dominio/entidad.js';",
    'modulos/catalogo/dominio/entidad.ts': 'export const entidad = 1;',
    'modulos/prestadores/aplicacion/puertos/prueba.ts': "import 'typeorm'; import '../../infraestructura/detalle.js';",
    'modulos/prestadores/infraestructura/detalle.ts': 'export const detalle = 1;',
    'modulos/catalogo/api-publica.ts': "import '../administracion/api-publica.js'; export const contrato = 1;",
    'modulos/administracion/api-publica.ts': "import '../catalogo/api-publica.js';",
    'modulos/administracion/infraestructura/repositorio.ts': "import '../../prestadores/infraestructura/detalle.js';",
    'modulos/cotizaciones/infraestructura/repositorio.ts': "import '../../prestadores/infraestructura/detalle.js';",
  };
  try {
    for (const [archivo, contenido] of Object.entries(archivos)) {
      const destino = resolve(carpeta, archivo);
      await mkdir(resolve(destino, '..'), { recursive: true });
      await writeFile(destino, contenido);
    }
    const hallazgos = analizar([relative(process.cwd(), carpeta).replaceAll(sep, '/')]);
    expect(hallazgos).toEqual(expect.arrayContaining(['dominio-sin-detalles', 'dominio-sin-otro-modulo', 'puertos-002-sin-persistencia',
      'modulos-002-consumen-apis-publicas', 'modulos-002-exponen-solo-apis-publicas', 'sin-ciclos']));
  } finally {
    const ruta = await realpath(carpeta);
    const hijo = relative(await realpath(base), ruta);
    if (hijo.startsWith('arquitectura-002-') && !hijo.includes(sep) && !isAbsolute(hijo)) await rm(ruta, { recursive: true, force: true });
  }
}, 45000);
