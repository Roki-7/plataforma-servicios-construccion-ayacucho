import { expect, type Page } from '@playwright/test';

export async function verificarVisibilidadContrasenas(page: Page, etiquetas: string[]) {
  const campos = etiquetas.map(etiqueta => page.getByLabel(etiqueta, { exact: true }));
  for (const [indice, etiqueta] of etiquetas.entries()) {
    const campo = campos[indice]!;
    const valor = await campo.inputValue();
    const mostrar = page.getByRole('button', { name: `Mostrar el valor de «${etiqueta}»`, exact: true });
    await expect(campo).toHaveAttribute('type', 'password');
    await expect(mostrar).toHaveAttribute('type', 'button');
    await campo.focus();
    await page.keyboard.press('Tab');
    await expect(mostrar).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(campo).toHaveAttribute('type', 'text');
    for (const otro of campos.filter(c => c !== campo)) await expect(otro).toHaveAttribute('type', 'password');
    expect(await campo.inputValue() === valor).toBe(true);
    await page.keyboard.press('Space');
    await expect(campo).toHaveAttribute('type', 'password');
    expect(await campo.inputValue() === valor).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
