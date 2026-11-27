import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
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

// ─── T092 · Análisis del grafo REAL: capas, módulos y cobertura ───────────────────────────────────────────────────────
// Las reglas de `dependency-cruiser.cjs` (arriba) prohíben patrones concretos. Lo que sigue las complementa con una descripción POSITIVA y completa de lo permitido para los
// módulos `solicitudes` y `cotizaciones`, evaluada sobre el grafo que el analizador extrae del código (importaciones estáticas, `import type`, reexportaciones `export … from`
// e importaciones dinámicas). Todo archivo nuevo entra solo en el análisis: no hay listas fijas de archivos. Límite: no analiza referencias por cadenas (p. ej. un nombre de
// clase en un proveedor de Nest) ni código ejecutado dinámicamente; esas conexiones viven en `src/composicion/` y se revisan con las pruebas de integración.
interface Dependencia { resolved: string; module: string; coreModule?: boolean; couldNotResolve?: boolean; dependencyTypes: string[] }
interface Fuente { source: string; dependencies: Dependencia[] }
type Cruce = { modules: Fuente[]; summary: { totalCruised: number; violations: { rule: { name: string }; from: string; to: string }[] } };

function cruzar(entradas: string[]): Cruce {
  const resultado = spawnSync(process.execPath, [resolve('node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'),
    '--config', '../dependency-cruiser.cjs', '--output-type', 'json', ...entradas], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  expect(resultado.status).toBe(0);
  return JSON.parse(resultado.stdout) as Cruce;
}

interface Ubicacion { readonly modulo: string; readonly capa: string }
/** Clasifica una ruta: `modulos/<m>/<capa>/…`, `modulos/<m>/api-publica.*`, `compartido/<capa>/…`, `composicion/…` u otro. */
function ubicar(ruta: string): Ubicacion {
  const p = ruta.replaceAll('\\', '/');
  const m = /(?:^|\/)modulos\/([^/]+)\/([^/]+)/.exec(p);
  if (m) return { modulo: m[1]!, capa: /^api-publica\./.test(m[2]!) ? 'api-publica' : /^(dominio|aplicacion|infraestructura|presentacion)$/.test(m[2]!) ? m[2]! : 'raiz' };
  const c = /(?:^|\/)compartido\/([^/]+)/.exec(p);
  if (c) return { modulo: 'compartido', capa: c[1]! };
  if (/(?:^|\/)composicion\//.test(p)) return { modulo: 'composicion', capa: 'composicion' };
  return { modulo: 'otro', capa: 'otro' };
}
const MODULOS_003 = ['solicitudes', 'cotizaciones'];
/** Consumo entre módulos aprobado (plan.md y research.md): solo por `api-publica`. Cotizaciones solo conoce a Solicitudes, y por UN archivo de puerto. */
const CONSUMO_APROBADO: Record<string, readonly string[]> = {
  solicitudes: ['catalogo', 'prestadores', 'notificaciones', 'usuarios-acceso'],
  cotizaciones: ['solicitudes'],
};
const PUERTO_DE_COTIZACIONES_A_SOLICITUDES = /modulos\/cotizaciones\/aplicacion\/puertos\/solicitudes\.ts$/;
const NUCLEO_PERMITIDO = new Set(['crypto', 'node:crypto']);
const PAQUETES_DE_INFRAESTRUCTURA = /^(?:typeorm|pg|@aws-sdk\/.+|sharp)$/;
const PAQUETES_DE_PRESENTACION = /^(?:@nestjs\/common|express)$/;
const ADAPTADOR_HTTP_DE_COMPOSICION = /composicion\/identidad-002\.ts$/;   // precedente de 002: los controladores leen la identidad del adaptador HTTP del arranque

function paquete(d: Dependencia): string | undefined {
  if (d.coreModule) return d.module;
  if (/node_modules/.test(d.resolved)) return (/node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(d.resolved.replaceAll('\\', '/')) ?? [])[1] ?? d.module;
  return undefined;
}

/** Devuelve cada dependencia de los módulos 003 que contradice la arquitectura aprobada, como texto legible. Vacío = cumple. */
function evaluarArquitectura(grafo: Cruce): string[] {
  const fallos: string[] = [];
  for (const fuente of grafo.modules) {
    const de = ubicar(fuente.source);
    for (const d of fuente.dependencies) {
      if (d.couldNotResolve) { if (MODULOS_003.includes(de.modulo)) fallos.push(`${fuente.source}: importación no resuelta (${d.module})`); continue; }
      const a = ubicar(d.resolved); const ext = paquete(d); const tipo = d.dependencyTypes.join(',');
      const caso = `${fuente.source} -> ${d.resolved} [${tipo}]`;
      // (1) Nadie fuera del módulo, salvo la composición y el consumo aprobado, toca un módulo 003.
      if (MODULOS_003.includes(a.modulo) && de.modulo !== a.modulo && de.modulo !== 'composicion') {
        const aprobado = a.capa === 'api-publica' && (CONSUMO_APROBADO[de.modulo] ?? []).includes(a.modulo)
          && (de.modulo !== 'cotizaciones' || PUERTO_DE_COTIZACIONES_A_SOLICITUDES.test(fuente.source.replaceAll('\\', '/')));
        if (!aprobado) fallos.push(`consumo no aprobado de un módulo 003: ${caso}`);
      }
      if (!MODULOS_003.includes(de.modulo)) continue;
      // (2) Reglas por capa del módulo de origen.
      const mismoModulo = a.modulo === de.modulo;
      const compartido = a.modulo === 'compartido';
      switch (de.capa) {
        case 'dominio':
          if (ext !== undefined || !((mismoModulo && a.capa === 'dominio') || (compartido && a.capa === 'dominio'))) fallos.push(`dominio no independiente: ${caso}`);
          break;
        case 'aplicacion': {
          const interno = mismoModulo && ['dominio', 'aplicacion', 'api-publica'].includes(a.capa);
          const otroModulo = !mismoModulo && !compartido && a.capa === 'api-publica' && (CONSUMO_APROBADO[de.modulo] ?? []).includes(a.modulo);
          const comun = compartido && ['dominio', 'aplicacion'].includes(a.capa);
          const nucleo = ext !== undefined && NUCLEO_PERMITIDO.has(ext);
          if (!(interno || otroModulo || comun || nucleo)) fallos.push(`aplicación acoplada a un detalle: ${caso}`);
          break;
        }
        case 'api-publica':
          if (!((mismoModulo && ['dominio', 'aplicacion', 'api-publica'].includes(a.capa)) || (compartido && ['dominio', 'aplicacion'].includes(a.capa)))) fallos.push(`api-publica con dependencia indebida: ${caso}`);
          break;
        case 'infraestructura': {
          const interno = mismoModulo && ['dominio', 'aplicacion', 'infraestructura'].includes(a.capa);
          const tecnologia = ext !== undefined && (PAQUETES_DE_INFRAESTRUCTURA.test(ext) || NUCLEO_PERMITIDO.has(ext) || d.coreModule === true);
          if (!(interno || compartido || tecnologia)) fallos.push(`infraestructura con dependencia indebida: ${caso}`);
          break;
        }
        case 'presentacion': {
          const interno = mismoModulo && ['dominio', 'aplicacion', 'presentacion'].includes(a.capa);
          const comun = compartido && ['dominio', 'aplicacion'].includes(a.capa);
          const adaptador = a.modulo === 'composicion' && ADAPTADOR_HTTP_DE_COMPOSICION.test(d.resolved.replaceAll('\\', '/'));
          const marco = ext !== undefined && (PAQUETES_DE_PRESENTACION.test(ext) || NUCLEO_PERMITIDO.has(ext));
          if (!(interno || comun || adaptador || marco)) fallos.push(`presentación con dependencia indebida (no debe llegar a infraestructura): ${caso}`);
          break;
        }
        default:
          fallos.push(`archivo de 003 fuera de una capa conocida: ${fuente.source}`);
      }
    }
  }
  return [...new Set(fallos)];
}

let realCruzado: Cruce | undefined;
const real = (): Cruce => (realCruzado ??= cruzar(['src']));
function archivosTs(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap(e => e.isDirectory() ? archivosTs(resolve(carpeta, e.name)) : e.name.endsWith('.ts') ? [resolve(carpeta, e.name)] : []);
}

test('PR12 el análisis cubre TODOS los archivos de los dos módulos (sin listas fijas) y registra importaciones de tipo y reexportaciones', () => {
  const grafo = real();
  for (const m of MODULOS_003) {
    const enDisco = archivosTs(resolve('src/modulos', m)).map(f => relative(process.cwd(), f).replaceAll(sep, '/')).sort();
    const analizados = grafo.modules.map(x => x.source.replaceAll('\\', '/')).filter(s => s.startsWith(`src/modulos/${m}/`)).sort();
    expect(analizados).toEqual(enDisco);
    expect(enDisco.length).toBeGreaterThan(10);
  }
  const tipos = new Set(grafo.modules.flatMap(x => x.dependencies.flatMap(d => d.dependencyTypes)));
  expect(tipos.has('type-only')).toBe(true);       // `import type`
  expect(tipos.has('export')).toBe(true);          // `export … from`
}, 60000);

test('PR12 el código real de Solicitudes y Cotizaciones cumple la arquitectura aprobada: dominio puro, aplicación sin detalles, infraestructura y presentación separadas, consumo solo por api-publica', () => {
  expect(evaluarArquitectura(real())).toEqual([]);
}, 60000);

test('PR12 grafo de módulos: sin ciclos entre módulos ni entre las capas de cada módulo 003, y Solicitudes no depende de Cotizaciones', () => {
  const grafo = real();
  const aristas = (nodo: (u: Ubicacion) => string | undefined) => {
    const g = new Map<string, Set<string>>();
    for (const f of grafo.modules) for (const d of f.dependencies) {
      if (d.couldNotResolve || paquete(d)) continue;
      const a = nodo(ubicar(f.source)); const b = nodo(ubicar(d.resolved));
      if (a && b && a !== b) { if (!g.has(a)) g.set(a, new Set()); g.get(a)!.add(b); }
    }
    return g;
  };
  /** Un ciclo que pasa por alguno de los nodos de `desde`: busca si cada uno puede volver a sí mismo. (Un ciclo ajeno, como el preexistente de 002, no es de este análisis.) */
  const ciclo = (g: Map<string, Set<string>>, desde: readonly string[] = [...g.keys()]): string[] | undefined => {
    for (const inicio of desde) {
      const visto = new Set<string>(); const camino: string[] = [inicio];
      const buscar = (n: string): boolean => {
        for (const s of g.get(n) ?? []) {
          if (s === inicio) { camino.push(s); return true; }
          if (!visto.has(s)) { visto.add(s); camino.push(s); if (buscar(s)) return true; camino.pop(); }
        }
        return false;
      };
      if (buscar(inicio)) return camino;
    }
    return undefined;
  };
  // Entre módulos (la composición queda aparte: es la raíz que los conecta).
  const entreModulos = aristas(u => (u.modulo === 'composicion' || u.modulo === 'otro') ? undefined : u.modulo);
  expect(ciclo(entreModulos, MODULOS_003)).toBeUndefined();                   // ningún ciclo pasa por solicitudes ni por cotizaciones
  expect(entreModulos.get('solicitudes')?.has('cotizaciones') ?? false).toBe(false);
  // Entre capas de cada módulo 003: dominio ← aplicación ← (infraestructura, presentación); `api-publica` solo mira hacia dentro. Se observa también el conjunto de aristas.
  for (const m of MODULOS_003) {
    const capas = aristas(u => u.modulo === m ? u.capa : undefined);
    expect(ciclo(capas)).toBeUndefined();
    expect([...(capas.get('dominio') ?? [])]).toEqual([]);                                 // el dominio no depende de ninguna otra capa
    expect([...(capas.get('aplicacion') ?? [])].filter(c => c !== 'dominio' && c !== 'api-publica')).toEqual([]);
    expect(capas.get('infraestructura')?.has('presentacion') ?? false).toBe(false);
    expect(capas.get('presentacion')?.has('infraestructura') ?? false).toBe(false);
  }
}, 60000);

test('PR12 el consumo entre módulos coincide con el aprobado: aristas observadas = aristas permitidas, y Cotizaciones llega a Solicitudes por un único archivo de puerto', () => {
  const grafo = real(); const observado = new Map<string, Set<string>>();
  for (const f of grafo.modules) {
    const de = ubicar(f.source);
    if (!MODULOS_003.includes(de.modulo)) continue;
    for (const d of f.dependencies) {
      const a = ubicar(d.resolved);
      if (d.couldNotResolve || paquete(d) || a.modulo === de.modulo || a.modulo === 'compartido' || a.modulo === 'composicion') continue;   // lo de composicion lo acota el evaluador (solo identidad-002)
      if (!observado.has(de.modulo)) observado.set(de.modulo, new Set());
      observado.get(de.modulo)!.add(a.modulo);
    }
  }
  for (const m of MODULOS_003) expect([...(observado.get(m) ?? [])].sort()).toEqual([...CONSUMO_APROBADO[m]!].sort());
  const archivos = grafo.modules.filter(f => ubicar(f.source).modulo === 'cotizaciones' && f.dependencies.some(d => ubicar(d.resolved).modulo === 'solicitudes')).map(f => f.source.replaceAll('\\', '/'));
  expect(archivos).toHaveLength(1);
  expect(archivos[0]).toMatch(PUERTO_DE_COTIZACIONES_A_SOLICITUDES);
}, 60000);

// ─── Sensibilidad: cada control detecta la infracción que dice detectar ───────────────────────────────────────────────
async function conArbolCruzado(archivos: Record<string, string>, comprobar: (g: Cruce) => void) {
  const base = resolve('test');
  const carpeta = await mkdtemp(resolve(base, 'arquitectura-003-'));
  try {
    for (const [archivo, contenido] of Object.entries(archivos)) {
      const destino = resolve(carpeta, archivo);
      await mkdir(resolve(destino, '..'), { recursive: true });
      await writeFile(destino, contenido);
    }
    comprobar(cruzar([relative(process.cwd(), carpeta).replaceAll(sep, '/')]));
  } finally {
    const ruta = await realpath(carpeta);
    const hijo = relative(await realpath(base), ruta);
    if (hijo.startsWith('arquitectura-003-') && !hijo.includes(sep) && !isAbsolute(hijo)) await rm(ruta, { recursive: true, force: true });
  }
}
const cita = (fallos: string[], texto: string) => fallos.some(f => f.includes(texto));

test('PR12 sensibilidad: el evaluador detecta dominio con infraestructura, framework, tipo importado o reexportación; aplicación con detalles; presentación con infraestructura; y consumo indebido', async () => {
  await conArbolCruzado({
    'modulos/solicitudes/dominio/a.ts': "import '../infraestructura/repo.js'; export const a = 1;",
    'modulos/solicitudes/dominio/b.ts': "import type { Repo } from '../infraestructura/repo.js'; export type Y = Repo;",
    'modulos/solicitudes/dominio/c.ts': "export * from '../infraestructura/repo.js';",
    'modulos/solicitudes/dominio/d.ts': "import '@nestjs/common'; export const d = 1;",
    'modulos/solicitudes/dominio/e.ts': "import 'node:fs'; export const e = 1;",
    'modulos/solicitudes/aplicacion/f.ts': "import 'typeorm'; export const f = 1;",
    'modulos/solicitudes/presentacion/g.ts': "import '../infraestructura/repo.js'; export const g = 1;",
    'modulos/solicitudes/infraestructura/repo.ts': "import '../presentacion/g.js'; export type Repo = number; export const repo = 1;",
    'modulos/cotizaciones/aplicacion/h.ts': "import '../../solicitudes/api-publica.js'; export const h = 1;",
    'modulos/cotizaciones/aplicacion/i.ts': "import '../../solicitudes/infraestructura/repo.js'; export const i = 1;",
    'modulos/solicitudes/aplicacion/j.ts': "import '../../cotizaciones/api-publica.js'; export const j = 1;",
    'modulos/solicitudes/api-publica.ts': 'export const publica = 1;',
    'modulos/cotizaciones/api-publica.ts': 'export const publica = 1;',
    'modulos/prestadores/aplicacion/k.ts': "import '../../solicitudes/aplicacion/j.js'; export const k = 1;",
    'modulos/solicitudes/raiz-suelta.ts': "import '../cotizaciones/dominio/z.js'; export const suelta = 1;",
    'modulos/cotizaciones/dominio/z.ts': 'export const z = 1;',
  }, (grafo) => {
    const fallos = evaluarArquitectura(grafo);
    for (const esperado of ['dominio no independiente: ', 'aplicación acoplada a un detalle: ', 'presentación con dependencia indebida', 'infraestructura con dependencia indebida', 'consumo no aprobado de un módulo 003'])
      expect([esperado, cita(fallos, esperado)]).toEqual([esperado, true]);
    // Cada archivo infractor aparece citado: el control no acierta por casualidad.
    for (const archivo of ['dominio/a.ts', 'dominio/b.ts', 'dominio/c.ts', 'dominio/d.ts', 'dominio/e.ts', 'aplicacion/f.ts', 'presentacion/g.ts', 'infraestructura/repo.ts', 'cotizaciones/aplicacion/i.ts', 'solicitudes/aplicacion/j.ts', 'prestadores/aplicacion/k.ts'])
      expect([archivo, cita(fallos, archivo)]).toEqual([archivo, true]);
    // `h.ts` importa la api-publica de Solicitudes, pero NO es el archivo de puerto aprobado: también se señala.
    expect(cita(fallos, 'cotizaciones/aplicacion/h.ts')).toBe(true);
  });
}, 60000);

test('PR12 sensibilidad: un ciclo entre Solicitudes y Cotizaciones y la importación dinámica de un interno ajeno se detectan', async () => {
  await conArbolCruzado({
    'modulos/solicitudes/api-publica.ts': "import '../cotizaciones/api-publica.js'; export const s = 1;",
    'modulos/cotizaciones/api-publica.ts': "import './aplicacion/c.js'; export const c = 1;",
    'modulos/cotizaciones/aplicacion/c.ts': "import '../../solicitudes/api-publica.js'; export const c = 1;",
    'modulos/cotizaciones/aplicacion/d.ts': "export const cargar = () => import('../../solicitudes/infraestructura/repo.js');",
    'modulos/solicitudes/infraestructura/repo.ts': 'export const repo = 1;',
  }, (grafo) => {
    expect(grafo.summary.violations.map(v => v.rule.name)).toEqual(expect.arrayContaining(['sin-ciclos', 'solicitudes-sin-cotizaciones']));
    expect(grafo.modules.flatMap(m => m.dependencies).some(d => d.dependencyTypes.includes('dynamic-import'))).toBe(true);
    expect(cita(evaluarArquitectura(grafo), 'consumo no aprobado de un módulo 003: ')).toBe(true);
  });
}, 60000);

test('PR12 sensibilidad: un árbol sintético CONFORME no produce falsos positivos', async () => {
  await conArbolCruzado({
    'modulos/solicitudes/dominio/solicitud.ts': "import '../../../compartido/dominio/errores.js'; export const solicitud = 1;",
    'modulos/solicitudes/aplicacion/publicar.ts': "import '../dominio/solicitud.js'; import '../../catalogo/api-publica.js'; import 'node:crypto'; export const publicar = 1;",
    'modulos/solicitudes/aplicacion/puertos/repo.ts': "import '../../dominio/solicitud.js'; export interface Repo { x: number }",
    'modulos/solicitudes/infraestructura/repo-pg.ts': "import '../aplicacion/puertos/repo.js'; import '../dominio/solicitud.js'; import 'typeorm'; export const repoPg = 1;",
    'modulos/solicitudes/presentacion/controlador.ts': "import '../aplicacion/publicar.js'; import '@nestjs/common'; import '../../../composicion/identidad-002.js'; export const controlador = 1;",
    'modulos/solicitudes/api-publica.ts': "import './aplicacion/publicar.js'; export const publica = 1;",
    'modulos/cotizaciones/aplicacion/puertos/solicitudes.ts': "export * from '../../../solicitudes/api-publica.js';",
    'modulos/catalogo/api-publica.ts': 'export const catalogo = 1;',
    'compartido/dominio/errores.ts': 'export const errores = 1;',
    'composicion/identidad-002.ts': 'export const identidad = 1;',
    'composicion/ensamblado.ts': "import '../modulos/solicitudes/infraestructura/repo-pg.js'; import '../modulos/cotizaciones/aplicacion/puertos/solicitudes.js'; export const ensamblado = 1;",
  }, (grafo) => {
    expect(evaluarArquitectura(grafo)).toEqual([]);
    expect(grafo.summary.violations.map(v => v.rule.name)).toEqual([]);
  });
}, 60000);
