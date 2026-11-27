import { expect, test } from '@playwright/test';
import { captura, entrar, marcaDe, SesionApi } from './apoyo.js';

// Recorrido del prestador para cotizar (HU10, US3) sobre la aplicación real. Los datos del cliente se crean por la API con cuentas ficticias y cada ejecución usa una
// marca propia. Beto es compatible con la subcategoría A1 en Ayacucho; Ana no lo es.

test('US3: cotizar, requerir revisión por un cambio de la solicitud, actualizar, consultar y retirar', async ({ page, request }, info) => {
  const marca = marcaDe(info);
  const cliente = await SesionApi.entrar(request, 'clienteUno');
  const descripcion = `Instalar tuberías del baño principal [${marca}]`;
  const s = await cliente.publicar(descripcion);

  await entrar(page, 'beto', '/prestador/oportunidades', 'Oportunidades');
  await page.getByRole('link', { name: new RegExp(`Ver detalle: ${descripcion.replace(/[[\]]/g, '\\$&')}`) }).click();
  await expect(page.getByRole('heading', { name: 'Detalle de la solicitud' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tu cotización' })).toBeVisible();
  await page.getByRole('link', { name: 'Enviar cotización' }).click();
  await expect(page.getByRole('heading', { name: 'Enviar cotización' })).toBeVisible();
  await expect(page.getByText('Versión de trabajo 1.')).toBeVisible();
  await captura(page, info, '20-formulario');

  // Validación junto a cada campo, foco en el primero y datos conservados.
  await page.getByRole('button', { name: 'Enviar cotización' }).click();
  const alcance = page.getByLabel(/Alcance del trabajo/);
  await expect(alcance).toHaveAttribute('aria-invalid', 'true');
  await expect(alcance).toBeFocused();
  await expect(page.getByText('Describe el alcance del trabajo que cotizas.')).toBeVisible();
  await page.getByRole('radio', { name: /Definitiva/ }).check();
  await page.getByRole('button', { name: 'Enviar cotización' }).click();
  await expect(page.getByText('Una cotización definitiva exige un precio fijo.')).toBeVisible();
  await captura(page, info, '21-errores');

  await page.getByRole('radio', { name: /Estimada/ }).check();
  await alcance.fill('Instalar tuberías de agua y desagüe del baño, con prueba de presión.');
  await page.getByLabel(/Forma de cálculo/).fill('S/ 120 por punto sanitario');
  await page.getByLabel(/Válida hasta/).fill('2031-12-31');
  await page.getByRole('button', { name: 'Enviar cotización' }).click();
  await expect(page.getByText('Cotización enviada.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cotización', exact: true })).toBeVisible();
  await expect(page.getByText('Vigente', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('No indicado').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Actualizar cotización' })).toBeVisible();
  await captura(page, info, '22-detalle-vigente');
  const urlCotizacion = page.url();

  // Un cambio relevante de la solicitud deja la cotización pendiente de revisión; la pantalla no afirma que nadie haya sido avisado.
  await cliente.editar(s.solicitudId, { medidas: '4 m de largo por 2 m de alto' });
  await page.reload();
  await expect(page.getByText('Requiere revisión', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/La solicitud cambió después de tu última versión/)).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/avis|notific|enviamos/i);
  await captura(page, info, '23-requiere-revision');

  await page.getByRole('link', { name: 'Revisar y actualizar' }).click();
  await expect(page.getByRole('heading', { name: 'Actualizar cotización' })).toBeVisible();
  await expect(page.getByText('4 m de largo por 2 m de alto')).toBeVisible();
  await expect(page.getByText('Versión de trabajo 2.')).toBeVisible();
  await expect(alcance).toHaveValue(/Instalar tuberías de agua/);
  await captura(page, info, '24-actualizar');
  await page.getByLabel(/Forma de cálculo/).fill('S/ 130 por punto sanitario');
  await page.getByRole('button', { name: 'Guardar nueva versión' }).click();
  await expect(page.getByText('Cotización actualizada.')).toBeVisible();
  await expect(page.getByText('Vigente', { exact: true }).first()).toBeVisible();
  await page.getByText(/^Versión 1 ·/).click();
  await expect(page.getByText('S/ 120 por punto sanitario')).toBeVisible();
  await captura(page, info, '25-versiones');

  await page.getByRole('main').getByRole('link', { name: /Mis cotizaciones/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Mis cotizaciones' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Mis cotizaciones' }).getByText('Vigente', { exact: true }).first()).toBeVisible();
  await captura(page, info, '26-mis-cotizaciones');

  await page.goto(urlCotizacion);
  await page.getByRole('button', { name: 'Retirar cotización' }).click();
  await expect(page.getByText(/Retirar es definitivo/)).toBeVisible();
  await captura(page, info, '27-confirmar-retiro');
  await page.getByRole('button', { name: 'Confirmar retiro' }).click();
  await expect(page.getByText(/Cotización retirada\./)).toBeVisible();
  await expect(page.getByRole('list', { name: 'Mis cotizaciones' }).getByText('Retirada', { exact: true }).first()).toBeVisible();
  await captura(page, info, '28-retirada');
});

test('US3: una cotización vencida o de una solicitud cerrada se explica y limita sus acciones', async ({ page, request }, info) => {
  const marca = marcaDe(info);
  const cliente = await SesionApi.entrar(request, 'clienteUno');
  const beto = await SesionApi.entrar(request, 'beto');
  const vencida = await cliente.publicar(`Revisar la red de agua del patio [${marca}]`);
  const cv = await beto.cotizar(vencida.solicitudId, vencida.versionTrabajo, { vigenteHasta: new Date(Date.now() + 3000).toISOString(), alcance: 'Revisar la red de agua del patio' });
  const cerrada = await cliente.publicar(`Cambiar el lavatorio del baño [${marca}]`);
  const cc = await beto.cotizar(cerrada.solicitudId, cerrada.versionTrabajo, { alcance: 'Cambiar el lavatorio del baño' });
  await cliente.cerrar(cerrada.solicitudId);
  await page.waitForTimeout(3500);

  await entrar(page, 'beto', `/prestador/cotizaciones/${cv.cotizacionId}`, 'Cotización');
  await expect(page.getByText('Vencida', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Actualízala con una nueva vigencia/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Actualizar cotización' })).toBeVisible();
  await captura(page, info, '29-vencida');

  await page.goto(`/prestador/cotizaciones/${cc.cotizacionId}`);
  await expect(page.getByRole('heading', { name: 'Cotización', exact: true })).toBeVisible();
  await expect(page.getByText(/La solicitud está cerrada/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retirar cotización' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Actualizar cotización|Revisar y actualizar/ })).toHaveCount(0);
  await captura(page, info, '30-solicitud-cerrada');
  await page.goto(`/prestador/cotizaciones/${cc.cotizacionId}/actualizar`);
  await expect(page.getByRole('heading', { name: 'Esta cotización ya no admite cambios' })).toBeVisible();
  await captura(page, info, '31-sin-cambios');
});

test('US3: un prestador sin título no puede cotizar ni ver la cotización de otro', async ({ page, request }, info) => {
  const marca = marcaDe(info);
  const cliente = await SesionApi.entrar(request, 'clienteUno');
  const beto = await SesionApi.entrar(request, 'beto');
  const s = await cliente.publicar(`Levantar un muro de contención [${marca}]`);
  const c = await beto.cotizar(s.solicitudId, s.versionTrabajo);

  await entrar(page, 'ana', `/prestador/solicitudes/${s.solicitudId}/cotizar`, 'Solicitud no disponible');
  await expect(page.getByRole('alert')).toContainText('no está disponible');
  await expect(page.getByLabel(/Alcance del trabajo/)).toHaveCount(0);
  await captura(page, info, '32-sin-titulo');
  await page.goto(`/prestador/cotizaciones/${c.cotizacionId}`);
  await expect(page.getByRole('heading', { name: 'Cotización no disponible' })).toBeVisible();
  await expect(page.getByText(/Levantar el muro|pulido/)).toHaveCount(0);
  await captura(page, info, '33-cotizacion-ajena');
});
