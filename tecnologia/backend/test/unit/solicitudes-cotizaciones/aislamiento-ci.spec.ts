import { describe, expect, test } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// T023: la 001 no selecciona las suites de la 003 y la 002 solo selecciona las suyas. Se evalúan con las mismas expresiones regulares que usa Jest
// los filtros reales de los flujos de CI y de package.json, sobre los archivos de prueba reales del repositorio.
const raiz = resolve('../..');
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8').replaceAll('\r\n', '\n');
const grupos = ['unit', 'integration', 'contract', 'architecture'] as const;
const archivos = Object.fromEntries(grupos.map(g => [g, readdirSync(resolve('test', g), { recursive: true }).map(String).filter(f => f.endsWith('.spec.ts')).map(f => `test/${g}/${f.replaceAll('\\', '/')}`)])) as Record<typeof grupos[number], string[]>;
const todos = grupos.flatMap(g => archivos[g]);
const de003 = (f: string) => f.includes('/solicitudes-cotizaciones/') || /solicitudes-cotizaciones\.spec\.ts$/.test(f);
const de002 = (f: string) => f.includes('/prestadores-catalogo/') || /prestadores-catalogo\.spec\.ts$/.test(f);
const patrones = (texto: string) => texto.split('|').map(p => new RegExp(p));
const captura = (filtro: string, f: string) => patrones(filtro).some(r => r.test(f));

/** Extrae el valor de un indicador de Jest en una línea, con o sin comillas. */
function valor(linea: string, indicador: string): string | undefined {
  return new RegExp(`--${indicador} (?:"([^"]+)"|(\\S+))`).exec(linea)?.slice(1).find(Boolean);
}
const lineasDe = (texto: string, patron: RegExp) => texto.split('\n').filter(l => patron.test(l));

describe('el inventario de archivos de prueba', () => {
  test('hay suites de la 003 en las cuatro categorías que Jest ejecuta y también de la 002 y la 001', () => {
    for (const g of grupos) expect(archivos[g].some(de003)).toBe(true);
    expect(todos.some(de002)).toBe(true);
    expect(todos.filter(f => !de002(f) && !de003(f)).length).toBeGreaterThan(5);
  });
});

describe('flujo de la 001 (validar-001-ci.sh)', () => {
  const guion = leer('tecnologia/scripts/validar-001-ci.sh');
  const jest = lineasDe(guion, /^(?:JEST_JUNIT_OUTPUT_NAME=\S+ )?backend test:(unit|integration|contract|architecture)\b/);

  test('las cuatro categorías de Jest ignoran las suites de la 003', () => {
    expect(jest).toHaveLength(4);
    for (const linea of jest) {
      const grupo = /test:(\w+)/.exec(linea)![1] as typeof grupos[number];
      const filtro = valor(linea, 'testPathIgnorePatterns');
      expect(filtro).toBeDefined();
      for (const f of archivos[grupo].filter(de003)) expect(captura(filtro!, f)).toBe(true);
    }
  });
  test('lo que la 001 sigue seleccionando no incluye ninguna suite de la 003 y conserva las de la 001', () => {
    for (const linea of jest.filter(l => !/test:architecture/.test(l))) {
      const grupo = /test:(\w+)/.exec(linea)![1] as typeof grupos[number];
      const seleccionadas = archivos[grupo].filter(f => !captura(valor(linea, 'testPathIgnorePatterns')!, f));
      expect(seleccionadas.some(de003)).toBe(false);
      expect(seleccionadas.some(f => !de002(f) && !de003(f))).toBe(true);
    }
  });
  test('la 001 sigue ignorando las de la 002 (no se alteró su filtro)', () => {
    for (const linea of jest.filter(l => !/test:architecture/.test(l))) {
      const grupo = /test:(\w+)/.exec(linea)![1] as typeof grupos[number];
      for (const f of archivos[grupo].filter(de002)) expect(captura(valor(linea, 'testPathIgnorePatterns')!, f)).toBe(true);
    }
  });
  test('las pruebas unitarias del frontend excluyen la carpeta de la 003', () => {
    const linea = lineasDe(guion, /^frontend test:unit\b/)[0]!;
    expect(linea).toContain('--exclude "test/unit/solicitudes-cotizaciones/**"');
    expect(linea).toContain('--exclude "test/unit/prestadores-catalogo/**"');
  });
});

describe('flujo de la 002 (prestadores-catalogo.yml y package.json)', () => {
  const flujo = leer('.github/workflows/prestadores-catalogo.yml');
  const paquete = (JSON.parse(leer('tecnologia/backend/package.json')) as { scripts: Record<string, string> }).scripts;

  test('los filtros de contratos y de integración de la 002 solo seleccionan sus suites', () => {
    const contrato = lineasDe(flujo, /run test:contract -- --testPathPatterns prestadores-catalogo/);
    expect(contrato).toHaveLength(1);
    expect(archivos.contract.filter(f => captura('prestadores-catalogo', f)).every(de002)).toBe(true);
    for (const nombre of ['test:integration:002', 'test:integration:002:infra']) {
      const filtro = valor(paquete[nombre]!, 'testPathPatterns')!;
      expect(archivos.integration.filter(f => captura(filtro, f)).every(de002)).toBe(true);
      expect(archivos.integration.filter(f => captura(filtro, f)).length).toBeGreaterThan(0);
    }
  });
  test('las pruebas unitarias y de arquitectura de la 002 ignoran las de la 003', () => {
    for (const patron of [/run test:unit -- --testPathIgnorePatterns solicitudes-cotizaciones/, /run test:architecture -- --testPathIgnorePatterns solicitudes-cotizaciones/]) {
      expect(lineasDe(flujo, patron).filter(l => /\$EVIDENCIA_002\/(unitarias|arquitectura)"/.test(l))).toHaveLength(1);
    }
    for (const f of [...archivos.unit, ...archivos.architecture].filter(de003)) expect(captura('solicitudes-cotizaciones', f)).toBe(true);
  });
  test('las unitarias del frontend de la 002 excluyen la carpeta de la 003', () => {
    expect(flujo).toContain('run test:unit -- --exclude "test/unit/solicitudes-cotizaciones/**"');
  });
});

describe('flujo de la 003', () => {
  test('test:integration:003 solo selecciona suites de la 003', () => {
    const paquete = (JSON.parse(leer('tecnologia/backend/package.json')) as { scripts: Record<string, string> }).scripts;
    const filtro = valor(paquete['test:integration:003']!, 'testPathPatterns')!;
    const seleccionadas = archivos.integration.filter(f => captura(filtro, f));
    expect(seleccionadas.length).toBeGreaterThan(0);
    expect(seleccionadas.every(de003)).toBe(true);
  });
  test('el flujo de la 003 filtra sus suites por su carpeta', () => {
    const flujo = leer('.github/workflows/solicitudes-cotizaciones.yml');
    expect(flujo).toContain('--testPathPatterns solicitudes-cotizaciones');
  });
});
