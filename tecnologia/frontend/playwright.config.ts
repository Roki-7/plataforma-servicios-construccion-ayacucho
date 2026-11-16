import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const evidencia = resolve(process.env['E2E_EVIDENCIA'] ?? '../.local/evidencia/001');
export default defineConfig({
  testDir: './test/e2e', fullyParallel: true, forbidOnly: Boolean(process.env['CI']), retries: 0,
  outputDir: resolve(evidencia, 'playwright-results'),
  reporter: [['list'], ['html', { outputFolder: resolve(evidencia, 'playwright'), open: 'never' }], ['json', { outputFile: resolve(evidencia, 'playwright.json') }], ['junit', { outputFile: resolve(evidencia, 'playwright-junit.xml') }]],
  use: { baseURL: 'https://localhost:8443', ignoreHTTPSErrors: false, trace: 'off', screenshot: 'off', video: 'off' },
  projects: ['chromium', 'firefox', 'webkit'].flatMap((browserName) => [360, 768, 1366].map((width) => ({
    name: `${browserName}-${width}`, use: { ...devices[browserName === 'chromium' ? 'Desktop Chrome' : browserName === 'firefox' ? 'Desktop Firefox' : 'Desktop Safari'], viewport: { width, height: 900 }, ...(browserName === 'firefox' ? { launchOptions: { firefoxUserPrefs: { 'security.enterprise_roots.enabled': true } } } : {}) },
  }))),
  ...(process.env['E2E_EXTERNAL_WEB'] === 'true' ? {} : { webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env['CI'] } }),
  metadata: { funcionalidad: '001', alcance: 'Preparación y fundación; sin historias', plataforma: process.platform, node: process.version, caCert: process.env['NODE_EXTRA_CA_CERTS'] ?? resolve('../.local/tls/ca.crt') },
});
