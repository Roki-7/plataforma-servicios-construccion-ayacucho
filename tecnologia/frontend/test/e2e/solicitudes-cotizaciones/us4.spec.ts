import { expect, test } from '@playwright/test';
import { captura, entrar, marcaDe, SesionApi } from './apoyo.js';

// Recorrido de HU11 (US4) sobre la aplicación real: el cliente revisa las cotizaciones recibidas, compara y aclara dudas; el prestador responde. Los datos se crean por la
// API con cuentas ficticias y cada ejecución usa una marca propia. Para una solicitud de la categoría A en Ayacucho cotizan Ana, Beto y Gema.
const categoriaA = '00000000-0000-4003-8000-000000000100';

async function solicitudConTresCotizaciones(request: Parameters<typeof SesionApi.entrar>[0], marca: string) {
  const cliente = await SesionApi.entrar(request, 'clienteUno');
  const s = await cliente.publicar(`Remodelar el baño completo del segundo piso [${marca}]`, { categoriaId: categoriaA });
  const [ana, beto, gema] = await Promise.all([SesionApi.entrar(request, 'ana'), SesionApi.entrar(request, 'beto'), SesionApi.entrar(request, 'gema')]);
  const cb = await beto.cotizar(s.solicitudId, s.versionTrabajo, {
    tipo: 'DEFINITIVA', alcance: 'Remodelación completa: demolición, tubería nueva, enchape y colocación de aparatos.', precioCentimos: 1850000, plazoDias: 12,
    condicionesPago: '40 % al iniciar, 30 % a mitad de obra y 30 % al entregar.', materiales: 'Cerámico, tubería PVC y aparatos sanitarios estándar.', exclusiones: 'Retiro del desmonte.',
    manoDeObra: 'Un maestro y dos ayudantes.', formaCalculo: undefined,
  });
  const ca = await ana.cotizar(s.solicitudId, s.versionTrabajo, { tipo: 'ESTIMADA', alcance: 'Remodelación del baño según visita técnica.', formaCalculo: 'S/ 1 400 por metro cuadrado de baño' });
  const cg = await gema.cotizar(s.solicitudId, s.versionTrabajo, {
    tipo: 'DEFINITIVA', alcance: 'Remodelación del baño con acabados de primera.', precioCentimos: 2200000, plazoDias: 15, condicionesPago: '50 % al iniciar y 50 % al entregar.',
  });
  return { cliente, s, beto, cb, ca, cg };
}

test('US4 cliente: revisa las cotizaciones recibidas, las compara sin clasificación y aclara dudas con un prestador', async ({ page, request }, info) => {
  const marca = marcaDe(info);
  const { s, cb } = await solicitudConTresCotizaciones(request, marca);
  await entrar(page, 'clienteUno', `/solicitudes/${s.solicitudId}/cotizaciones`, 'Cotizaciones recibidas');
  const lista = page.getByRole('list', { name: 'Cotizaciones recibidas' });
  await expect(lista.getByRole('heading', { name: /Ana Albañil|Beto Gasfitero|Gema Constructora/ })).toHaveCount(3);
  // Orden de llegada (Beto cotizó primero), no de precio ni de nombre.
  await expect(lista.getByRole('heading').first()).toHaveText('Beto Gasfitero');
  await expect(lista.getByText('Precio por definir')).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/mejor cotizaci|recomendad|ranking/i);
  await captura(page, info, '40-recibidas');

  // Marcar y comparar (Comparar exige al menos dos).
  const comparar = page.getByRole('button', { name: 'Comparar seleccionadas' });
  await expect(comparar).toBeDisabled();
  await page.getByRole('checkbox', { name: /Comparar.*Ana Albañil/ }).check();
  await expect(comparar).toBeDisabled();
  await page.getByRole('checkbox', { name: /Comparar.*Beto Gasfitero/ }).check();
  await page.getByRole('checkbox', { name: /Comparar.*Gema Constructora/ }).check();
  await expect(page.getByText('3 de 10 seleccionadas')).toBeVisible();
  await comparar.click();
  await expect(page.getByRole('heading', { name: 'Comparar cotizaciones' })).toBeVisible();
  await expect(page.getByText(/No hay una clasificación/)).toBeVisible();
  await expect(page.getByText(/no son un precio final/)).toBeVisible();
  await expect(page.getByText('No indicado').first()).toBeVisible();
  await expect(page.getByText('Estimada', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('S/ 18 500,00').or(page.getByText('S/ 18,500.00')).first()).toBeVisible();
  expect(await page.locator('main').innerText()).not.toMatch(/mejor cotizaci|recomendad|ranking|total (de|general)/i);
  await captura(page, info, '41-comparacion');
  await page.getByRole('button', { name: 'Quitar a Ana Albañil de la comparación' }).click();
  await expect(page.getByText(/2 cotizaciones, en el orden en que las elegiste/)).toBeVisible();
  await expect(page.getByText('Ana Albañil')).toHaveCount(0);
  await captura(page, info, '42-comparacion-sin-ana');

  // Detalle de una cotización y aclaraciones.
  await page.goto(`/solicitudes/${s.solicitudId}/cotizaciones/${cb.cotizacionId}`);
  await expect(page.getByRole('heading', { name: 'Cotización de Beto Gasfitero' })).toBeVisible();
  await expect(page.getByText(/Aún no hay mensajes/)).toBeVisible();
  const campo = page.getByLabel('Tu mensaje');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(campo).toHaveAttribute('aria-invalid', 'true');
  await expect(campo).toBeFocused();
  const mensaje = 'Hola, ¿el precio incluye el retiro del desmonte?';
  await campo.fill(mensaje);
  await expect(page.getByText(`${mensaje.length} / 1000 caracteres`)).toBeVisible();
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('Tu mensaje quedó guardado en el hilo.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Mensajes del hilo' })).toContainText('retiro del desmonte');
  await expect(page.getByText('1 de 20 mensajes')).toBeVisible();
  await expect(page.getByLabel('Tu mensaje')).toHaveValue('');
  expect(await page.locator('main').innerText()).not.toMatch(/avis|notific|enviamos/i);
  await captura(page, info, '43-hilo-cliente');
});

test('US4 prestador: lee la aclaración del cliente y responde en el mismo hilo', async ({ page, request }, info) => {
  const marca = marcaDe(info);
  const { cliente, cb } = await solicitudConTresCotizaciones(request, marca);
  await cliente.aclarar(cb.cotizacionId, '¿Cuándo podría empezar la obra?');
  await entrar(page, 'beto', `/prestador/cotizaciones/${cb.cotizacionId}`, 'Cotización');
  const hilo = page.getByRole('list', { name: 'Mensajes del hilo' });
  await expect(hilo).toContainText('¿Cuándo podría empezar la obra?');
  await expect(hilo.getByText('El cliente')).toBeVisible();
  await page.getByLabel('Tu mensaje').fill('Podría empezar el lunes de la próxima semana.');
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(page.getByText('Tu mensaje quedó guardado en el hilo.')).toBeVisible();
  await expect(hilo.getByText('Tú').first()).toBeVisible();
  await expect(page.getByText('2 de 20 mensajes')).toBeVisible();
  await captura(page, info, '44-hilo-prestador');
  await page.getByRole('button', { name: 'Actualizar mensajes' }).click();
  await expect(hilo).toContainText('Podría empezar el lunes de la próxima semana.');
});

test('US4 acceso: otro cliente y otros prestadores no ven ni las cotizaciones, ni los nombres, ni el hilo', async ({ page, request }, info) => {
  const marca = marcaDe(info);
  const { s, cb } = await solicitudConTresCotizaciones(request, marca);
  await entrar(page, 'clienteDos', `/solicitudes/${s.solicitudId}/cotizaciones`, 'Cotizaciones recibidas');
  await expect(page.getByRole('alert')).toContainText('no está disponible');
  await expect(page.getByText(/Beto Gasfitero|Ana Albañil|Gema Constructora/)).toHaveCount(0);
  await page.goto(`/solicitudes/${s.solicitudId}/cotizaciones/${cb.cotizacionId}`);
  await expect(page.getByRole('heading', { name: 'Cotización no disponible' })).toBeVisible();
  await expect(page.getByText(/Beto Gasfitero|Remodelación completa/)).toHaveCount(0);
  await captura(page, info, '45-sin-acceso');
});
