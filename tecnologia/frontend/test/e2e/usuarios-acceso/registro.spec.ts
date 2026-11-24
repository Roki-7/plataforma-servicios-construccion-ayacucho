import { randomUUID } from 'node:crypto';
import { test, expect } from '../../soporte/validacion.js';
import { verificarVisibilidadContrasenas } from '../../soporte/visibilidad-contrasena.js';
import { conMenu, irA } from '../../soporte/menu-principal.js';
test.setTimeout(60000);
test('CA-REG-01 CA-REG-04 CA-REG-08 CA-REG-10 registro real, opcionales y tres selecciones', async ({ page, browser, browserName }, info) => {
  info.annotations.push({ type: 'navegador', description: `${browserName} ${browser.version()}` });
  for (const seleccion of ['cliente', 'prestador', 'ambos']) {
    await page.goto('/registro'); await page.getByLabel('Nombre para mostrar').fill('Empresa ficticia'); await page.getByLabel('Correo', { exact: true }).fill(`${randomUUID()}@example.invalid`);
    const p = ' ' + '𠮷'.repeat(90) + ' '; await page.getByLabel('Contraseña', { exact: true }).fill(p); await page.getByLabel('Confirmar contraseña', { exact: true }).fill(p); await page.getByLabel('¿Cómo usarás la plataforma?').selectOption(seleccion); await page.getByLabel(/Acepto la política/).check();
    if (seleccion === 'ambos') { await page.getByLabel('Teléfono (opcional)').fill('+51 libre'); await page.getByLabel('Distrito (opcional)').fill('Distrito de cuenta'); await page.getByLabel('Fotografía (opcional)').setInputFiles({ name: 'prueba.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=', 'base64') }); }
    const respuesta = page.waitForResponse((r) => r.url().endsWith('/api/v1/cuentas') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Crear cuenta' }).click(); const r = await respuesta; expect(r.status()).toBe(201); const dato = await r.json(); expect(dato.perfiles).toEqual(seleccion === 'ambos' ? ['cliente', 'prestador'] : [seleccion]); expect(await r.headerValue('set-cookie')).toBeNull(); await expect(page.getByRole('status')).toContainText('Tu cuenta se creó correctamente'); expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
test('CA-REG-06 CA-SES-01 incorporación con login real, identidad preservada', async ({ page }) => {
  const correo = `${randomUUID()}@example.invalid`; const contrasena = ' clave completa de prueba ';
  let altas = 0;
  let accesos = 0;
  page.on('request', r => {
    if (r.method() !== 'POST') return;
    if (r.url().endsWith('/api/v1/cuentas')) altas++;
    if (r.url().endsWith('/api/v1/sesiones')) accesos++;
  });
  await page.goto('/registro');
  const entradaCorreo = page.getByLabel('Correo', { exact: true });
  await page.getByLabel('Nombre para mostrar').fill('Empresa ficticia');
  await entradaCorreo.fill('cliente01');
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(contrasena);
  await page.getByLabel('¿Cómo usarás la plataforma?').selectOption('cliente');
  await page.getByLabel(/Acepto la política/).check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(entradaCorreo).toHaveAttribute('aria-invalid', 'true');
  await expect(entradaCorreo).toHaveAccessibleDescription('Ingrese un correo válido.');
  expect(altas).toBe(0);
  await entradaCorreo.fill(correo);
  await verificarVisibilidadContrasenas(page, ['Contraseña', 'Confirmar contraseña']);
  expect(altas).toBe(0);
  const alta = page.waitForResponse((r) => r.url().endsWith('/api/v1/cuentas'));
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  const creada = await (await alta).json();
  await expect(page.getByRole('status')).toHaveText('Tu cuenta se creó correctamente');
  expect(accesos).toBe(0);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(entradaCorreo).toHaveValue(correo);
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeEmpty();
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  await verificarVisibilidadContrasenas(page, ['Contraseña']);
  expect(accesos).toBe(0);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await conMenu(page, nav.getByRole('link', { name: 'Mi cuenta', exact: true }));
  await expect(nav.getByRole('link', { name: 'Mi cuenta', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Acceder', exact: true })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  await irA(page, 'Mis perfiles'); await page.getByLabel(/Confirmo que deseo añadir/).check(); const respuesta = page.waitForResponse((r) => r.url().endsWith('/api/v1/perfil/perfiles')); await page.getByRole('button', { name: 'Añadir prestador' }).click(); const r = await respuesta; expect(r.status()).toBe(200); expect(await r.json()).toMatchObject({ cuentaId: creada.cuentaId, correo, perfiles: ['cliente', 'prestador'], version: 2 }); await expect(page.getByText('Perfil habilitado. Se conservan su cuenta y sus datos.')).toBeVisible();
});
