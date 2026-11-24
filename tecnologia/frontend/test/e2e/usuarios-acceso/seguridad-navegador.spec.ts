import { randomUUID } from 'node:crypto';
import { test, expect } from '../../soporte/validacion.js';
import { redactarReporte } from '../../soporte/reportes-seguros.js';
import { cerrarMenu, conMenu, irA } from '../../soporte/menu-principal.js';

test('X-06 credenciales en memoria, cookie exacta y enlace retirado del historial y del referer', async ({page, context, correoApi, browserName, browser}, info) => {
  info.annotations.push({type: 'navegador', description: browserName + ' ' + browser.version()});
  const correo = randomUUID() + '@example.invalid', clave = ' frase ficticia seguridad ';
  const headers = {Origin: 'https://localhost:8443'};
  const alta = await page.request.post('/api/v1/cuentas', {headers: {...headers, 'Idempotency-Key': randomUUID()}, data: {correo, contrasena: clave, confirmacionContrasena: clave, nombreMostrar: 'Control ficticio', perfiles: ['cliente'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: '001-v1'}});
  expect(alta.status()).toBe(201);
  await page.goto('/acceso');
  await page.getByLabel('Correo', {exact: true}).fill(correo);
  await page.getByLabel('Contraseña', {exact: true}).fill(clave);
  const respuesta = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/sesiones' && r.request().method() === 'POST');
  await page.getByRole('button', {name: 'Iniciar sesión', exact: true}).click();
  const login = await respuesta;
  expect(login.status()).toBe(200);
  const setCookie = (await login.allHeaders())['set-cookie'] ?? '';
  expect(['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api/v1/sesiones'].every(flag => setCookie.includes(flag))).toBe(true);
  expect(setCookie.includes('Domain=')).toBe(false);
  const cookie = (await context.cookies()).find(c => c.name === '__Secure-renovacion');
  expect(Boolean(cookie?.httpOnly && cookie.secure)).toBe(true);
  await conMenu(page, page.getByRole('button', {name: 'Cerrar sesión'})); await cerrarMenu(page);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(await page.evaluate(() => document.cookie.includes('__Secure-renovacion'))).toBe(false);

  expect((await page.request.post('/api/v1/recuperaciones', {headers, data: {correo}})).status()).toBe(202);
  let enlace = '';
  await expect.poll(async () => {
    const lista = await (await page.request.get(correoApi + '/api/v1/messages')).json();
    const m = lista.messages.find((m: {Subject: string; To: {Address: string}[]}) => m.Subject === 'Recuperar acceso' && m.To.some(t => t.Address === correo));
    if (!m) return false;
    const d = await (await page.request.get(correoApi + '/api/v1/message/' + m.ID)).json();
    enlace = /https:\/\/localhost:8443\/recuperar#token=[A-Za-z0-9_-]{43}&version=1/.exec(d.Text)?.[0] ?? '';
    return Boolean(enlace);
  }, {timeout: 20000}).toBe(true);
  const token = new URLSearchParams(new URL(enlace).hash.slice(1)).get('token')!;
  let filtrado = false, externo = false;
  page.on('request', req => {
    filtrado ||= (req.headers().referer ?? '').includes(token);
    externo ||= new URL(req.url()).origin !== 'https://localhost:8443';
  });
  await page.evaluate(url => location.assign(url), enlace);
  await expect(page.getByLabel('Nueva contraseña', {exact: true})).toBeVisible();
  expect(new URL(page.url()).hash === '').toBe(true);
  const sonda = await page.evaluate(async () => (await fetch('/api/v1/salud')).status);
  expect(sonda).toBe(200);
  await irA(page, 'Acceder', { exact: true });
  await page.goBack();
  expect(new URL(page.url()).hash === '').toBe(true);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(filtrado).toBe(false);
  expect(externo).toBe(false);
  expect(redactarReporte('/api/v1/recuperaciones/' + token).includes(token)).toBe(false);
});
