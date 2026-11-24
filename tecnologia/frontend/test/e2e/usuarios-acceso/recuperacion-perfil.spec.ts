import { randomUUID } from 'node:crypto';
import { test, expect } from '../../soporte/validacion.js';
import { verificarVisibilidadContrasenas } from '../../soporte/visibilidad-contrasena.js';
import { cerrarMenu, conMenu } from '../../soporte/menu-principal.js';

test('CA-REC-08 CA-PER-02 CA-AUT-01 se conserva el perfil editado y solo la sesión nueva puede continuar', async ({page, request, correoApi, browserName, browser}, info) => {
  info.annotations.push({type: 'navegador', description: browserName + ' ' + browser.version()});
  const correo = randomUUID() + '@example.invalid';
  const anterior = ' frase ficticia de perfil ';
  const nueva = ' recuperación ficticia de perfil ';
  const origen = {Origin: 'https://localhost:8443'};
  const alta = await request.post('/api/v1/cuentas', {
    headers: {...origen, 'Idempotency-Key': randomUUID()},
    data: {correo, contrasena: anterior, confirmacionContrasena: anterior, nombreMostrar: 'Titular ficticio', perfiles: ['cliente'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: '001-v1'},
  });
  expect(alta.status()).toBe(201);
  const login = async (contrasena: string) => {
    const r = await request.post('/api/v1/sesiones', {headers: origen, data: {correo, contrasena}});
    expect(r.status()).toBe(200);
    return {Authorization: 'Bearer ' + (await r.json()).tokenAcceso};
  };
  const sesion = await login(anterior);
  const otra = await login(anterior);
  const editar = (headers: typeof sesion, data: object) => request.patch('/api/v1/perfil', {
    headers: {...headers, ...origen, 'Idempotency-Key': randomUUID()}, data,
  });
  const datos = {nombreMostrar: 'Perfil editado', telefono: '123', distrito: 'Ayacucho'};
  const guardado = await editar(sesion, {version: 1, ...datos});
  expect(guardado.status()).toBe(200);
  const perfil = await guardado.json();
  expect((await request.post('/api/v1/recuperaciones', {headers: origen, data: {correo}})).status()).toBe(202);
  let enlace = '';
  await expect.poll(async () => {
    const listado = await (await request.get(correoApi + '/api/v1/messages')).json();
    const correoPrueba = listado.messages.find((m: {Subject: string; To: {Address: string}[]}) => m.Subject === 'Recuperar acceso' && m.To.some(t => t.Address === correo));
    if (!correoPrueba) return false;
    const detalle = await (await request.get(correoApi + '/api/v1/message/' + correoPrueba.ID)).json();
    enlace = /https:\/\/localhost:8443\/recuperar#token=[A-Za-z0-9_-]{43}&version=1/.exec(detalle.Text)?.[0] ?? '';
    return Boolean(enlace);
  }, {timeout: 20000}).toBe(true);

  await page.goto('/recuperar');
  await page.evaluate(url => location.assign(url), enlace);
  await page.getByLabel('Nueva contraseña', {exact: true}).fill(nueva);
  await page.getByLabel('Confirmar nueva contraseña', {exact: true}).fill(nueva);
  await verificarVisibilidadContrasenas(page, ['Nueva contraseña', 'Confirmar nueva contraseña']);
  await page.getByRole('button', {name: 'Establecer contraseña'}).click();
  await expect(page.getByRole('heading', {name: 'Iniciar sesión', exact: true})).toBeVisible();
  for (const headers of [sesion, otra]) {
    expect((await request.get('/api/v1/perfil', {headers})).status()).toBe(401);
    expect((await editar(headers, {version: perfil.version + 1, nombreMostrar: 'Rechazado'})).status()).toBe(401);
  }
  await page.getByLabel('Correo', {exact: true}).fill(correo);
  await page.getByLabel('Contraseña', {exact: true}).fill(nueva);
  await page.getByRole('button', {name: 'Iniciar sesión', exact: true}).click();
  await conMenu(page, page.getByRole('button', {name: 'Cerrar sesión'})); await cerrarMenu(page);
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByLabel('Nombre para mostrar')).toHaveValue(datos.nombreMostrar);
  await expect(page.getByLabel('Teléfono (opcional)')).toHaveValue(datos.telefono);
  await expect(page.getByLabel('Distrito (opcional)')).toHaveValue(datos.distrito);
  await page.getByLabel('Distrito (opcional)').fill('Carmen Alto');
  await page.getByRole('button', {name: 'Guardar cambios'}).click();
  await expect(page.getByText('Perfil actualizado.', {exact: true})).toBeVisible();
});
