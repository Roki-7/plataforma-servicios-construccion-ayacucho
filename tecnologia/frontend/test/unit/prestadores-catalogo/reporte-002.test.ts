import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FullResult, TestCase, TestResult } from '@playwright/test/reporter';
import { afterEach, describe, expect, test } from 'vitest';
import Reporte002 from '../../soporte/reporte-002.js';

/**
 * T076 · El reporte 002 vincula cada prueba con los criterios que declara y conserva por proyecto los hechos que adjunta. Se comprueba con resultados simulados
 * de Playwright (no se importa el ejecutor): la carpeta de salida es un directorio temporal del sistema, nunca la evidencia de 001 ni la de 002.
 */
const carpetas: string[] = [];
afterEach(() => { for (const c of carpetas.splice(0)) rmSync(c, { recursive: true, force: true }); });

const dispositivo = (proyecto: string) => ({ name: 'dispositivo.json', contentType: 'application/json', body: Buffer.from(JSON.stringify({
  proyecto, navegador: proyecto.split('-')[0], versionNavegador: '1.0', dispositivo: 'Desktop X', anchoViewport: Number(proyecto.split('-')[1]), altoViewport: 900, plataformaEjecutor: 'linux', node: 'v24', origen: 'https://localhost:8444', ejecucion: 'e1', entorno: { aislamiento: 'efimero' },
})) });
const prueba = (proyecto: string, titulo: string, criterios: string[]) => ({ title: titulo, annotations: criterios.map((description) => ({ type: 'criterio', description })), parent: { project: () => ({ name: proyecto }) } }) as unknown as TestCase;
const resultado = (status: TestResult['status'], adjuntos: object[] = []) => ({ status, attachments: adjuntos }) as unknown as TestResult;
const evidencia = (nombre: string, datos: object) => ({ name: nombre, contentType: 'application/json', body: Buffer.from(JSON.stringify(datos)) });

describe('T076 · reporte 002: criterios y evidencias por proyecto', () => {
  function ejecutar(casos: { proyecto: string; titulo: string; criterios: string[]; estado: TestResult['status']; adjuntos?: object[] }[]) {
    const carpeta = mkdtempSync(join(tmpdir(), 'reporte-002-')); carpetas.push(carpeta);
    const r = new Reporte002({ evidencia: carpeta });
    for (const c of casos) r.onTestEnd(prueba(c.proyecto, c.titulo, c.criterios), resultado(c.estado, [dispositivo(c.proyecto), ...(c.adjuntos ?? [])]));
    r.onEnd({ status: 'passed' } as FullResult);
    return carpeta;
  }
  const leer = (carpeta: string, archivo: string) => JSON.parse(readFileSync(join(carpeta, archivo), 'utf8')) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  test('enlaza cada criterio con las pruebas y proyectos que lo demuestran', () => {
    const c = ejecutar([
      { proyecto: 'chromium-360', titulo: 'CA-PRE-01 y CA-PRE-02', criterios: ['CA-PRE-01', 'CA-PRE-02'], estado: 'passed' },
      { proyecto: 'firefox-768', titulo: 'CA-PRE-01 y CA-PRE-02', criterios: ['CA-PRE-01', 'CA-PRE-02'], estado: 'passed' },
      { proyecto: 'chromium-360', titulo: 'CA-PRE-03', criterios: ['CA-PRE-03'], estado: 'passed' },
      { proyecto: 'firefox-768', titulo: 'CA-PRE-03', criterios: ['CA-PRE-03'], estado: 'failed' },
    ]);
    const t = leer(c, 'trazabilidad-criterios-002.json').criterios;
    expect(Object.keys(t)).toEqual(['CA-PRE-01', 'CA-PRE-02', 'CA-PRE-03']);
    expect(t['CA-PRE-01']).toMatchObject({ aprobado: true, proyectos: { 'chromium-360': 'passed', 'firefox-768': 'passed' } });
    expect(t['CA-PRE-03']).toMatchObject({ aprobado: false, proyectos: { 'chromium-360': 'passed', 'firefox-768': 'failed' } });
    expect(t['CA-PRE-03'].pruebas).toHaveLength(2);
  });

  test('conserva los hechos adjuntos por proyecto, sin credenciales', () => {
    const c = ejecutar([
      { proyecto: 'webkit-360', titulo: 'CA-PRE-06', criterios: ['CA-PRE-06'], estado: 'passed', adjuntos: [evidencia('evidencia-ca-pre-06.json', { altaPendiente: { http: 404 }, nota: 'Bearer ' + 'A'.repeat(43) })] },
      { proyecto: 'webkit-360', titulo: 'otra', criterios: [], estado: 'passed', adjuntos: [{ name: 'trace.zip', contentType: 'application/zip', body: Buffer.from('x') }, evidencia('../escape.json', { x: 1 })] },
    ]);
    expect(leer(c, 'hu03/webkit-360/evidencia-ca-pre-06.json').altaPendiente).toEqual({ http: 404 });
    expect(readFileSync(join(c, 'hu03/webkit-360/evidencia-ca-pre-06.json'), 'utf8')).not.toContain('A'.repeat(43));
    // Solo se escriben adjuntos `evidencia-<nombre>.json`: ni otros tipos ni nombres con rutas.
    expect(existsSync(join(c, 'hu03/webkit-360/trace.zip'))).toBe(false); expect(existsSync(join(c, 'hu03/escape.json'))).toBe(false); expect(existsSync(join(c, 'escape.json'))).toBe(false);
  });

  test('sin criterios declarados no se genera el archivo de trazabilidad y el resumen por proyecto conserva dispositivo y ancho', () => {
    const c = ejecutar([{ proyecto: 'chromium-1366', titulo: 'entorno', criterios: [], estado: 'passed' }]);
    expect(existsSync(join(c, 'trazabilidad-criterios-002.json'))).toBe(false);
    expect(leer(c, 'ejecucion-002.json').proyectos).toEqual([expect.objectContaining({ proyecto: 'chromium-1366', anchoViewport: 1366, pruebas: 1, aprobadas: 1 })]);
  });
});
