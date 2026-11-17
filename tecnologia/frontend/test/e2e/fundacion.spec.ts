import { test, expect } from '../soporte/validacion.js';

test('Fundación: aplicación base, salud técnica y confianza TLS', async ({ page, request, browser, browserName, correoApi }, info) => {
  info.annotations.push({ type: 'navegador', description: `${browserName} ${browser.version()}` });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Plataforma Ayacucho' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crear cuenta', exact: true })).toBeVisible();
  const salud = await request.get('/api/v1/salud');
  expect(salud.status()).toBe(200);
  expect(await salud.json()).toEqual({ estado: 'disponible' });
  expect((await request.get(correoApi + '/api/v1/messages')).status()).toBe(200);
  if (process.env['E2E_TLS_NEGATIVAS'] === 'true') {
    const control = await page.context().newPage();
    try {
      await expect(control.goto('https://localhost:9443', { waitUntil: 'commit' })).rejects.toThrow(/ERR_CERT_AUTHORITY_INVALID|SEC_ERROR_(UNKNOWN_ISSUER|CA_CERT_INVALID)|certificate|SSL peer/i);
      info.annotations.push({ type: 'tls', description: 'Origen confiable aceptado; certificado de control no confiable rechazado.' });
    } finally { await control.close(); }
  }
});
