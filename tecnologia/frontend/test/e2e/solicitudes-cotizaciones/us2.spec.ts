import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// Recorrido del prestador (HU08, US2) sobre la aplicación real. Los datos del cliente se crean por la API con cuentas ficticias de la semilla 003
// y cada ejecución usa una marca propia, de modo que las series no dependen de lo creado por otras.
const local = fileURLToPath(new URL('../../../../.local/', import.meta.url));
const origen = 'https://localhost:8447';
const uuid = (n: number) => `00000000-0000-4003-8000-${String(n).padStart(12, '0')}`;
const categoria = { A1: uuid(101), B: uuid(103) };
const prestadorBeto = uuid(201);
interface CuentaFicticia { clave: string; correo: string; contrasena: string }

async function cuenta(clave: string): Promise<CuentaFicticia> {
  const cuentas = JSON.parse(await readFile(resolve(local, '003/cuentas-ficticias.json'), 'utf8')) as CuentaFicticia[];
  const c = cuentas.find(x => x.clave === clave);
  if (!c) throw new Error(`Falta la cuenta ficticia ${clave} de la semilla 003.`);
  return c;
}

function png(ancho = 96, alto = 64): string {
  const filas = Buffer.alloc((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    const i = y * (ancho * 3 + 1) + 1 + x * 3;
    const ladrillo = (Math.floor(y / 8) + Math.floor(x / 16)) % 2 === 0;
    filas[i] = ladrillo ? 184 : 220; filas[i + 1] = ladrillo ? 92 : 204; filas[i + 2] = ladrillo ? 56 : 183;
  }
  const trozo = (tipo: string, datos: Buffer) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo), datos]);
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    const control = Buffer.alloc(4); control.writeUInt32BE(crc32(cuerpo));
    return Buffer.concat([largo, cuerpo, control]);
  };
  const cabecera = Buffer.alloc(13); cabecera.writeUInt32BE(ancho, 0); cabecera.writeUInt32BE(alto, 4); cabecera[8] = 8; cabecera[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cabecera), trozo('IDAT', deflateSync(filas)), trozo('IEND', Buffer.alloc(0))]).toString('base64');
}

class Cliente {
  private constructor(private readonly api: APIRequestContext, private readonly token: string) {}
  static async entrar(api: APIRequestContext, clave: string) {
    const c = await cuenta(clave);
    const r = await api.post(`${origen}/api/v1/sesiones`, { data: { correo: c.correo, contrasena: c.contrasena }, headers: { Origin: origen } });
    expect(r.status()).toBe(200);
    return new Cliente(api, ((await r.json()) as { tokenAcceso: string }).tokenAcceso);
  }
  private async enviar<T>(ruta: string, datos: object, esperado: number): Promise<T> {
    const r = await this.api.post(`${origen}/api/v1/solicitudes${ruta}`, {
      data: datos, headers: { Authorization: `Bearer ${this.token}`, Origin: origen, 'Idempotency-Key': crypto.randomUUID() },
    });
    expect(r.status(), await r.text()).toBe(esperado);
    return await r.json() as T;
  }
  async publicar(descripcion: string, extra: object, foto = false): Promise<string> {
    const creada = await this.enviar<{ solicitudId: string; version: number }>('', {
      tipo: 'PUBLICADA', descripcion, medidas: '3 m de largo por 2 m de alto', categoriaId: categoria.A1, distrito: 'ayacucho', fechaDesde: '2031-03-10', fechaHasta: '2031-03-20', ...extra,
    }, 201);
    const archivosIds = foto ? [(await this.enviar<{ archivoId: string }>(`/${creada.solicitudId}/archivos`, { tipoMime: 'image/png', contenidoBase64: png() }, 201)).archivoId] : [];
    await this.enviar(`/${creada.solicitudId}/publicacion`, { version: creada.version, ...(foto ? { archivosIds } : {}) }, 200);
    return creada.solicitudId;
  }
  async cerrar(id: string) {
    const r = await this.api.get(`${origen}/api/v1/solicitudes/${id}`, { headers: { Authorization: `Bearer ${this.token}` } });
    const { version } = await r.json() as { version: number };
    await this.enviar(`/${id}/cierre`, { version }, 200);
  }
}

async function entrar(page: Page, clave: string, ruta: string, titulo: string) {
  const c = await cuenta(clave);
  await page.goto(ruta);
  await page.getByLabel('Correo', { exact: true }).fill(c.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(c.contrasena);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
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

test('US2: oportunidades compatibles, fotografías según la política y dirigida cerrada', async ({ page, request }, info) => {
  // Solo letras: una marca con cifras se rechazaría como dato de contacto.
  const marca = `${info.project.name}${Date.now()}`.replace(/\d/g, d => 'abcdefghij'[Number(d)]!);
  const cliente = await Cliente.entrar(request, 'clienteUno');
  await cliente.publicar(`Instalar tuberías del baño principal [${marca}]`, { compartirFotografias: true }, true);
  await cliente.publicar(`Cambiar el inodoro y el lavatorio [${marca}]`, { compartirFotografias: false }, true);
  const otraCategoria = await cliente.publicar(`Pintar la fachada de dos pisos [${marca}]`, { categoriaId: categoria.B, distrito: 'jesus-nazareno' });
  const dirigida = await cliente.publicar(`Revisar la red de agua del patio [${marca}]`, { tipo: 'DIRIGIDA', prestadorId: prestadorBeto });
  await cliente.cerrar(dirigida);

  await entrar(page, 'beto', '/prestador/oportunidades', 'Oportunidades');
  const lista = page.getByRole('list', { name: 'Oportunidades' });
  await expect(lista.getByRole('heading', { name: new RegExp(marca) })).toHaveCount(2);
  await expect(lista.getByRole('heading', { name: /Pintar la fachada/ })).toHaveCount(0);
  await expect(lista.getByRole('heading', { name: /Revisar la red de agua/ })).toHaveCount(0);
  await expect(lista.getByText('Fotografías no compartidas por el cliente').first()).toBeVisible();
  await captura(page, info, '10-oportunidades');

  const verDetalle = (texto: string) => page.getByRole('link', { name: new RegExp(`Ver detalle: ${texto}.*\\[${marca}\\]`) });
  await verDetalle('Instalar tuberías').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Detalle de la solicitud' })).toBeVisible();
  await expect(page.getByText(new RegExp(`Instalar tuberías del baño principal \\[${marca}\\]`))).toBeVisible();
  await expect(page.getByText('Compatible con tus servicios')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Fotografía 1 de la solicitud' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver versiones' })).toHaveCount(0);
  await captura(page, info, '11-detalle-fotografia-compartida');

  await page.getByRole('link', { name: 'Volver a oportunidades' }).click();
  await verDetalle('Cambiar el inodoro').click();
  await expect(page.getByText('El cliente no compartió las fotografías de esta solicitud.')).toBeVisible();
  await expect(page.getByRole('img')).toHaveCount(0);
  await captura(page, info, '12-detalle-fotografia-privada');

  await page.goto(`/prestador/solicitudes/${otraCategoria}`);
  await expect(page.getByRole('heading', { name: 'Solicitud no disponible' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Esta solicitud no está disponible.');
  await expect(page.getByText(/Pintar la fachada/)).toHaveCount(0);
  await captura(page, info, '13-sin-acceso');

  await page.getByRole('link', { name: 'Solicitudes recibidas' }).first().click();
  await expect(page.getByRole('heading', { name: 'Solicitudes recibidas' })).toBeVisible();
  await page.getByLabel('Estado', { exact: true }).selectOption('CERRADA');
  const recibidas = page.getByRole('list', { name: 'Solicitudes recibidas' });
  await expect(recibidas.getByRole('heading', { name: new RegExp(marca) })).toBeVisible();
  await expect(recibidas.getByText('Dirigida a ti').first()).toBeVisible();
  await captura(page, info, '14-recibidas-cerrada');
  await recibidas.getByRole('link', { name: new RegExp(`Ver detalle: Revisar la red de agua del patio \\[${marca}\\]`) }).click();
  await expect(page.getByText('Solicitud cerrada.')).toBeVisible();
  await expect(page.getByText('Dirigida a ti')).toBeVisible();
  await page.getByRole('button', { name: 'Ver versiones' }).click();
  await expect(page.getByText(/^Versión 1 ·/)).toBeVisible();
  await captura(page, info, '15-detalle-dirigida-cerrada');
  expect(await page.content()).not.toMatch(/cliente\.uno@example\.invalid/);
});

test('US2: una cuenta sin perfil de prestador no accede al recorrido', async ({ page }, info) => {
  await entrar(page, 'clienteUno', '/prestador/oportunidades', 'Perfil de prestador requerido');
  await expect(page.getByRole('link', { name: 'Habilitar perfil de prestador' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Oportunidades' })).toHaveCount(0);
  await captura(page, info, '16-sin-perfil-prestador');
});
