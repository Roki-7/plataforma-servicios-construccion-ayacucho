import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// Apoyo de los recorridos de HU10: cuentas ficticias de la semilla 003, datos de cliente creados por la API y utilidades de captura. No es una suite.
export const local = fileURLToPath(new URL('../../../../.local/', import.meta.url));
export const origen = 'https://localhost:8447';
const uuid = (n: number) => `00000000-0000-4003-8000-${String(n).padStart(12, '0')}`;
export const categoriaA1 = uuid(101);
interface CuentaFicticia { clave: string; correo: string; contrasena: string }

export async function cuenta(clave: string): Promise<CuentaFicticia> {
  const cuentas = JSON.parse(await readFile(resolve(local, '003/cuentas-ficticias.json'), 'utf8')) as CuentaFicticia[];
  const c = cuentas.find(x => x.clave === clave);
  if (!c) throw new Error(`Falta la cuenta ficticia ${clave} de la semilla 003.`);
  return c;
}

/** Sesión por la API con una cuenta ficticia, para preparar los datos de cada recorrido. */
export class SesionApi {
  private constructor(private readonly api: APIRequestContext, private readonly token: string) {}
  static async entrar(api: APIRequestContext, clave: string) {
    const c = await cuenta(clave);
    const r = await api.post(`${origen}/api/v1/sesiones`, { data: { correo: c.correo, contrasena: c.contrasena }, headers: { Origin: origen } });
    expect(r.status()).toBe(200);
    return new SesionApi(api, ((await r.json()) as { tokenAcceso: string }).tokenAcceso);
  }
  private async enviar<T>(metodo: 'post' | 'patch', ruta: string, datos: object, esperado: number): Promise<T> {
    const r = await this.api[metodo](`${origen}/api/v1${ruta}`, { data: datos, headers: { Authorization: `Bearer ${this.token}`, Origin: origen, 'Idempotency-Key': crypto.randomUUID() } });
    expect(r.status(), await r.text()).toBe(esperado);
    return await r.json() as T;
  }
  private async leer<T>(ruta: string): Promise<T> {
    const r = await this.api.get(`${origen}/api/v1${ruta}`, { headers: { Authorization: `Bearer ${this.token}` } });
    expect(r.status()).toBe(200);
    return await r.json() as T;
  }
  /** Crea y publica una solicitud pública de la subcategoría A1 en Ayacucho (compatible con Beto). */
  async publicar(descripcion: string, extra: object = {}): Promise<{ solicitudId: string; version: number; versionTrabajo: number }> {
    const creada = await this.enviar<{ solicitudId: string; version: number }>('post', '/solicitudes', {
      tipo: 'PUBLICADA', descripcion, medidas: '3 m de largo por 2 m de alto', categoriaId: categoriaA1, distrito: 'ayacucho', fechaDesde: '2031-03-10', fechaHasta: '2031-03-20', ...extra,
    }, 201);
    return this.enviar('post', `/solicitudes/${creada.solicitudId}/publicacion`, { version: creada.version }, 200);
  }
  async editar(solicitudId: string, cambios: object): Promise<void> {
    const { version } = await this.leer<{ version: number }>(`/solicitudes/${solicitudId}`);
    await this.enviar('patch', `/solicitudes/${solicitudId}`, { version, ...cambios }, 200);
  }
  async cerrar(solicitudId: string): Promise<void> {
    const { version } = await this.leer<{ version: number }>(`/solicitudes/${solicitudId}`);
    await this.enviar('post', `/solicitudes/${solicitudId}/cierre`, { version }, 200);
  }
  async aclarar(cotizacionId: string, texto: string): Promise<void> {
    await this.enviar('post', `/cotizaciones/${cotizacionId}/aclaraciones`, { texto }, 201);
  }
  async cotizar(solicitudId: string, versionTrabajoSolicitud: number, extra: object = {}): Promise<{ cotizacionId: string }> {
    return this.enviar('post', `/solicitudes/${solicitudId}/cotizaciones`, {
      versionTrabajoSolicitud, tipo: 'ESTIMADA', alcance: 'Levantar el muro con acabado pulido.', formaCalculo: 'S/ 85 por metro cuadrado', vigenteHasta: '2031-12-31T00:00:00.000Z', ...extra,
    }, 201);
  }
}

export async function entrar(page: Page, clave: string, ruta: string, titulo: string | RegExp) {
  const c = await cuenta(clave);
  await page.goto(ruta);
  await page.getByLabel('Correo', { exact: true }).fill(c.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(c.contrasena);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
}

export async function comprobarAncho(page: Page) {
  const medidas = await page.evaluate(() => ({ contenido: document.documentElement.scrollWidth, ventana: innerWidth }));
  expect(medidas.contenido, `La pantalla desborda el viewport de ${medidas.ventana} px`).toBeLessThanOrEqual(medidas.ventana);
}

export async function captura(page: Page, info: TestInfo, nombre: string) {
  const directorio = resolve(process.env['E2E_EVIDENCIA'] ?? resolve(local, 'evidencia/003'), 'capturas', info.project.name);
  await mkdir(directorio, { recursive: true });
  await comprobarAncho(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: resolve(directorio, nombre + '.png'), fullPage: true });
}

/** Marca solo con letras: una con cifras se rechazaría como dato de contacto. */
export const marcaDe = (info: TestInfo) => `${info.project.name}${Date.now()}`.replace(/\d/g, d => 'abcdefghij'[Number(d)]!);
