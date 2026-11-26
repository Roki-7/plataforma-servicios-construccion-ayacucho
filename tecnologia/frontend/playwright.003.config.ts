import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { anchos003, navegadores003, origen003 } from './scripts/independencia-003.mjs';

// El contexto automático de fallos puede copiar valores de campos privados.
process.env['PLAYWRIGHT_NO_COPY_PROMPT'] = '1';

const local = resolve(dirname(fileURLToPath(import.meta.url)), '../.local');
const raizEvidencia = resolve(local, 'evidencia/003');
const evidencia = resolve(process.env['E2E_EVIDENCIA'] ?? raizEvidencia);
const desplazamiento = relative(raizEvidencia, evidencia);
if (isAbsolute(desplazamiento) || desplazamiento === '..' || desplazamiento.startsWith(`..${sep}`)) {
  throw new Error('Playwright 003 requiere un destino de evidencia dedicado.');
}
for (let ruta = evidencia; relative(local, ruta) !== ''; ruta = dirname(ruta)) {
  if (existsSync(ruta) && relative(realpathSync(local), realpathSync(ruta)) !== relative(local, ruta)) {
    throw new Error('Playwright 003 requiere un destino de evidencia sin redirecciones.');
  }
}

// Origen HTTPS de la 003 (proxy Caddy `8447`). Las pruebas nunca usan `ignoreHTTPSErrors`: la CA 003 debe ser de confianza del navegador.
// Ejecutor de la matriz PR07: tres navegadores por tres anchos (360, 768 y 1366 px). Las suites viven en `test/e2e/solicitudes-cotizaciones/`.
// El reporte con trazabilidad por criterio y el `globalSetup` de la 003 se añaden con las pruebas de extremo a extremo (tareas de la Fase 9).
const dispositivo = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' } as const;

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/solicitudes-cotizaciones/**/*.spec.ts',
  // La infraestructura 003 es compartida entre las series y dependen del estado: una sola trabajadora y sin reintentos.
  fullyParallel: false, workers: 1, retries: 0, timeout: 60000,
  expect: { timeout: 20_000 },
  forbidOnly: Boolean(process.env['CI']),
  outputDir: resolve(evidencia, 'playwright-results'),
  reporter: [
    ['list'],
    ['junit', { outputFile: resolve(evidencia, 'playwright-junit.xml') }],
    ['json', { outputFile: resolve(evidencia, 'playwright.json') }],
  ],
  // La traza se conserva solo si una prueba falla; los datos son ficticios y quedan en tecnologia/.local (ignorado por Git, nunca publicado).
  use: { baseURL: origen003, ignoreHTTPSErrors: false, trace: 'retain-on-failure', screenshot: 'off', video: 'off' },
  projects: navegadores003.flatMap((navegador) => anchos003.map((ancho) => ({
    name: `${navegador}-${ancho}`,
    use: {
      ...devices[dispositivo[navegador]], viewport: { width: ancho, height: 900 },
      ...(navegador === 'firefox' ? { launchOptions: { firefoxUserPrefs: { 'security.enterprise_roots.enabled': true } } } : {}),
    },
  }))),
  metadata: { funcionalidad: '003', plataforma: process.platform, node: process.version, origen: origen003 },
});
