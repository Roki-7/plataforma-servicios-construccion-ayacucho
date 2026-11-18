import { randomUUID } from 'node:crypto';
import { test, expect } from '../../soporte/validacion.js';
test.setTimeout(60000);
test('CA-SES-01 CA-SES-06 CA-SES-07 CA-SES-09 login real, bootstrap, renovación y cierre', async ({ page, context, browser, browserName }, info) => {
  info.annotations.push({ type: 'navegador', description: `${browserName} ${browser.version()}` });
  const correo = `${randomUUID()}@example.invalid`; const contrasena = ' clave completa de prueba ';
  const alta = await page.request.post('/api/v1/cuentas', { headers: { Origin: 'https://localhost:8443', 'Idempotency-Key': randomUUID() }, data: { nombreMostrar: 'Cuenta ficticia E US2', correo, contrasena, confirmacionContrasena: contrasena, perfiles: ['cliente', 'prestador'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: '001-v1' } }); expect(alta.status()).toBe(201);
  await page.goto('/acceso'); await page.getByLabel('Correo', { exact: true }).fill(correo.toUpperCase()); await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  const login = page.waitForResponse((r) => r.url().endsWith('/api/v1/sesiones') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click(); const r = await login; expect(r.status()).toBe(200); const anterior = await r.json(); await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  const cookie = (await context.cookies()).find((c) => c.name === '__Secure-renovacion'); expect(cookie).toMatchObject({ httpOnly: true, secure: true, path: '/api/v1/sesiones' });
  const cabecera = await r.headerValue('set-cookie'); expect(/(?:^|;)\s*SameSite=Lax(?:;|$)/.test(cabecera ?? '')).toBe(true); expect(/(?:^|;)\s*Domain=/i.test(cabecera ?? '')).toBe(false);
  // Playwright 1.65.1 CO-007/CO-009 documenta que el inspector WK Windows
  // devuelve None aun con Lax explícito. La cabecera de negocio sigue exigiendo Lax.
  // https://github.com/microsoft/playwright/blob/v1.65.1/tests/library/browsercontext-cookies.spec.ts#L121-L132
  if (process.platform === 'win32' && browserName === 'webkit') { expect(cookie?.sameSite).toBe('None'); info.annotations.push({ type: 'limitacion-plataforma', description: 'WebKit Windows: inspector SameSite=None; Set-Cookie SameSite=Lax verificado. CO-007/CO-009 de Playwright 1.65.1.' }); }
  else expect(cookie?.sameSite).toBe('Lax');
  expect(await page.evaluate(() => document.cookie.includes('__Secure-renovacion'))).toBe(false);
  const rotacion = page.waitForResponse((r) => r.url().endsWith('/api/v1/sesiones/renovacion')); await page.reload(); const refrescada = await rotacion; expect(refrescada.status()).toBe(200); const actual = await refrescada.json(); expect(actual.renovacionVenceEn).toBe(anterior.renovacionVenceEn); expect(actual.autenticacionConContrasenaEn).toBe(anterior.autenticacionConContrasenaEn); expect(actual.tokenAcceso === anterior.tokenAcceso).toBe(false);
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible(); await page.getByRole('button', { name: 'Cerrar sesión' }).click(); await expect(page.getByRole('status')).toContainText('Sesión cerrada'); await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue(''); await page.waitForTimeout(1800); await page.getByRole('button', { name: /Mostrar el valor de «Contraseña»/ }).click(); await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue(''); expect(await page.evaluate((clave) => document.documentElement.outerHTML.includes(clave), contrasena)).toBe(false); expect((await context.cookies()).some((c) => c.name === '__Secure-renovacion')).toBe(false);
  const privado = await page.request.post('/api/v1/perfil/perfiles', { headers: { Origin: 'https://localhost:8443', Authorization: `Bearer ${actual.tokenAcceso}`, 'Idempotency-Key': randomUUID() }, data: { perfil: 'cliente', version: 1, confirmacionExplicita: true } }); expect(privado.status()).toBe(401);
  const viejo = await page.request.post('/api/v1/sesiones/renovacion', { headers: { Origin: 'https://localhost:8443', Cookie: `__Secure-renovacion=${cookie!.value}`, 'X-CSRF-Token': anterior.csrfToken } }); expect(viejo.status()).toBe(401);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible(); expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
