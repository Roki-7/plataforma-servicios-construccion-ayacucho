import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { anchos002, navegadores002, origen002 } from './scripts/independencia-002.mjs';

// El contexto automático de fallos puede copiar valores de campos privados.
process.env['PLAYWRIGHT_NO_COPY_PROMPT'] = '1';

const local = resolve(dirname(fileURLToPath(import.meta.url)), '../.local');
const raizEvidencia = resolve(local, 'evidencia/002');
const evidencia = resolve(process.env['E2E_EVIDENCIA'] ?? raizEvidencia);
const desplazamiento = relative(raizEvidencia, evidencia);
if (isAbsolute(desplazamiento) || desplazamiento === '..' || desplazamiento.startsWith(`..${sep}`)) {
  throw new Error('Playwright 002 requiere un destino de evidencia dedicado.');
}
for (let ruta = evidencia; relative(local, ruta) !== ''; ruta = dirname(ruta)) {
  if (existsSync(ruta) && relative(realpathSync(local), realpathSync(ruta)) !== relative(local, ruta)) {
    throw new Error('Playwright 002 requiere un destino de evidencia sin redirecciones.');
  }
}

// Origen HTTPS de la 002 (proxy Caddy `8444`). Las pruebas nunca usan `ignoreHTTPSErrors`: la CA 002 debe ser de confianza del navegador.
const dispositivo = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' } as const;

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/prestadores-catalogo/**/*.spec.ts',
  globalSetup: './test/e2e/prestadores-catalogo/global-setup.ts',
  // La infraestructura 002 es compartida y las series T076 a T079 dependen del estado: una sola trabajadora y sin reintentos.
  fullyParallel: false, workers: 1, retries: 0, timeout: 60000,
  forbidOnly: Boolean(process.env['CI']),
  outputDir: resolve(evidencia, 'playwright-results'),
  reporter: [
    ['list'],
    ['junit', { outputFile: resolve(evidencia, 'playwright-junit.xml') }],
    ['json', { outputFile: resolve(evidencia, 'playwright.json') }],
    ['./test/soporte/reporte-002.ts', { evidencia }],
  ],
  // La traza se conserva solo si una prueba falla; los datos son ficticios y quedan en tecnologia/.local (ignorado por Git, nunca publicado).
  use: { baseURL: origen002, ignoreHTTPSErrors: false, trace: 'retain-on-failure', screenshot: 'off', video: 'off' },
  projects: navegadores002.flatMap((navegador) => anchos002.map((ancho) => ({
    name: `${navegador}-${ancho}`,
    use: {
      ...devices[dispositivo[navegador]], viewport: { width: ancho, height: 900 },
      ...(navegador === 'firefox' ? { launchOptions: { firefoxUserPrefs: { 'security.enterprise_roots.enabled': true } } } : {}),
    },
  }))),
  metadata: { funcionalidad: '002', plataforma: process.platform, node: process.version, origen: origen002 },
});
