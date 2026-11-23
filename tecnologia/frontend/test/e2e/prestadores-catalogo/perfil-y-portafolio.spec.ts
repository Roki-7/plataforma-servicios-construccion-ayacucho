import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRequestContext, Locator, Page, TestInfo } from '@playwright/test';
import { cabecerasEscritura, criterios, crearCuenta, expect, origenWeb, registrarEvidencia, test, type CuentaE2E } from './soporte.js';

/**
 * T076 · Recorridos de HU03 (perfil profesional y portafolio) en Chromium, Firefox y WebKit a 360, 768 y 1366 px, sobre HTTPS con la CA 002 y una base descartable por corrida.
 * El titular usa la interfaz web real; la cuenta ajena, la cuenta solo cliente y el visitante se comprueban también por la API pública, y los límites pesados por la API.
 * Cada prueba declara los criterios CA-PRE que demuestra (el reporte los agrega por proyecto) y adjunta los hechos verificables que conserva en `hu03/<proyecto>/`.
 * Todos los datos son ficticios; las imágenes salen del corpus que genera el ejecutor.
 */
const dirImagenes = (): string => process.env['E2E_IMAGENES_002'] ?? '';
const dirSenales = (): string => process.env['E2E_SENALES_002'] ?? '';
const leerImagen = (nombre: string): Promise<Buffer> => readFile(join(dirImagenes(), nombre));
const rutaImagen = (nombre: string): string => join(dirImagenes(), nombre);
const mimeDe = (nombre: string): string => (nombre.endsWith('.png') ? 'image/png' : nombre.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const pausa = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const zonasValidas = ['ayacucho', 'carmen-alto'];
interface PerfilApi { prestadorId: string; version: number; nombrePublico: string; distritos: string[]; disponibilidadDeclarada: boolean; trabajos: TrabajoApi[] }
interface TrabajoApi { trabajoId: string; version: number; titulo: string; fotografias: { fotografiaId: string; ancho: number; alto: number }[] }

async function especialidadAlbanileria(request: APIRequestContext): Promise<string> {
  const r = await request.get('/api/v1/categorias'); expect(r.status()).toBe(200);
  const id = ((await r.json()) as { categorias: { categoriaId: string; nombre: string }[] }).categorias.find((c) => c.nombre === 'Albañilería')?.categoriaId;
  expect(id, 'la semilla debe contener la categoría Albañilería').toBeTruthy();
  return id!;
}
const cuerpoPerfil = (especialidad: string, version: number, extra: object = {}) => ({ version, nombrePublico: 'Maestro de obra ficticio', tipo: 'TECNICO', experiencia: 'Diez años de experiencia ficticia en obra.', especialidadesIds: [especialidad], distritos: ['ayacucho'], disponibilidadDeclarada: true, ...extra });
async function obtenerPerfil(request: APIRequestContext, token: string): Promise<PerfilApi> {
  const r = await request.get('/api/v1/prestadores/perfil', { headers: { authorization: `Bearer ${token}` } }); expect(r.status()).toBe(200); return (await r.json()) as PerfilApi;
}
async function crearPerfilApi(request: APIRequestContext, token: string, especialidad: string): Promise<PerfilApi> {
  const r = await request.put('/api/v1/prestadores/perfil', { headers: cabecerasEscritura(token), data: cuerpoPerfil(especialidad, 0) }); expect(r.status()).toBe(201); return (await r.json()) as PerfilApi;
}
async function crearTrabajoApi(request: APIRequestContext, token: string, versionPerfil: number, titulo: string): Promise<{ trabajoId: string; version: number; versionPerfil: number }> {
  const r = await request.post('/api/v1/prestadores/perfil/trabajos', { headers: cabecerasEscritura(token), data: { versionPerfil, titulo, descripcion: 'Trabajo ficticio del recorrido E2E.' } });
  expect(r.status()).toBe(201); const j = (await r.json()) as { trabajo: { trabajoId: string; version: number }; versionPerfil: number };
  return { trabajoId: j.trabajo.trabajoId, version: j.trabajo.version, versionPerfil: j.versionPerfil };
}
async function agregarFotoApi(request: APIRequestContext, token: string, trabajoId: string, versionTrabajo: number, archivo: string, mime = mimeDe(archivo)) {
  return request.post(`/api/v1/prestadores/perfil/trabajos/${trabajoId}/fotografias`, { headers: cabecerasEscritura(token), data: { versionTrabajo, tipoMime: mime, contenidoBase64: (await leerImagen(archivo)).toString('base64') }, timeout: 90_000 });
}
async function trabajoConFotos(request: APIRequestContext, cuenta: CuentaE2E, especialidad: string, titulo: string, archivos: string[]) {
  const perfil = await crearPerfilApi(request, cuenta.token, especialidad); const t = await crearTrabajoApi(request, cuenta.token, perfil.version, titulo);
  let version = t.version; const fotos: string[] = [];
  for (const a of archivos) { const r = await agregarFotoApi(request, cuenta.token, t.trabajoId, version, a); expect(r.status(), `alta de ${a}`).toBe(201); const j = (await r.json()) as { fotografia: { fotografiaId: string }; versionTrabajo: number }; version = j.versionTrabajo; fotos.push(j.fotografia.fotografiaId); }
  return { prestadorId: perfil.prestadorId, trabajoId: t.trabajoId, version, fotos };
}
const fotoPublica = (request: APIRequestContext, prestadorId: string, trabajoId: string, fotoId: string) => request.get(`/api/v1/prestadores/${prestadorId}/trabajos/${trabajoId}/fotografias/${fotoId}`);

/** Un WebP público saneado: contenedor RIFF/WEBP solo con fragmentos de imagen, sin EXIF, XMP ni perfil ICC, y sin el marcador sensible ni coordenadas. */
function inspeccionarWebp(bytes: Buffer, marcador: string): { fragmentos: string[]; sinMetadatos: boolean; sinMarcador: boolean } {
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF'); expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
  const fragmentos: string[] = []; let o = 12;
  while (o + 8 <= bytes.length) { fragmentos.push(bytes.subarray(o, o + 4).toString('latin1')); const largo = bytes.readUInt32LE(o + 4); o += 8 + largo + (largo % 2); }
  const sinMetadatos = !fragmentos.some((f) => ['EXIF', 'XMP ', 'ICCP'].includes(f)) && !bytes.includes(Buffer.from('Exif'));
  const sinMarcador = !bytes.includes(Buffer.from(marcador));
  expect(sinMetadatos, `fragmentos ${fragmentos.join(',')}`).toBe(true); expect(sinMarcador).toBe(true);
  return { fragmentos, sinMetadatos, sinMarcador };
}
async function marcadorSensible(): Promise<string> { return (JSON.parse(await readFile(join(dirImagenes(), 'manifiesto.json'), 'utf8')) as { marcadorSensible: string }).marcadorSensible; }

// --- Interfaz del titular ---
async function iniciarSesionEnFormulario(page: Page, cuenta: CuentaE2E): Promise<void> {
  await page.getByLabel('Correo').fill(cuenta.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(cuenta.contrasena);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
async function abrirPerfilProfesional(page: Page, cuenta: CuentaE2E): Promise<void> {
  await page.goto('/acceso'); await iniciarSesionEnFormulario(page, cuenta);
  await page.getByRole('link', { name: 'Mi perfil profesional' }).click();
  await expect(page.getByRole('heading', { name: 'Mi perfil profesional' })).toBeVisible();
}
/** Recarga la página: si la sesión en memoria se pierde, vuelve a iniciar sesión por el formulario y regresa a la misma ruta profesional. */
async function recargarPerfil(page: Page, cuenta: CuentaE2E): Promise<void> {
  await page.reload();
  const perfil = page.getByRole('heading', { name: 'Mi perfil profesional' }); const acceso = page.getByRole('heading', { name: 'Iniciar sesión' });
  await expect(perfil.or(acceso)).toBeVisible({ timeout: esperaEscritura });
  if (await acceso.isVisible()) { await iniciarSesionEnFormulario(page, cuenta); }
  await expect(perfil).toBeVisible();
}
const trabajoUi = (page: Page, titulo: string): Locator => page.getByRole('article', { name: `Trabajo: ${titulo}` });
async function agregarTrabajoUi(page: Page, testInfo: TestInfo, titulo: string): Promise<void> {
  await escribirUi(page, testInfo, async () => {
    await page.getByLabel('Título del trabajo').fill(titulo); await page.getByLabel('Descripción del trabajo').fill('Trabajo ficticio del recorrido E2E.');
    await page.getByRole('button', { name: 'Agregar trabajo' }).click();
  }, 'Trabajo agregado.');
  await expect(trabajoUi(page, titulo)).toBeVisible();
}
async function subirUi(page: Page, titulo: string, archivo: string): Promise<void> {
  const campo = page.getByLabel(`Agregar fotografía a ${titulo}`); await expect(campo).toBeEnabled(); await campo.setInputFiles(rutaImagen(archivo));
}
const subirYEsperarUi = (page: Page, testInfo: TestInfo, titulo: string, archivo: string): Promise<void> => escribirUi(page, testInfo, () => subirUi(page, titulo, archivo), 'Fotografía agregada.');
/** La infraestructura compartida del host puede detenerse decenas de segundos al sincronizar el disco: las confirmaciones de escritura esperan hasta un minuto. */
const esperaEscritura = 60_000;
const conteoFotos = (page: Page, titulo: string, n: number): Promise<void> => expect(trabajoUi(page, titulo).getByText(`${n} de 4 fotografías`)).toBeVisible({ timeout: esperaEscritura });
const estadoUi = (page: Page, texto: string): Locator => page.getByRole('status').filter({ hasText: texto });
const esperarEstado = (page: Page, texto: string): Promise<void> => expect(estadoUi(page, texto)).toBeVisible({ timeout: esperaEscritura });
/**
 * Ejecuta una operación de escritura de la interfaz. Si el servidor responde 503 «El servicio no está disponible por ahora… reintente» (indisponibilidad transitoria de una
 * dependencia, que la propia aplicación indica reintentar), se reintenta UNA vez y se deja constancia en la prueba; cualquier otro resultado se evalúa sin reintento.
 */
async function escribirUi(page: Page, testInfo: TestInfo, accion: () => Promise<void>, exito: string): Promise<void> {
  for (let intento = 0; intento < 2; intento += 1) {
    await accion();
    const bien = estadoUi(page, exito); const indisponible = page.getByRole('alert').filter({ hasText: 'El servicio no está disponible por ahora' });
    await expect(bien.or(indisponible).first()).toBeVisible({ timeout: esperaEscritura });
    if (await bien.isVisible()) return;
    if (intento === 0) testInfo.annotations.push({ type: 'reintento-transitorio', description: `${exito} tras indisponibilidad transitoria de una dependencia` });
  }
  await expect(estadoUi(page, exito)).toBeVisible({ timeout: 1_000 });
}
const reintentos = (testInfo: TestInfo): number => testInfo.annotations.filter((a) => a.type === 'reintento-transitorio').length;
const evidencia = (testInfo: TestInfo, nombre: string, datos: object): Promise<void> => registrarEvidencia(testInfo, nombre, { ...datos, reintentosPorIndisponibilidadTransitoria: reintentos(testInfo) });

/** Escribe una señal de forma atómica (archivo temporal y renombrado): el agente nunca lee un archivo a medias. */
async function escribirSenal(ruta: string, datos: object): Promise<void> { await writeFile(`${ruta}.tmp`, JSON.stringify(datos)); await rename(`${ruta}.tmp`, ruta); }

/** Espera un archivo de señal del agente de retención; si aparece el archivo de error, falla con su contenido. */
async function esperarSenal(ruta: string, rutaError: string, ms = 40_000): Promise<unknown> {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const contenido = await readFile(ruta, 'utf8').then((t) => t, () => undefined);
    if (contenido !== undefined) { try { return JSON.parse(contenido) as unknown; } catch { /* escritura aún en curso: se vuelve a leer */ } }
    const error = await readFile(rutaError, 'utf8').then((t) => t, () => undefined);
    if (error !== undefined) throw new Error(`El agente de retención informó un error: ${error}`);
    await pausa(100);
  }
  throw new Error(`Tiempo agotado esperando la señal ${ruta}.`);
}

test.describe('HU03 · perfil profesional y portafolio del titular', () => {
  // Recorridos largos (varias operaciones reales de interfaz y API) que pueden coincidir con pausas de E/S del host: margen amplio por prueba, sin relajar ninguna aserción.
  test.describe.configure({ timeout: 240_000 });
  test('CA-PRE-01 y CA-PRE-02 · el titular guarda su perfil por la web, al volver a consultarlo se conserva y una zona inválida no altera lo guardado', async ({ page, request }, testInfo) => {
    criterios(testInfo, 'CA-PRE-01', 'CA-PRE-02');
    const cuenta = await crearCuenta(request, 'prestador', 'Titular ficticio HU03'); await abrirPerfilProfesional(page, cuenta);
    // CA-PRE-01: alta del perfil por la interfaz.
    await page.getByLabel('Nombre público').fill('Maestro Quispe ficticio'); await page.getByLabel('Tipo de prestador').selectOption('PROFESIONAL');
    await page.getByLabel('Experiencia').fill('Doce años de experiencia ficticia en albañilería y acabados.');
    await page.getByRole('checkbox', { name: 'Albañilería' }).check();
    await page.getByRole('checkbox', { name: 'Ayacucho', exact: true }).check(); await page.getByRole('checkbox', { name: 'Carmen Alto' }).check();
    await page.getByRole('checkbox', { name: 'Disponible para nuevos trabajos' }).uncheck();
    await page.getByRole('button', { name: 'Guardar perfil' }).click(); await esperarEstado(page, 'Perfil guardado.');
    await agregarTrabajoUi(page, testInfo, 'Fachada de ficticia calle 28 de Julio');
    // Al volver a consultar el perfil (recarga completa) se muestra lo guardado.
    await recargarPerfil(page, cuenta);
    await expect(page.getByLabel('Nombre público')).toHaveValue('Maestro Quispe ficticio'); await expect(page.getByLabel('Tipo de prestador')).toHaveValue('PROFESIONAL');
    await expect(page.getByLabel('Experiencia')).toHaveValue('Doce años de experiencia ficticia en albañilería y acabados.');
    await expect(page.getByRole('checkbox', { name: 'Albañilería' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Ayacucho', exact: true })).toBeChecked(); await expect(page.getByRole('checkbox', { name: 'Carmen Alto' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'San Juan Bautista' })).not.toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Disponible para nuevos trabajos' })).not.toBeChecked();
    await expect(trabajoUi(page, 'Fachada de ficticia calle 28 de Julio')).toBeVisible();
    const guardado = await obtenerPerfil(request, cuenta.token);
    expect(guardado).toMatchObject({ nombrePublico: 'Maestro Quispe ficticio', tipo: 'PROFESIONAL', distritos: zonasValidas, disponibilidadDeclarada: false });
    expect(guardado.trabajos.map((t) => t.titulo)).toEqual(['Fachada de ficticia calle 28 de Julio']);
    // La interfaz exige al menos una zona antes de enviar nada.
    await page.getByRole('checkbox', { name: 'Ayacucho', exact: true }).uncheck(); await page.getByRole('checkbox', { name: 'Carmen Alto' }).uncheck();
    await page.getByRole('button', { name: 'Guardar perfil' }).click(); await expect(page.getByRole('alert').filter({ hasText: 'Seleccione entre uno y cinco distritos.' })).toBeVisible();
    expect((await obtenerPerfil(request, cuenta.token)).version).toBe(guardado.version);

    // CA-PRE-02: una zona fuera de los cinco distritos se rechaza indicando cuál y conserva lo guardado.
    const especialidad = await especialidadAlbanileria(request);
    const invalida = await request.put('/api/v1/prestadores/perfil', { headers: cabecerasEscritura(cuenta.token), data: cuerpoPerfil(especialidad, guardado.version, { distritos: ['ayacucho', 'lima'] }) });
    const error = (await invalida.json()) as { codigo: string; detalles: { campo: string; motivo: string }[] };
    expect(invalida.status()).toBe(400); expect(error.codigo).toBe('DATOS_INVALIDOS'); expect(error.detalles).toEqual([{ campo: 'distritos[1]', motivo: 'Valor no admitido.' }]);
    const conservado = await obtenerPerfil(request, cuenta.token);
    expect(conservado).toMatchObject({ version: guardado.version, distritos: zonasValidas, nombrePublico: 'Maestro Quispe ficticio' });
    await recargarPerfil(page, cuenta); await expect(page.getByRole('checkbox', { name: 'Carmen Alto' })).toBeChecked();
    await evidencia(testInfo, 'ca-pre-01-02', { perfilVersion: guardado.version, distritosGuardados: conservado.distritos, rechazoZona: { http: invalida.status(), codigo: error.codigo, detalles: error.detalles }, versionTrasRechazo: conservado.version });
  });

  test('CA-PRE-03 · visitante, cuenta solo cliente y prestador ajeno son rechazados y los datos y fotos protegidas se conservan', async ({ page, request }, testInfo) => {
    criterios(testInfo, 'CA-PRE-03');
    const especialidad = await especialidadAlbanileria(request);
    const titular = await crearCuenta(request, 'prestador', 'Titular ficticio HU03'); const tituloTitular = 'Trabajo protegido del titular';
    const datos = await trabajoConFotos(request, titular, especialidad, tituloTitular, ['valida.jpg']);
    const antes = await obtenerPerfil(request, titular.token); const fotoAntes = await (await fotoPublica(request, datos.prestadorId, datos.trabajoId, datos.fotos[0]!)).json() as { contenidoBase64: string };
    const huellaAntes = sha256(Buffer.from(fotoAntes.contenidoBase64, 'base64'));
    const cliente = await crearCuenta(request, 'cliente', 'Cliente ficticio'); const ajeno = await crearCuenta(request, 'prestador', 'Prestador ajeno ficticio'); await crearPerfilApi(request, ajeno.token, especialidad);
    const resultados: Record<string, number> = {};
    const intento = async (nombre: string, r: { status(): number; json(): Promise<unknown> }, permitidos: number[]) => { resultados[nombre] = r.status(); expect(permitidos, `${nombre}: ${r.status()} ${JSON.stringify(await r.json().catch(() => null))}`).toContain(r.status()); };
    const imagen = (await leerImagen('valida.png')).toString('base64'); const rutaFotos = `/api/v1/prestadores/perfil/trabajos/${datos.trabajoId}/fotografias`; const rutaFoto = `${rutaFotos}/${datos.fotos[0]}`;
    const cuerpoFoto = { versionTrabajo: datos.version, tipoMime: 'image/png', contenidoBase64: imagen };
    // Visitante sin sesión.
    await intento('visitante crea perfil', await request.put('/api/v1/prestadores/perfil', { headers: cabecerasEscritura(), data: cuerpoPerfil(especialidad, 0) }), [401]);
    await intento('visitante agrega foto', await request.post(rutaFotos, { headers: cabecerasEscritura(), data: cuerpoFoto }), [401]);
    await intento('visitante reemplaza foto', await request.put(rutaFoto, { headers: cabecerasEscritura(), data: cuerpoFoto }), [401]);
    await intento('visitante elimina foto', await request.delete(`${rutaFoto}?version=${datos.version}`, { headers: cabecerasEscritura() }), [401]);
    // Cuenta solo cliente (sin perfil de prestador).
    await intento('cliente crea perfil', await request.put('/api/v1/prestadores/perfil', { headers: cabecerasEscritura(cliente.token), data: cuerpoPerfil(especialidad, 0) }), [403]);
    await intento('cliente agrega foto', await request.post(rutaFotos, { headers: cabecerasEscritura(cliente.token), data: cuerpoFoto }), [403, 404]);
    // Prestador ajeno sobre el portafolio del titular.
    await intento('ajeno agrega foto', await request.post(rutaFotos, { headers: cabecerasEscritura(ajeno.token), data: cuerpoFoto }), [403, 404]);
    await intento('ajeno reemplaza foto', await request.put(rutaFoto, { headers: cabecerasEscritura(ajeno.token), data: cuerpoFoto }), [403, 404]);
    await intento('ajeno elimina foto', await request.delete(`${rutaFoto}?version=${datos.version}`, { headers: cabecerasEscritura(ajeno.token) }), [403, 404]);
    // Nada cambió: perfil, versión, fotografías y archivo público.
    const despues = await obtenerPerfil(request, titular.token);
    expect(despues).toMatchObject({ version: antes.version }); expect(despues.trabajos).toEqual(antes.trabajos);
    const fotoDespues = await (await fotoPublica(request, datos.prestadorId, datos.trabajoId, datos.fotos[0]!)).json() as { contenidoBase64: string };
    expect(sha256(Buffer.from(fotoDespues.contenidoBase64, 'base64'))).toBe(huellaAntes);
    // En la web el prestador ajeno solo ve su propio portafolio.
    await abrirPerfilProfesional(page, ajeno);
    await expect(page.getByText(tituloTitular)).toHaveCount(0); await expect(page.getByRole('article')).toHaveCount(0);
    await evidencia(testInfo, 'ca-pre-03', { rechazos: resultados, versionTitular: despues.version, fotografiasTitular: despues.trabajos[0]?.fotografias.length, huellaFotoSinCambios: sha256(Buffer.from(fotoDespues.contenidoBase64, 'base64')) === huellaAntes });
  });

  test('CA-PRE-04 · el titular adjunta JPG, PNG y WEBP válidos (incluidos 10 MB y 4096 px) y cada archivo inválido se rechaza con su causa', async ({ page, request }, testInfo) => {
    criterios(testInfo, 'CA-PRE-04'); test.setTimeout(240_000);
    const especialidad = await especialidadAlbanileria(request); const cuenta = await crearCuenta(request, 'prestador'); await crearPerfilApi(request, cuenta.token, especialidad);
    await abrirPerfilProfesional(page, cuenta);
    const formatos = 'Trabajo de formatos'; const limites = 'Trabajo de límites'; const invalidos = 'Trabajo de rechazos';
    for (const t of [formatos, limites, invalidos]) await agregarTrabajoUi(page, testInfo, t);
    // Válidos: JPG, PNG y WEBP (casos separados) y 4096 px por lado.
    for (const [i, archivo] of ['valida.jpg', 'valida.png', 'valida.webp', 'limite-4096.png'].entries()) { await subirYEsperarUi(page, testInfo, formatos, archivo); await conteoFotos(page, formatos, i + 1); }
    // Válido de exactamente 10 000 000 bytes.
    await subirYEsperarUi(page, testInfo, limites, 'limite-10mb.png'); await conteoFotos(page, limites, 1);
    // Inválidos: cada uno indica su causa y conserva las imágenes ya vinculadas.
    await subirYEsperarUi(page, testInfo, invalidos, 'valida.jpg'); await conteoFotos(page, invalidos, 1);
    const rechazos: Record<string, string> = {};
    for (const [archivo, causa] of [['gif-con-extension.jpg', 'El formato real del archivo no es JPG, PNG ni WEBP.'], ['tiff-con-extension.png', 'El formato real del archivo no es JPG, PNG ni WEBP.'],
      ['ancho-4097.png', 'La imagen supera 4096 píxeles por lado.'], ['alto-4097.png', 'La imagen supera 4096 píxeles por lado.'], ['mayor-10mb.png', 'La imagen supera el límite de 10 MB.']] as const) {
      await subirUi(page, invalidos, archivo);
      const alerta = page.getByRole('alert').filter({ hasText: causa }); await expect(alerta, archivo).toBeVisible(); rechazos[archivo] = causa;
      await conteoFotos(page, invalidos, 1);
    }
    // El servidor también rechaza por sí mismo el archivo de más de 10 MB (sin depender de la validación del navegador).
    const perfilActual = await obtenerPerfil(request, cuenta.token); const trabajo = perfilActual.trabajos.find((t) => t.titulo === invalidos)!;
    const servidor = await agregarFotoApi(request, cuenta.token, trabajo.trabajoId, trabajo.version, 'mayor-10mb.png');
    const errorServidor = (await servidor.json()) as { codigo: string };
    expect(servidor.status()).toBe(413); expect(errorServidor.codigo).toBe('ARCHIVO_DEMASIADO_GRANDE');
    const final = await obtenerPerfil(request, cuenta.token);
    expect(final.trabajos.find((t) => t.titulo === invalidos)!.fotografias).toHaveLength(1);
    expect(final.trabajos.find((t) => t.titulo === formatos)!.fotografias).toHaveLength(4);
    await evidencia(testInfo, 'ca-pre-04', { aceptadas: ['valida.jpg', 'valida.png', 'valida.webp', 'limite-4096.png (4096x4096)', 'limite-10mb.png (10000000 bytes)'], rechazadasEnLaWeb: rechazos, rechazoDelServidor: { http: servidor.status(), codigo: errorServidor.codigo }, fotografiasConservadas: final.trabajos.find((t) => t.titulo === invalidos)!.fotografias.length });
  });

  test('CA-PRE-05 · el portafolio admite hasta diez trabajos y cuarenta fotos y rechaza cada intento de superarlos', async ({ page, request }, testInfo) => {
    criterios(testInfo, 'CA-PRE-05'); test.setTimeout(300_000);
    const especialidad = await especialidadAlbanileria(request); const cuenta = await crearCuenta(request, 'prestador'); const inicial = await crearPerfilApi(request, cuenta.token, especialidad);
    // Nueve trabajos de cuatro fotos cada uno (API); el décimo y sus cuatro fotos se registran por la web.
    let versionPerfil = inicial.version;
    for (let n = 1; n <= 9; n += 1) {
      const t = await crearTrabajoApi(request, cuenta.token, versionPerfil, `Trabajo ${n} del portafolio`); versionPerfil = t.versionPerfil; let v = t.version;
      for (let f = 0; f < 4; f += 1) { const r = await agregarFotoApi(request, cuenta.token, t.trabajoId, v, 'valida.jpg'); expect(r.status()).toBe(201); v = ((await r.json()) as { versionTrabajo: number }).versionTrabajo; }
    }
    await abrirPerfilProfesional(page, cuenta); await expect(page.getByRole('article')).toHaveCount(9);
    const decimo = 'Trabajo 10 del portafolio'; await agregarTrabajoUi(page, testInfo, decimo);
    for (let f = 1; f <= 4; f += 1) { await subirYEsperarUi(page, testInfo, decimo, 'valida.png'); await conteoFotos(page, decimo, f); }
    // Límites visibles en la interfaz: no se puede registrar un undécimo trabajo ni una quinta foto.
    await expect(page.getByRole('button', { name: 'Agregar trabajo' })).toBeDisabled(); await expect(page.getByLabel('Título del trabajo')).toBeDisabled();
    await expect(page.getByText('El portafolio admite hasta 10 trabajos.')).toBeVisible();
    await expect(page.getByLabel(`Agregar fotografía a ${decimo}`)).toBeDisabled(); await expect(trabajoUi(page, decimo).getByText('Este trabajo ya tiene el máximo de 4 fotografías.')).toBeVisible();
    // Y el servidor los rechaza por sí mismo, informando el límite y conservando los datos.
    const completo = await obtenerPerfil(request, cuenta.token); const ultimo = completo.trabajos.find((t) => t.titulo === decimo)!;
    const undecimo = await request.post('/api/v1/prestadores/perfil/trabajos', { headers: cabecerasEscritura(cuenta.token), data: { versionPerfil: completo.version, titulo: 'Trabajo 11 del portafolio', descripcion: 'No debe registrarse.' } });
    const quinta = await agregarFotoApi(request, cuenta.token, ultimo.trabajoId, ultimo.version, 'valida.jpg');
    const eUndecimo = (await undecimo.json()) as { codigo: string; mensaje: string; detalles: { motivo: string }[] }; const eQuinta = (await quinta.json()) as { codigo: string; mensaje: string; detalles: { motivo: string }[] };
    expect([undecimo.status(), eUndecimo.codigo]).toEqual([422, 'LIMITE_PORTAFOLIO']); expect([quinta.status(), eQuinta.codigo]).toEqual([422, 'LIMITE_PORTAFOLIO']);
    expect(`${eUndecimo.mensaje} ${eUndecimo.detalles.map((d) => d.motivo).join(' ')}`).toMatch(/10|diez/i); expect(`${eQuinta.mensaje} ${eQuinta.detalles.map((d) => d.motivo).join(' ')}`).toMatch(/4|cuatro|40|cuarenta/i);
    const final = (await obtenerPerfil(request, cuenta.token)).trabajos;
    expect(final).toHaveLength(10); expect(final.reduce((n, t) => n + t.fotografias.length, 0)).toBe(40);
    await evidencia(testInfo, 'ca-pre-05', { trabajos: final.length, fotografias: final.reduce((n, t) => n + t.fotografias.length, 0), rechazoUndecimoTrabajo: { http: undecimo.status(), codigo: eUndecimo.codigo, mensaje: eUndecimo.mensaje }, rechazoQuintaFoto: { http: quinta.status(), codigo: eQuinta.codigo, mensaje: eQuinta.mensaje } });
  });

  test('CA-PRE-06 · una foto con GPS no es pública mientras su alta está pendiente y después se entrega solo el WebP saneado, sin metadatos sensibles', async ({ request, browser }, testInfo) => {
    criterios(testInfo, 'CA-PRE-06'); test.setTimeout(180_000);
    const marcador = await marcadorSensible(); const titulo = 'Trabajo con fotografía sensible';
    const especialidad = await especialidadAlbanileria(request); const titular = await crearCuenta(request, 'prestador', 'Titular ficticio HU03');
    const perfil = await crearPerfilApi(request, titular.token, especialidad); const trabajo = await crearTrabajoApi(request, titular.token, perfil.version, titulo);
    const original = await leerImagen('sensible.jpg'); expect(original.includes(Buffer.from(marcador)), 'el original debe contener el marcador sensible de prueba').toBe(true);
    // Antes de empezar: un visitante en el navegador ve el trabajo sin ninguna fotografía.
    const visitante = await browser.newContext({ baseURL: origenWeb, ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}) }); const pagina = await visitante.newPage();
    const token = randomUUID().replaceAll('-', ''); const senal = (nombre: string) => join(dirSenales(), `${nombre}-${token}.json`);
    try {
      await pagina.goto(`/prestadores/${perfil.prestadorId}`); await expect(pagina.getByRole('article', { name: `Trabajo: ${titulo}` })).toBeVisible();
      await expect(pagina.getByRole('button', { name: /^Ver imagen/ })).toHaveCount(0);
      // El agente del ejecutor retiene la confirmación (bloqueo del perfil en la base descartable): el objeto se escribe pero aún no se vincula.
      // La aplicación espera ese bloqueo como máximo 5 s (lock_timeout), por lo que la ventana pendiente solo hace comprobaciones rápidas por la API.
      await escribirSenal(senal('retener'), { prestadorId: perfil.prestadorId });
      await esperarSenal(senal('retenida'), senal('error'));
      const alta = request.post(`/api/v1/prestadores/perfil/trabajos/${trabajo.trabajoId}/fotografias`, { headers: cabecerasEscritura(titular.token), data: { versionTrabajo: trabajo.version, tipoMime: 'image/jpeg', contenidoBase64: original.toString('base64') }, timeout: 90_000 });
      const pendiente = await esperarSenal(senal('pendiente'), senal('error')) as { fotografiaId: string | null };
      expect(pendiente.fotografiaId, 'el agente debe observar el objeto pendiente').toBeTruthy();
      const antes = await fotoPublica(request, perfil.prestadorId, trabajo.trabajoId, pendiente.fotografiaId!); const textoAntes = await antes.text();
      const listadoPendiente = (await obtenerPerfil(request, titular.token)).trabajos[0]!.fotografias.length;
      await escribirSenal(senal('liberar'), {}); await esperarSenal(senal('liberada'), senal('error'));
      expect(antes.status()).toBe(404); expect((JSON.parse(textoAntes) as { codigo: string }).codigo).toBe('RECURSO_NO_DISPONIBLE'); expect(textoAntes).not.toContain('contenidoBase64');
      expect(listadoPendiente, 'el portafolio no lista la alta pendiente').toBe(0);
      // Se completó la confirmación.
      const respuestaAlta = await alta; expect(respuestaAlta.status()).toBe(201);
      const confirmada = (await respuestaAlta.json()) as { fotografia: { fotografiaId: string; ancho: number; alto: number; tipoMime: string } };
      // El identificador público se asigna al confirmar: no es el del objeto que estaba pendiente, que sigue sin ser accesible.
      expect(confirmada.fotografia.fotografiaId).not.toBe(pendiente.fotografiaId); expect((await fotoPublica(request, perfil.prestadorId, trabajo.trabajoId, pendiente.fotografiaId!)).status()).toBe(404);
      expect([confirmada.fotografia.ancho, confirmada.fotografia.alto, confirmada.fotografia.tipoMime]).toEqual([200, 100, 'image/webp']);
      const despues = await fotoPublica(request, perfil.prestadorId, trabajo.trabajoId, confirmada.fotografia.fotografiaId);
      expect(despues.status()).toBe(200); expect(despues.headers()['cache-control']).toBe('no-store');
      const publica = (await despues.json()) as { tipoMime: string; contenidoBase64: string }; const bytes = Buffer.from(publica.contenidoBase64, 'base64');
      expect(publica.tipoMime).toBe('image/webp'); const webp = inspeccionarWebp(bytes, marcador);
      // El visitante la abre en el navegador: se muestra solo la variante saneada.
      await pagina.reload(); await pagina.getByRole('button', { name: `Ver imagen 1 de ${titulo}` }).click();
      const imagen = pagina.locator('img[src^="data:image/webp"]'); await expect(imagen).toBeVisible();
      expect(await imagen.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(200);
      await evidencia(testInfo, 'ca-pre-06', { altaPendiente: { http: antes.status(), codigo: 'RECURSO_NO_DISPONIBLE', sinContenido: !textoAntes.includes('contenidoBase64'), fotografiasListadasEnElPortafolio: listadoPendiente }, confirmada: { http: despues.status(), cacheControl: despues.headers()['cache-control'], tipoMime: publica.tipoMime, ancho: confirmada.fotografia.ancho, alto: confirmada.fotografia.alto, bytes: bytes.length, sha256: sha256(bytes), fragmentosWebp: webp.fragmentos, sinMetadatos: webp.sinMetadatos, sinMarcadorSensible: webp.sinMarcador, idPublicoDistintoDelObjetoPendiente: confirmada.fotografia.fotografiaId !== pendiente.fotografiaId }, original: { bytes: original.length, contieneMarcador: true } });
    } finally { await escribirSenal(senal('liberar'), {}).catch(() => undefined); await visitante.close(); }
  });

  test('CA-PRE-07 · un reemplazo inválido conserva la imagen anterior y uno válido mantiene cuatro fotos y se publica solo saneado', async ({ page, request }, testInfo) => {
    criterios(testInfo, 'CA-PRE-07'); test.setTimeout(180_000);
    const marcador = await marcadorSensible(); const titulo = 'Trabajo con cuatro fotografías';
    const especialidad = await especialidadAlbanileria(request); const titular = await crearCuenta(request, 'prestador', 'Titular ficticio HU03');
    const datos = await trabajoConFotos(request, titular, especialidad, titulo, ['valida.jpg', 'valida.png', 'valida.webp', 'reemplazo.png']);
    const primera = datos.fotos[0]!; const publicaDe = async (id: string) => Buffer.from(((await (await fotoPublica(request, datos.prestadorId, datos.trabajoId, id)).json()) as { contenidoBase64: string }).contenidoBase64, 'base64');
    const huellaAnterior = sha256(await publicaDe(primera));
    await abrirPerfilProfesional(page, titular); await conteoFotos(page, titulo, 4);
    // Primero un archivo inválido: se rechaza con su causa y se conserva la imagen anterior.
    const reemplazar = trabajoUi(page, titulo).getByLabel('Reemplazar fotografía 1'); await expect(reemplazar).toBeEnabled(); await reemplazar.setInputFiles(rutaImagen('gif-con-extension.jpg'));
    await expect(page.getByRole('alert').filter({ hasText: 'El formato real del archivo no es JPG, PNG ni WEBP.' })).toBeVisible(); await conteoFotos(page, titulo, 4);
    const trasRechazo = (await obtenerPerfil(request, titular.token)).trabajos[0]!;
    expect(trasRechazo.fotografias.map((f) => f.fotografiaId)).toEqual(datos.fotos); expect(sha256(await publicaDe(primera))).toBe(huellaAnterior);
    // Luego uno válido con metadatos sensibles: el recuento sigue en cuatro y se entrega solo la variante saneada.
    await escribirUi(page, testInfo, () => reemplazar.setInputFiles(rutaImagen('reemplazo-sensible.jpg')), 'Fotografía reemplazada.'); await conteoFotos(page, titulo, 4);
    const trasReemplazo = (await obtenerPerfil(request, titular.token)).trabajos[0]!; expect(trasReemplazo.fotografias).toHaveLength(4);
    const nueva = trasReemplazo.fotografias[0]!; expect([nueva.ancho, nueva.alto]).toEqual([220, 140]);
    const bytes = await publicaDe(nueva.fotografiaId); const webp = inspeccionarWebp(bytes, marcador); expect(sha256(bytes)).not.toBe(huellaAnterior);
    await evidencia(testInfo, 'ca-pre-07', { rechazoConservaImagen: { fotografiasIguales: true, huellaAnteriorIntacta: true }, reemplazoValido: { fotografias: trasReemplazo.fotografias.length, ancho: nueva.ancho, alto: nueva.alto, sha256Nueva: sha256(bytes), sha256Anterior: huellaAnterior, fragmentosWebp: webp.fragmentos, sinMetadatos: webp.sinMetadatos, sinMarcadorSensible: webp.sinMarcador, mismoIdentificador: nueva.fotografiaId === primera } });
  });

  test('CA-PRE-08 · eliminar una foto la retira del portafolio y de la entrega pública, conserva el trabajo y las demás fotos y libera un cupo', async ({ page, request, browser }, testInfo) => {
    criterios(testInfo, 'CA-PRE-08'); test.setTimeout(180_000);
    const titulo = 'Trabajo con fotografías publicadas';
    const especialidad = await especialidadAlbanileria(request); const titular = await crearCuenta(request, 'prestador', 'Titular ficticio HU03');
    const datos = await trabajoConFotos(request, titular, especialidad, titulo, ['valida.jpg', 'valida.png', 'valida.webp', 'reemplazo.png']);
    const eliminada = datos.fotos[1]!; const restantes = datos.fotos.filter((f) => f !== eliminada);
    const estadoPublico = async (id: string) => (await fotoPublica(request, datos.prestadorId, datos.trabajoId, id)).status();
    for (const id of datos.fotos) expect(await estadoPublico(id)).toBe(200);
    await abrirPerfilProfesional(page, titular); await conteoFotos(page, titulo, 4);
    await trabajoUi(page, titulo).getByRole('button', { name: 'Eliminar fotografía 2' }).click(); await esperarEstado(page, 'Fotografía eliminada.'); await conteoFotos(page, titulo, 3);
    // El acceso público anterior ya no entrega la foto; el trabajo y las demás fotos se conservan.
    const respuesta = await fotoPublica(request, datos.prestadorId, datos.trabajoId, eliminada); const texto = await respuesta.text();
    expect(respuesta.status()).toBe(404); expect((JSON.parse(texto) as { codigo: string }).codigo).toBe('RECURSO_NO_DISPONIBLE'); expect(texto).not.toContain('contenidoBase64');
    for (const id of restantes) expect(await estadoPublico(id)).toBe(200);
    const perfil = await obtenerPerfil(request, titular.token); expect(perfil.trabajos).toHaveLength(1); expect(perfil.trabajos[0]!.fotografias.map((f) => f.fotografiaId)).toEqual(restantes);
    const visitante = await browser.newContext({ baseURL: origenWeb, ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}) }); const pagina = await visitante.newPage();
    try { await pagina.goto(`/prestadores/${datos.prestadorId}`); await expect(pagina.getByRole('article', { name: `Trabajo: ${titulo}` })).toBeVisible(); await expect(pagina.getByRole('button', { name: /^Ver imagen/ })).toHaveCount(3); } finally { await visitante.close(); }
    // Se liberó un cupo: se puede volver a llegar a cuatro fotografías.
    await subirYEsperarUi(page, testInfo, titulo, 'valida.jpg'); await conteoFotos(page, titulo, 4);
    await evidencia(testInfo, 'ca-pre-08', { fotoEliminada: { accesoPublico: respuesta.status(), codigo: 'RECURSO_NO_DISPONIBLE', sinContenido: !texto.includes('contenidoBase64') }, fotografiasConservadas: restantes.length, trabajosConservados: perfil.trabajos.length, botonesPublicosTrasEliminar: 3, cupoLiberado: 'vuelve a 4 de 4' });
  });
});
