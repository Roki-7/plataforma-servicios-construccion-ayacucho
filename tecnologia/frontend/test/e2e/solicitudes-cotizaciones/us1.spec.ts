import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const local = fileURLToPath(new URL('../../../../.local/', import.meta.url));
interface CuentaFicticia { clave: string; correo: string; contrasena: string }

async function entrar(page: Page) {
  const cuentas = JSON.parse(await readFile(resolve(local, '003/cuentas-ficticias.json'), 'utf8')) as CuentaFicticia[];
  const cliente = cuentas.find(c => c.clave === 'clienteUno');
  if (!cliente) throw new Error('Falta la cuenta ficticia clienteUno de la semilla 003.');
  await page.goto('/solicitudes');
  await page.getByLabel('Correo', { exact: true }).fill(cliente.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(cliente.contrasena);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Mis solicitudes' })).toBeVisible();
}

async function comprobarAncho(page: Page) {
  const medidas = await page.evaluate(() => ({ contenido: document.documentElement.scrollWidth, ventana: innerWidth }));
  expect(medidas.contenido, `La pantalla desborda el viewport de ${medidas.ventana} px`).toBeLessThanOrEqual(medidas.ventana);
}

async function captura(page: Page, info: TestInfo, nombre: string) {
  const directorio = resolve(process.env['E2E_EVIDENCIA'] ?? resolve(local, 'evidencia/003'), 'capturas', info.project.name);
  await mkdir(directorio, { recursive: true });
  await comprobarAncho(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(directorio, nombre + '.png'), fullPage: true });
}

test('US1 pública', async ({ page }, info) => {
  const descripcion = page.getByLabel('Descripción del trabajo');
  const distrito = page.getByLabel('Distrito');
  const fecha = page.getByLabel('Fecha deseada');
  const guardar = page.getByRole('button', { name: 'Guardar cambios' });
  const publicar = page.getByRole('button', { name: 'Publicar solicitud' });
  await entrar(page);
  await page.getByRole('link', { name: 'Nueva solicitud' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva solicitud' })).toBeVisible();
  await captura(page, info, '01-nueva');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('heading', { name: 'Detalle de solicitud' })).toBeVisible();
  await expect(page.getByText('Borrador guardado.')).toBeVisible();
  await publicar.click();
  await expect(descripcion).toHaveAttribute('aria-invalid', 'true');
  await descripcion.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Medidas')).toBeFocused();

  await descripcion.fill('x'.repeat(2001));
  await guardar.click();
  await expect(page.getByText('Admite hasta 2000 caracteres.')).toBeVisible();
  await expect(descripcion).toHaveValue('x'.repeat(2001));
  await comprobarAncho(page);
  await descripcion.fill('Levantar un muro de ladrillo de 3 x 2 m. Contacto 981 234 567.');
  await page.getByLabel('Medidas').fill('3 m de largo por 2 m de alto');
  const categoria = page.getByLabel('Categoría', { exact: false });
  await expect(categoria.locator('option').nth(1)).toBeAttached();
  await categoria.selectOption({ index: 1 });
  await distrito.selectOption('ayacucho');
  await fecha.fill('2031-03-10');
  await guardar.click();
  await expect(page.getByRole('heading', { name: 'Advertencias para revisar' })).toBeVisible();
  await publicar.click();
  await expect(descripcion).toHaveAttribute('aria-invalid', 'true');
  await expect(descripcion).toHaveValue(/981 234 567/);

  const selectorFoto = page.getByLabel('Seleccionar fotografía');
  await selectorFoto.setInputFiles({ name: 'falso.png', mimeType: 'image/png', buffer: Buffer.from('imagen no válida') });
  await page.getByRole('button', { name: 'Cargar fotografía' }).click();
  await expect(page.locator('#sol-fotos-error')).toBeVisible();
  await expect(page.getByText('Aún no hay fotografías cargadas.')).toBeVisible();
  const png = await page.evaluate(() => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 360; lienzo.height = 220;
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#dcccb7'; ctx.fillRect(0, 0, 360, 220);
    ctx.fillStyle = '#b85c38';
    for (let fila = 0; fila < 5; fila += 1) {
      for (let columna = -1; columna < 5; columna += 1) ctx.fillRect(columna * 78 + (fila % 2) * 39, fila * 45, 73, 40);
    }
    return lienzo.toDataURL('image/png').split(',')[1]!;
  });
  await selectorFoto.setInputFiles({ name: 'muro-ficticio.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByRole('button', { name: 'Cargar fotografía' }).click();
  await expect(page.getByText('Por confirmar al guardar')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Fotografía 1 de la solicitud' })).toBeVisible();
  await captura(page, info, '02-borrador');
  await descripcion.fill('Levantar un muro de ladrillo de 3 x 2 m en el patio.');
  await page.getByLabel('Compartir fotografías').check();
  await publicar.click();
  await expect(page.getByText('Solicitud publicada.')).toBeVisible();
  await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();
  await captura(page, info, '03-publicada');

  await descripcion.fill('Levantar el muro de ladrillo y agregar un acabado lavable.');
  await page.getByRole('button', { name: 'Excluir foto 1' }).click();
  await guardar.click();
  await expect(page.getByText('Cambio registrado.')).toBeVisible();
  await page.getByRole('button', { name: 'Ver versiones' }).focus();
  await page.keyboard.press('Enter');
  await page.getByText(/^Versión 1 ·/).click();
  await expect(page.getByText(/Archivo retirado/)).toBeVisible();
  await expect(page.getByText(/^Versión 2 ·/)).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar solicitud' }).click();
  await page.getByRole('button', { name: 'Confirmar cierre' }).click();
  await expect(page.getByText('Solicitud cerrada.')).toBeVisible();
  await captura(page, info, '04-cerrada');
  await page.getByRole('main').getByRole('link', { name: /Mis solicitudes/ }).click();
  await expect(page.getByRole('heading', { name: 'Mis solicitudes' })).toBeVisible();
  await page.getByLabel('Estado', { exact: true }).selectOption('CERRADA');
  await expect(page.getByRole('heading', { name: 'Levantar el muro de ladrillo y agregar un acabado lavable.' }).first()).toBeVisible();
  await captura(page, info, '05-listado');
});

test('US1 dirigida', async ({ page }, info) => {
  await entrar(page);
  await page.getByRole('link', { name: 'Nueva solicitud' }).click();
  await page.getByRole('radio', { name: /Dirigida/ }).check();
  await page.getByRole('list', { name: 'Prestadores disponibles' }).getByRole('button').first().click();
  const servicios = page.getByLabel('Servicio (opcional)');
  await expect(servicios).toBeVisible();
  await page.getByLabel('Descripción del trabajo').fill('Revestir la fachada de un ambiente de 5 x 3 m.');
  await expect(page.getByLabel('Categoría', { exact: false }).locator('option').nth(1)).toBeAttached();
  await page.getByLabel('Categoría', { exact: false }).selectOption({ index: 1 });
  await page.getByLabel('Distrito').selectOption('andres-avelino-caceres-dorregaray');
  await page.getByLabel('Fecha deseada').fill('2031-04-05');
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByRole('heading', { name: 'Advertencias para revisar' })).toBeVisible();
  await captura(page, info, '06-dirigida');
  await page.getByRole('button', { name: 'Publicar solicitud' }).click();
  await expect(page.getByText('Solicitud publicada.')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar solicitud' }).click();
  await page.getByRole('button', { name: 'Confirmar cierre' }).click();
  await expect(page.getByText('Solicitud cerrada.')).toBeVisible();
});
