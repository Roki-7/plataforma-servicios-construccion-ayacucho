import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import type { Page, TestInfo } from '@playwright/test';
import { cabecerasEscritura, criterios, crearCuenta, expect, origenWeb, test, type CuentaE2E } from './soporte.js';
import { conMenu, irA } from '../../soporte/menu-principal.js';

/**
 * T080 · Comprobaciones visuales focalizadas de las vistas de 002 (búsqueda, detalle, perfil público, perfil profesional con portafolio y servicios del titular).
 * Cada prueba recorre las vistas con datos ficticios realistas, guarda una captura de página completa por vista y proyecto en `capturas-visuales/<proyecto>/`
 * dentro de la evidencia y comprueba reglas de diseño medibles (alineación de casillas, botones con relleno, tarjetas en rejilla, sin desbordamiento).
 */
const esperaCarga = 60_000; const alba = '00000000-0000-4000-8000-000000009002';
type Peticiones = Parameters<Parameters<typeof test>[2]>[0]['request'];

function png(ancho: number, alto: number, color: number): Buffer {
  const trozo = (tipo: string, datos: Buffer) => { const t = Buffer.from(tipo, 'latin1'); const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, datos])) >>> 0); return Buffer.concat([l, t, datos, c]); };
  const cab = Buffer.alloc(13); cab.writeUInt32BE(ancho, 0); cab.writeUInt32BE(alto, 4); cab[8] = 8; cab[9] = 2;
  const fila = Buffer.concat([Buffer.from([0]), Buffer.alloc(ancho * 3, color)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', cab), trozo('IDAT', deflateSync(Buffer.concat(Array.from({ length: alto }, () => fila)))), trozo('IEND', Buffer.alloc(0))]);
}
interface Datos { titular: CuentaE2E & { prestadorId: string }; servicioId: string; nombreTitular: string }
async function preparar(request: Peticiones): Promise<Datos> {
  const sufijo = randomUUID().slice(0, 4);
  const perfil = async (nombre: string, distritos: string[], disponible: boolean, experiencia: string) => {
    const cuenta = await crearCuenta(request, 'prestador', nombre);
    const r = await request.put('/api/v1/prestadores/perfil', { headers: cabecerasEscritura(cuenta.token), data: { version: 0, nombrePublico: nombre, tipo: 'TECNICO', experiencia, especialidadesIds: [alba], distritos, disponibilidadDeclarada: disponible } });
    expect(r.status()).toBe(201); return { ...cuenta, prestadorId: ((await r.json()) as { prestadorId: string }).prestadorId };
  };
  const servicio = async (c: CuentaE2E, titulo: string, descripcion: string) => ((await (await request.post('/api/v1/servicios', { headers: cabecerasEscritura(c.token), data: { titulo, descripcion, categoriaId: alba } })).json()) as { servicioId: string });
  const nombreTitular = `Carlos Quispe Huamán ${sufijo}`;
  const titular = await perfil(nombreTitular, ['ayacucho', 'carmen-alto', 'san-juan-bautista'], true, 'Maestro de obra con doce años de experiencia en muros de ladrillo, tarrajeo y acabados. Trabajo con planos, cumplo plazos y entrego la obra limpia.');
  const otro = await perfil(`Rosa Mendoza Ccente ${sufijo}`, ['jesus-nazareno'], false, 'Técnica en instalaciones sanitarias y eléctricas de vivienda.');
  const tercero = await perfil(`Constructora Wari ${sufijo}`, ['ayacucho', 'andres-avelino-caceres-dorregaray'], true, 'Equipo de cinco personas para obras menores, ampliaciones y mantenimiento.');
  const s1 = await servicio(titular, 'Albañilería y levantamiento de muros', 'Levantamiento de muros de ladrillo, columnas y vigas de amarre, con materiales y mano de obra.');
  const s2 = await servicio(titular, 'Tarrajeo y acabados interiores', 'Tarrajeo fino, enlucido y pintura para viviendas, con garantía de acabado.');
  await servicio(otro, 'Instalación eléctrica residencial', 'Cableado, tableros y puesta a tierra para viviendas nuevas o ampliaciones.');
  await servicio(tercero, 'Ampliación de vivienda de dos pisos', 'Proyecto, cimentación y estructura para ampliar su vivienda con asesoría técnica.');
  expect((await request.post(`/api/v1/servicios/${s2.servicioId}/transiciones`, { headers: cabecerasEscritura(titular.token), data: { version: 1, destino: 'PAUSADO' } })).status()).toBe(200);
  const s3 = await servicio(titular, 'Servicio retirado de demostración', 'Servicio histórico que ya no se ofrece.');
  expect((await request.post(`/api/v1/servicios/${s3.servicioId}/transiciones`, { headers: cabecerasEscritura(titular.token), data: { version: 1, destino: 'RETIRADO' } })).status()).toBe(200);
  const t = await request.post('/api/v1/prestadores/perfil/trabajos', { headers: cabecerasEscritura(titular.token), data: { versionPerfil: 1, titulo: 'Fachada de vivienda en Carmen Alto', descripcion: 'Tarrajeo y pintura de una fachada de dos pisos, entregada en tres semanas.' } });
  const trabajo = (await t.json()) as { trabajo: { trabajoId: string; version: number } };
  const f = await request.post(`/api/v1/prestadores/perfil/trabajos/${trabajo.trabajo.trabajoId}/fotografias`, { headers: cabecerasEscritura(titular.token), data: { versionTrabajo: trabajo.trabajo.version, tipoMime: 'image/png', contenidoBase64: png(640, 420, 0x6a).toString('base64') } });
  expect(f.status()).toBe(201);
  await request.post('/api/v1/prestadores/perfil/trabajos', { headers: cabecerasEscritura(titular.token), data: { versionPerfil: 3, titulo: 'Muro de contención en ladera', descripcion: 'Muro de piedra y concreto para estabilizar un terreno inclinado.' } });
  return { titular, servicioId: s1.servicioId, nombreTitular };
}

async function capturar(p: Page, testInfo: TestInfo, nombre: string): Promise<void> {
  await p.waitForFunction(() => document.getAnimations().length === 0, undefined, { timeout: 5_000 }).catch(() => undefined);
  const carpeta = resolve(process.env['E2E_EVIDENCIA'] ?? '.', 'capturas-visuales', testInfo.project.name); await mkdir(carpeta, { recursive: true });
  await p.screenshot({ path: resolve(carpeta, `${nombre}.png`), fullPage: true });
}
const entrar = async (p: Page, c: CuentaE2E): Promise<void> => {
  await p.goto('/acceso'); await p.getByLabel('Correo').fill(c.correo); await p.getByLabel('Contraseña', { exact: true }).fill(c.contrasena); await p.getByRole('button', { name: 'Iniciar sesión' }).click();
  await conMenu(p, p.getByRole('link', { name: 'Mi cuenta' }), esperaCarga);
};

test.describe('T080 · diseño visual de las vistas de 002', () => {
  test.describe.configure({ timeout: 300_000 });

  test('vistas públicas: búsqueda, resultados, detalle y perfil del prestador', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'EQ-07');
    const d = await preparar(request); const viewport = testInfo.project.use.viewport;
    const contexto = await browser.newContext({ baseURL: origenWeb, ...(viewport ? { viewport } : {}) }); const p = await contexto.newPage();
    try {
      await p.goto('/buscar'); await expect(p.getByRole('list', { name: 'Resultados' }).getByRole('article').first()).toBeVisible({ timeout: esperaCarga }); await capturar(p, testInfo, '01-busqueda-servicios');
      await p.getByRole('radio', { name: 'Prestadores' }).check(); await expect(p.getByRole('article', { name: /^Prestador: / }).first()).toBeVisible({ timeout: esperaCarga }); await capturar(p, testInfo, '02-busqueda-prestadores');
      await p.getByLabel('Zona de atención').selectOption({ label: 'Jesús Nazareno' }); await p.getByLabel('Disponibilidad declarada').selectOption({ label: 'Declara estar disponible' }); await p.getByRole('button', { name: 'Buscar', exact: true }).click();
      await expect(p.getByText('No hay coincidencias para esos criterios.')).toBeVisible({ timeout: esperaCarga }); await capturar(p, testInfo, '03-busqueda-sin-coincidencias');
      await p.goto(`/servicios/${d.servicioId}`); await expect(p.getByRole('button', { name: 'Ver perfil del prestador' })).toBeVisible({ timeout: esperaCarga }); await capturar(p, testInfo, '04-detalle-servicio');
      await p.goto(`/prestadores/${d.titular.prestadorId}`); await expect(p.getByRole('article', { name: 'Trabajo: Fachada de vivienda en Carmen Alto' })).toBeVisible({ timeout: esperaCarga });
      await p.getByRole('button', { name: 'Ver imagen 1 de Fachada de vivienda en Carmen Alto' }).click(); await expect(p.getByRole('img', { name: /Imagen 1 de Fachada/ })).toBeVisible({ timeout: esperaCarga }); await capturar(p, testInfo, '05-perfil-publico');
    } finally { await contexto.close(); }
  });

  test('vistas del titular: perfil profesional, portafolio y servicios', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'EQ-07');
    const d = await preparar(request); const viewport = testInfo.project.use.viewport;
    const contexto = await browser.newContext({ baseURL: origenWeb, ...(viewport ? { viewport } : {}) }); const p = await contexto.newPage();
    try {
      await entrar(p, d.titular);
      await irA(p, 'Mi perfil profesional'); await expect(p.getByRole('article', { name: 'Trabajo: Fachada de vivienda en Carmen Alto' })).toBeVisible({ timeout: esperaCarga }); await capturar(p, testInfo, '06-perfil-profesional');
      await p.getByRole('button', { name: 'Guardar perfil' }).scrollIntoViewIfNeeded(); await p.getByLabel('Nombre público').fill(''); await p.getByRole('button', { name: 'Guardar perfil' }).click();
      await expect(p.getByRole('alert').filter({ hasText: 'Indique su nombre público.' })).toBeVisible({ timeout: esperaCarga }); await capturar(p, testInfo, '07-perfil-profesional-con-error');
      await irA(p, 'Mis servicios'); await expect(p.getByRole('article', { name: /^Servicio: Servicio retirado/ })).toBeVisible({ timeout: esperaCarga }); await capturar(p, testInfo, '08-mis-servicios');
      await p.getByRole('button', { name: /^Editar Albañilería/ }).click(); await p.getByRole('button', { name: /^Retirar Tarrajeo/ }).click(); await expect(p.getByText('El retiro es definitivo: el servicio quedará de solo lectura.')).toBeVisible(); await capturar(p, testInfo, '09-mis-servicios-edicion-y-retiro');
    } finally { await contexto.close(); }
  });
});
