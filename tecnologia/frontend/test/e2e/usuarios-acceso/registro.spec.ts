import { randomUUID } from 'node:crypto';
import { test, expect } from '../../soporte/validacion.js';
test.setTimeout(60000);
test('CA-REG-01 CA-REG-04 CA-REG-08 CA-REG-10 registro real, opcionales y tres selecciones', async ({ page, browser, browserName }, info) => {
  info.annotations.push({ type: 'navegador', description: `${browserName} ${browser.version()}` });
  for (const seleccion of ['cliente', 'prestador', 'ambos']) {
    await page.goto('/registro'); await page.getByLabel('Nombre para mostrar').fill('Empresa ficticia'); await page.getByLabel('Correo', { exact: true }).fill(`${randomUUID()}@example.invalid`);
    const p = ' ' + '𠮷'.repeat(90) + ' '; await page.getByLabel('Contraseña', { exact: true }).fill(p); await page.getByLabel('Confirmar contraseña').fill(p); await page.getByLabel('Perfil de la cuenta').selectOption(seleccion); await page.getByLabel(/Acepto la política/).check();
    if (seleccion === 'ambos') { await page.getByLabel('Teléfono (opcional)').fill('+51 libre'); await page.getByLabel('Distrito (opcional)').fill('Distrito de cuenta'); await page.getByLabel('Fotografía (opcional)').setInputFiles({ name: 'prueba.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=', 'base64') }); }
    const respuesta = page.waitForResponse((r) => r.url().endsWith('/api/v1/cuentas') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Crear cuenta' }).click(); const r = await respuesta; expect(r.status()).toBe(201); const dato = await r.json(); expect(dato.perfiles).toEqual(seleccion === 'ambos' ? ['cliente', 'prestador'] : [seleccion]); expect(await r.headerValue('set-cookie')).toBeNull(); await expect(page.getByRole('status')).toContainText('Cuenta creada'); expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
test('CA-REG-06 fixture en memoria por composición de validación, identidad preservada', async ({ page }, info) => {
  // El helper Node siembra una cuenta y entrega acceso solo a esta página; no es login.
  const { crearFixtureRegistro } = await import('../../soporte/fixture-registro.js'); const fixture = await crearFixtureRegistro(info.project.name);
  try {
    await page.route('**/__validacion__/sesion.js*', (ruta) => ruta.fulfill({ contentType: 'application/javascript', body: `export default ${JSON.stringify({ token: fixture.acceso, perfil: fixture.perfil })}` }));
    await page.goto('/habilitar-perfil'); await expect(page.getByText('Sesión ficticia de validación; no constituye inicio de sesión.')).toBeVisible(); await page.getByLabel(/Confirmo que deseo añadir/).check(); const respuesta = page.waitForResponse((r) => r.url().endsWith('/api/v1/perfil/perfiles')); await page.getByRole('button', { name: 'Añadir prestador' }).click(); const r = await respuesta; expect(r.status()).toBe(200); expect(await r.json()).toMatchObject({ cuentaId: fixture.perfil.cuentaId, correo: fixture.perfil.correo, perfiles: ['cliente', 'prestador'], version: 2 }); await expect(page.getByRole('status')).toContainText('Perfil habilitado');
  } finally { await fixture.cerrar(); }
});
