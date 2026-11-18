import { readFile } from 'node:fs/promises';
import { leerJUnit, leerMatriz, leerNavegadores, verificarAsociaciones } from '../../scripts/verificar-cobertura-001.js';

test('T115 usa la matriz normativa y detecta una asociación ausente', async () => {
  const base = new URL('../../../../specs/001-usuarios-y-acceso/',import.meta.url);
  const [spec,tabla] = await Promise.all(['spec.md','test-matrix.md'].map(p=>readFile(new URL(p,base),'utf8')));
  const matriz = leerMatriz(spec!,tabla!);
  expect(matriz.size).toBe(53);
  expect([...matriz.values()].flat().length).toBe(152);
  const cubiertos: Parameters<typeof verificarAsociaciones>[1] = new Map();
  for(const [caso,ns] of matriz) for(const nivel of ns) {
    const conjunto = cubiertos.get(nivel)??new Set<string>();
    conjunto.add(caso);
    cubiertos.set(nivel,conjunto);
  }
  expect(()=>verificarAsociaciones(matriz,cubiertos)).not.toThrow();
  cubiertos.get('E')!.delete('CA-REG-01');
  expect(()=>verificarAsociaciones(matriz,cubiertos)).toThrow(/Casos sin evidencia aprobada/);
});

test.each(['<skipped/>','<failure/>','<error/>'])('T115 rechaza JUnit con resultado %s', resultado => {
  const xml = '<testsuites tests="1"><testsuite><testcase name="Caso">'+resultado+'</testcase></testsuite></testsuites>';
  expect(()=>leerJUnit(xml,'fixture')).toThrow();
});
test('T115 rechaza un JUnit vacío o truncado y extrae solo títulos de casos', () => {
  expect(()=>leerJUnit('<testsuites tests="1">','fixture')).toThrow();
  expect(()=>leerJUnit('<testsuites tests="0"></testsuites>','fixture')).toThrow();
  const xml = '<testsuites tests="1"><testsuite name="CA-REG-02"><testcase name="CA-REG-01" /></testsuite></testsuites>';
  expect(leerJUnit(xml,'fixture').cubiertos).toEqual(['CA-REG-01']);
});
test('T115 distingue la cobertura de escenarios de la matriz completa de CI y rechaza fallos', () => {
  const matriz: ReturnType<typeof leerMatriz> = new Map([['CA-REG-01', ['E']]]);
  const parcial = JSON.stringify({
    config: {metadata: {plataforma: 'linux'}},
    suites: [{ specs: [{ title: 'CA-REG-01 caso', tests: [{
      projectName: 'chromium-768', status: 'expected', expectedStatus: 'passed',
      results: [{status: 'passed', retry: 0}], annotations: [{type: 'navegador', description: 'chromium 123.0'}],
    }] }] }],
    stats: {expected: 1, unexpected: 0, skipped: 0, flaky: 0},
  });
  expect(leerNavegadores(parcial, 'fixture', matriz)).toMatchObject({total: 1, cubiertos: ['CA-REG-01'], proyectos: ['chromium-768']});
  expect(() => leerNavegadores(parcial, 'fixture', matriz, true)).toThrow(/Proyectos requeridos/);
  expect(() => leerNavegadores(parcial.replace('"unexpected":0','"unexpected":1'), 'fixture', matriz)).toThrow(/Playwright unexpected/);
  expect(() => leerNavegadores(parcial.replace('chromium 123.0', ''), 'fixture', matriz)).toThrow(/Falta versión/);
});
