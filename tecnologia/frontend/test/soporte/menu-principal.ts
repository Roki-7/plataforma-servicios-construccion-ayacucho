import { expect, type Locator, type Page } from '@playwright/test';

/**
 * El menú principal es una barra lateral fija desde 768 px y, en celular, un panel que se abre con el botón «Menú» (y se cierra solo al cambiar de pantalla).
 * Estas utilidades dejan visible el control que una prueba necesita, sin depender del ancho: si ya se ve no hacen nada y, si no, abren el menú y reintentan
 * (por ejemplo, tras iniciar sesión el panel se cierra al cambiar de ruta). Las comparten las pruebas de 001 y de 002.
 */
export async function conMenu(page: Page, objetivo: Locator, espera = 30_000): Promise<void> {
  const boton = page.getByRole('button', { name: 'Menú', exact: true });
  await expect(async () => {
    if (await objetivo.isVisible()) return;
    if ((await boton.isVisible()) && (await boton.getAttribute('aria-expanded')) === 'false') await boton.click();
    await expect(objetivo).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: espera });
}

/** Cierra el panel del menú en celular (si está abierto) para que no tape el contenido; en pantallas anchas no hace nada. */
export async function cerrarMenu(page: Page): Promise<void> {
  const boton = page.getByRole('button', { name: 'Menú', exact: true });
  if ((await boton.isVisible()) && (await boton.getAttribute('aria-expanded')) === 'true') await boton.click();
}

/** Elige una opción del menú principal por el nombre de su enlace. */
export async function irA(page: Page, enlace: string, opciones: { exact?: boolean } = {}): Promise<void> {
  const destino = page.getByRole('link', { name: enlace, ...(opciones.exact ? { exact: true } : {}) });
  // En celular el panel se cierra solo al cambiar de pantalla (por ejemplo, justo tras iniciar sesión): si se cierra entre abrirlo y pulsar, se vuelve a abrir.
  await expect(async () => { await conMenu(page, destino, 5_000); await destino.click({ timeout: 2_000 }); }).toPass({ timeout: 30_000 });
}
