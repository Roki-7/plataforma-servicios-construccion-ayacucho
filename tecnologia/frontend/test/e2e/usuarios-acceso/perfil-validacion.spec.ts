import { randomUUID } from 'node:crypto';
import { test, expect } from '../../soporte/validacion.js';
import type { Page } from '@playwright/test';

/**
 * Enmienda controlada de 001 (T080): recorrido real de «Editar mi perfil» con las reglas de contacto (CA-PER-07 teléfono, CA-PER-08 vacíos a null,
 * CA-PER-09 caracteres de control, CA-PER-10 distrito libre). Un dato inválido se explica junto al campo, es accesible y no se guarda;
 * los valores válidos y los normalizados a null persisten tras recargar la página.
 */
test.setTimeout(120000);
async function consultarCuenta(pagina: Page, accion: () => Promise<unknown>) {
  const lectura = pagina.waitForResponse((r) => r.request().method() === 'GET' && new URL(r.url()).pathname === '/api/v1/perfil');
  await accion(); expect((await lectura).status()).toBe(200);
  await expect(pagina.getByRole('heading', { name: 'Mi cuenta', exact: true })).toBeVisible();
}
const guardar = (pagina: Page) => pagina.getByRole('button', { name: 'Guardar cambios' }).click();

test('CA-PER-07 CA-PER-08 CA-PER-09 CA-PER-10 el perfil rechaza el teléfono con letras y los caracteres de control, y guarda los valores válidos y los vacíos como null', async ({ page, browser, browserName }, info) => {
  info.annotations.push({ type: 'navegador', description: `${browserName} ${browser.version()}` });
  const correo = `${randomUUID()}@example.invalid`, contrasena = ' clave ficticia de validacion ';
  await page.request.post('/api/v1/cuentas', { headers: { Origin: 'https://localhost:8443', 'Idempotency-Key': randomUUID() }, data: { correo, contrasena, confirmacionContrasena: contrasena, nombreMostrar: 'Persona ficticia', perfiles: ['cliente'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: '001-v1' } }).then((r) => expect(r.status()).toBe(201));
  await page.goto('/acceso'); await page.getByLabel('Correo', { exact: true }).fill(correo); await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  await consultarCuenta(page, () => page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click());
  const telefono = page.getByLabel('Teléfono (opcional)'), distrito = page.getByLabel('Distrito (opcional)'), nombre = page.getByLabel('Nombre para mostrar');

  // CA-PER-07: teléfono con letras → error legible junto al campo, accesible, y nada se guarda ni se muestra «Perfil actualizado».
  await expect(page.getByText('Opcional. Entre 6 y 15 dígitos; puede usar espacios y los signos + - . ( ).')).toBeVisible();
  await telefono.fill('984-ABC-1234'); await guardar(page);
  const error = page.getByText('Use solo dígitos, espacios y los signos + - . ( ).');
  await expect(error).toBeVisible(); await expect(telefono).toHaveAttribute('aria-invalid', 'true'); await expect(telefono).toHaveAttribute('aria-describedby', /error-telefono-perfil/);
  await expect(page.getByText('Perfil actualizado.')).toHaveCount(0);
  await telefono.fill('12345'); await guardar(page); await expect(page.getByText('Ingrese entre 6 y 15 dígitos.')).toBeVisible();
  await consultarCuenta(page, () => page.reload()); await expect(telefono).toHaveValue('');

  // CA-PER-09: un tabulador en el nombre o el distrito se rechaza con su motivo; el perfil sigue igual al recargar.
  await nombre.fill('Ana\tPérez'); await distrito.fill('Ayacucho Centro'); await guardar(page);
  await expect(page.getByText('El nombre no puede incluir saltos de línea, tabuladores ni otros caracteres de control.')).toBeVisible();
  await expect(page.getByText('El distrito no puede incluir saltos de línea, tabuladores ni otros caracteres de control.')).toBeVisible();
  await consultarCuenta(page, () => page.reload()); await expect(nombre).toHaveValue('Persona ficticia'); await expect(distrito).toHaveValue('');

  // CA-PER-07 y CA-PER-10: teléfono con formato internacional y distrito libre se guardan y persisten.
  await telefono.fill('+51 (984) 123-456'); await distrito.fill('Distrito libre 123 !'); await nombre.fill("María Ñañez & Hijos S.A.C.");
  await guardar(page); await expect(page.getByText('Perfil actualizado.')).toBeVisible();
  await consultarCuenta(page, () => page.reload());
  await expect(telefono).toHaveValue('+51 (984) 123-456'); await expect(distrito).toHaveValue('Distrito libre 123 !'); await expect(nombre).toHaveValue('María Ñañez & Hijos S.A.C.');

  // CA-PER-08: vacío o solo espacios se guarda como null (los campos quedan vacíos al recargar) y siguen siendo opcionales.
  await telefono.fill('   '); await distrito.fill('   '); await guardar(page); await expect(page.getByText('Perfil actualizado.')).toBeVisible();
  await consultarCuenta(page, () => page.reload()); await expect(telefono).toHaveValue(''); await expect(distrito).toHaveValue('');
});
