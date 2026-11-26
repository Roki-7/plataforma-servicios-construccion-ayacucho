import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { anchos003, identidad003Esperada, navegadores003, origen003, validarIndependencia003 } from '../../../scripts/independencia-003.mjs';
import { anchos002, navegadores002 } from '../../../scripts/independencia-002.mjs';

// Importar @playwright/test y evaluar la configuración es lento en frío; con la suite completa en paralelo supera el límite por defecto de 5 s.
const LIMITE_IMPORTACION = 30_000;
const local = resolve(__dirname, '../../../../.local');
const evidencia003 = resolve(local, 'evidencia/003');

async function cargarConfig() {
  vi.resetModules();
  return (await import('../../../playwright.003.config')).default;
}

describe('Ejecutor de navegador de la 003 (T006)', () => {
  const entorno = process.env['E2E_EVIDENCIA'];
  afterEach(() => { if (entorno === undefined) delete process.env['E2E_EVIDENCIA']; else process.env['E2E_EVIDENCIA'] = entorno; });

  it('la matriz son tres navegadores por tres anchos, igual que la de la 002', () => {
    expect([...navegadores003]).toEqual(['chromium', 'firefox', 'webkit']);
    expect([...anchos003]).toEqual([360, 768, 1366]);
    expect([...navegadores003]).toEqual([...navegadores002]);
    expect([...anchos003]).toEqual([...anchos002]);
  });

  it('la identidad de la 003 no coincide con la de 001 ni 002 ni con los puertos reservados', () => {
    expect(validarIndependencia003()).toEqual({ ok: true, problemas: [] });
  });

  it('la identidad coincide con tecnologia/backend/scripts/entorno-003.ts', () => {
    const texto = readFileSync(resolve(__dirname, '../../../../backend/scripts/entorno-003.ts'), 'utf8');
    const puertos = /puertos003 = \{([^}]*)\}/.exec(texto)?.[1] ?? '';
    const valor = (nombre: string) => Number(new RegExp(`${nombre}: (\\d+)`).exec(puertos)?.[1]);
    expect(valor('api')).toBe(identidad003Esperada.puertoApi);
    expect(valor('web')).toBe(identidad003Esperada.puertoWeb);
    expect(valor('postgres')).toBe(identidad003Esperada.puertoBaseDatos);
    expect(valor('redis')).toBe(identidad003Esperada.puertoRedis);
    expect(valor('smtp')).toBe(identidad003Esperada.puertoSmtp);
    expect(valor('correo')).toBe(identidad003Esperada.puertoCorreoWeb);
    expect(valor('objetos')).toBe(identidad003Esperada.puertoObjetos);
    expect(texto).toContain(`export const origen003 = '${origen003}'`);
    expect(texto).toContain(`export const proyecto003 = '${identidad003Esperada.proyectoCompose}'`);
    expect(texto).toContain(`export const base003 = '${identidad003Esperada.baseDatos}'`);
    expect(texto).toContain(`S3_BUCKET: '${identidad003Esperada.bucket}'`);
    expect(texto).toContain(`REDIS_NAMESPACE: '${identidad003Esperada.espacioRedis}'`);
  });

  it('la configuración define nueve proyectos con su navegador y su ancho', async () => {
    const config = await cargarConfig();
    const nombres = (config.projects ?? []).map((p) => p.name);
    expect(nombres).toEqual(navegadores003.flatMap((n) => anchos003.map((a) => `${n}-${a}`)));
    expect(nombres).toHaveLength(9);
    const anchosProyectos = (config.projects ?? []).map((p) => p.use?.viewport?.width);
    expect(anchosProyectos).toEqual(navegadores003.flatMap(() => [...anchos003]));
  }, LIMITE_IMPORTACION);

  it('usa el origen HTTPS de la 003, nunca ignora errores de certificado y solo ejecuta las suites de la 003', async () => {
    const config = await cargarConfig();
    expect(config.use?.baseURL).toBe(origen003);
    expect(config.use?.ignoreHTTPSErrors).toBe(false);
    expect(config.testMatch).toBe('**/solicitudes-cotizaciones/**/*.spec.ts');
    expect(config.workers).toBe(1);
    expect(config.retries).toBe(0);
    expect(config.metadata?.['funcionalidad']).toBe('003');
  }, LIMITE_IMPORTACION);

  it('deposita la evidencia en tecnologia/.local/evidencia/003', async () => {
    delete process.env['E2E_EVIDENCIA'];
    const config = await cargarConfig();
    expect(config.outputDir).toBe(resolve(evidencia003, 'playwright-results'));
    const reporteros = JSON.stringify(config.reporter);
    expect(reporteros).toContain(resolve(evidencia003, 'playwright-junit.xml').replaceAll('\\', '\\\\'));
    expect(reporteros).toContain(resolve(evidencia003, 'playwright.json').replaceAll('\\', '\\\\'));
  }, LIMITE_IMPORTACION);

  it('acepta un subdirectorio de evidencia 003 y rechaza cualquier destino fuera de él', async () => {
    process.env['E2E_EVIDENCIA'] = resolve(evidencia003, 'ci/e2e');
    expect((await cargarConfig()).outputDir).toBe(resolve(evidencia003, 'ci/e2e/playwright-results'));
    for (const fuera of [resolve(local, 'evidencia/002'), resolve(local, 'evidencia/001'), resolve(local, 'evidencia'), resolve(local, 'evidencia/003/..'), resolve(local, '..')]) {
      process.env['E2E_EVIDENCIA'] = fuera;
      await expect(cargarConfig()).rejects.toThrow('destino de evidencia dedicado');
    }
  }, LIMITE_IMPORTACION);
});
