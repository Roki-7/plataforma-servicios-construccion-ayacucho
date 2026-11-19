import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

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

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/prestadores-catalogo/**/*.spec.ts',
  forbidOnly: Boolean(process.env['CI']),
  outputDir: resolve(evidencia, 'playwright-results'),
  reporter: [
    ['list'],
    ['junit', { outputFile: resolve(evidencia, 'playwright-junit.xml') }],
  ],
  use: { baseURL: 'https://localhost:8444', ignoreHTTPSErrors: false, trace: 'off', screenshot: 'off', video: 'off' },
  metadata: { funcionalidad: '002', plataforma: process.platform, node: process.version },
});
