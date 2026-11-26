import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

// PR12 para los módulos de la 003 (Solicitudes y Cotizaciones). Las reglas viven en tecnologia/dependency-cruiser.cjs, compartido con 001 y 002.
function analizar(entradas: string[]) {
  const resultado = spawnSync(process.execPath, [resolve('node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'),
    '--config', '../dependency-cruiser.cjs', '--output-type', 'json', ...entradas], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  expect(resultado.status).toBe(0);
  const salida: { summary: { totalCruised: number; violations: { rule: { name: string }; from: string; to: string }[] } } = JSON.parse(resultado.stdout);
  expect(salida.summary.totalCruised).toBeGreaterThan(0);
  return salida.summary.violations;
}

async function conArbol(archivos: Record<string, string>, comprobar: (hallazgos: ReturnType<typeof analizar>) => void) {
  const base = resolve('test');
  const carpeta = await mkdtemp(resolve(base, 'arquitectura-003-'));
  try {
    for (const [archivo, contenido] of Object.entries(archivos)) {
      const destino = resolve(carpeta, archivo);
      await mkdir(resolve(destino, '..'), { recursive: true });
      await writeFile(destino, contenido);
    }
    comprobar(analizar([relative(process.cwd(), carpeta).replaceAll(sep, '/')]));
  } finally {
    const ruta = await realpath(carpeta);
    const hijo = relative(await realpath(base), ruta);
    if (hijo.startsWith('arquitectura-003-') && !hijo.includes(sep) && !isAbsolute(hijo)) await rm(ruta, { recursive: true, force: true });
  }
}
const reglas = (hallazgos: ReturnType<typeof analizar>) => hallazgos.map(h => h.rule.name);

test('PR12 el código actual cumple todas las reglas, con las de la 003 incluidas', () => {
  expect(reglas(analizar(['src', '../frontend/src']))).toEqual([]);
}, 60000);

test('PR12 detecta dominio con framework o con otro módulo, aplicación con implementaciones y consumo de módulos ajenos sin su api-publica', async () => {
  await conArbol({
    'modulos/solicitudes/dominio/solicitud.ts': "import '@nestjs/common'; import '../../cotizaciones/dominio/cotizacion.js'; export const solicitud = 1;",
    'modulos/cotizaciones/dominio/cotizacion.ts': 'export const cotizacion = 1;',
    'modulos/solicitudes/aplicacion/publicar.ts': "import '../infraestructura/repositorio.js'; export const publicar = 1;",
    'modulos/solicitudes/infraestructura/repositorio.ts': 'export const repositorio = 1;',
    'modulos/cotizaciones/aplicacion/enviar.ts': "import '../../prestadores/infraestructura/detalle.js'; export const enviar = 1;",
    'modulos/prestadores/infraestructura/detalle.ts': 'export const detalle = 1;',
    'modulos/catalogo/aplicacion/ajena.ts': "import '../../solicitudes/infraestructura/repositorio.js'; export const ajena = 1;",
  }, (hallazgos) => {
    const nombres = reglas(hallazgos);
    expect(nombres).toEqual(expect.arrayContaining(['dominio-sin-detalles', 'dominio-sin-otro-modulo', 'aplicacion-sin-implementaciones',
      'modulos-003-consumen-apis-publicas', 'modulos-003-exponen-solo-apis-publicas']));
    expect(hallazgos.some(h => h.rule.name === 'modulos-003-consumen-apis-publicas' && h.from.includes('cotizaciones/aplicacion/enviar'))).toBe(true);
    expect(hallazgos.some(h => h.rule.name === 'modulos-003-exponen-solo-apis-publicas' && h.from.includes('catalogo/aplicacion/ajena'))).toBe(true);
  });
}, 60000);

test('PR12 Solicitudes no importa Cotizaciones ni siquiera por su api-publica, y los ciclos entre ambos se detectan', async () => {
  await conArbol({
    'modulos/solicitudes/aplicacion/interesados.ts': "import '../../cotizaciones/api-publica.js'; export const interesados = 1;",
    'modulos/cotizaciones/api-publica.ts': "import '../solicitudes/api-publica.js'; export const cotizaciones = 1;",
    'modulos/solicitudes/api-publica.ts': "import './aplicacion/interesados.js'; export const solicitudes = 1;",
  }, (hallazgos) => {
    expect(reglas(hallazgos)).toEqual(expect.arrayContaining(['solicitudes-sin-cotizaciones', 'sin-ciclos']));
    expect(hallazgos.some(h => h.rule.name === 'solicitudes-sin-cotizaciones' && h.from.includes('solicitudes/aplicacion/interesados'))).toBe(true);
  });
}, 60000);

test('PR12 permite el consumo previsto: Cotizaciones usa la api-publica de Solicitudes, Prestadores, Catálogo y Notificaciones, y la composición ensambla todo', async () => {
  await conArbol({
    'modulos/cotizaciones/aplicacion/enviar.ts': [
      "import '../../solicitudes/api-publica.js'; import '../../prestadores/api-publica.js'; import '../../catalogo/api-publica.js';",
      "import '../../notificaciones/api-publica.js'; import '../../usuarios-acceso/api-publica.js'; import '../dominio/cotizacion.js'; export const enviar = 1;"].join('\n'),
    'modulos/cotizaciones/dominio/cotizacion.ts': 'export const cotizacion = 1;',
    'modulos/solicitudes/aplicacion/publicar.ts': "import '../../prestadores/api-publica.js'; import '../../catalogo/api-publica.js'; import '../dominio/solicitud.js'; export const publicar = 1;",
    'modulos/solicitudes/dominio/solicitud.ts': 'export const solicitud = 1;',
    'modulos/solicitudes/api-publica.ts': 'export const solicitudes = 1;',
    'modulos/prestadores/api-publica.ts': 'export const prestadores = 1;',
    'modulos/catalogo/api-publica.ts': 'export const catalogo = 1;',
    'modulos/notificaciones/api-publica.ts': 'export const notificaciones = 1;',
    'modulos/usuarios-acceso/api-publica.ts': 'export const usuarios = 1;',
    'composicion/ensamblado.ts': "import '../modulos/solicitudes/infraestructura/repositorio.js'; import '../modulos/cotizaciones/api-publica.js'; export const ensamblado = 1;",
    'modulos/solicitudes/infraestructura/repositorio.ts': 'export const repositorio = 1;',
    'modulos/cotizaciones/api-publica.ts': 'export const cotizaciones = 1;',
  }, (hallazgos) => {
    expect(reglas(hallazgos).filter(r => r.includes('003') || r === 'solicitudes-sin-cotizaciones')).toEqual([]);
  });
}, 60000);
