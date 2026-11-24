import { randomUUID } from 'node:crypto';
import type { Browser, Page, TestInfo } from '@playwright/test';
import { cabecerasEscritura, criterios, crearCuenta, expect, origenWeb, registrarEvidencia, test, type CuentaE2E } from './soporte.js';
import { controlesAlcanzables, describirFoco, medirContraste, medirDiseno, medirNombres, type Foco } from './analisis-accesibilidad.js';
import { conMenu, irA } from '../../soporte/menu-principal.js';

/**
 * T080 · EQ-07/PR07: adaptabilidad, accesibilidad y usabilidad de las vistas de 002 (búsqueda, detalle, perfil público, perfil profesional y servicios del titular) en Chromium,
 * Firefox y WebKit a 360, 768 y 1366 px, sobre HTTPS con la CA 002 y una base descartable por corrida. Las mediciones (desbordamiento, superposición, objetivos táctiles,
 * nombres accesibles, contraste, foco y orden de tabulación) se hacen en la página con el DOM y los estilos reales de cada navegador (`analisis-accesibilidad.ts`).
 * Lo que NO puede demostrar un navegador emulado (celular y computadora reales, lector de pantalla, revisión humana de legibilidad) queda registrado como pendiente manual.
 */
const esperaCarga = 60_000; const objetivoMinimo = 24; // WCAG 2.2 AA, criterio 2.5.8
const alba = '00000000-0000-4000-8000-000000009002';

interface Datos { titular: CuentaE2E & { prestadorId: string }; cliente: CuentaE2E; servicioId: string; trabajoTitulo: string }
async function preparar(request: Parameters<Parameters<typeof test>[2]>[0]['request']): Promise<Datos> {
  const titular = await crearCuenta(request, 'prestador', 'Titular ficticio accesibilidad');
  const perfil = await request.put('/api/v1/prestadores/perfil', { headers: cabecerasEscritura(titular.token), data: { version: 0, nombrePublico: `Maestro ficticio ${randomUUID().slice(0, 6)}`, tipo: 'TECNICO', experiencia: 'Experiencia ficticia de obra y acabados, redactada con una longitud suficiente para comprobar el ajuste del texto en pantallas estrechas.', especialidadesIds: [alba], distritos: ['ayacucho', 'carmen-alto', 'san-juan-bautista', 'jesus-nazareno', 'andres-avelino-caceres-dorregaray'], disponibilidadDeclarada: true } });
  expect(perfil.status()).toBe(201); const prestadorId = ((await perfil.json()) as { prestadorId: string }).prestadorId;
  const trabajoTitulo = 'Trabajo ficticio con un título deliberadamente largo para comprobar el ajuste de línea en pantallas de 360 píxeles';
  expect((await request.post('/api/v1/prestadores/perfil/trabajos', { headers: cabecerasEscritura(titular.token), data: { versionPerfil: 1, titulo: trabajoTitulo, descripcion: 'Descripción ficticia del trabajo anterior.' } })).status()).toBe(201);
  const crear = async (titulo: string) => ((await (await request.post('/api/v1/servicios', { headers: cabecerasEscritura(titular.token), data: { titulo, descripcion: `Descripción ficticia de ${titulo}.`, categoriaId: alba } })).json()) as { servicioId: string; version: number });
  const s1 = await crear('Servicio publicado de accesibilidad con un título muy largo para comprobar el ajuste'); const s2 = await crear('Servicio pausado de accesibilidad');
  expect((await request.post(`/api/v1/servicios/${s2.servicioId}/transiciones`, { headers: cabecerasEscritura(titular.token), data: { version: 1, destino: 'PAUSADO' } })).status()).toBe(200);
  const s3 = await crear('Servicio retirado de accesibilidad');
  expect((await request.post(`/api/v1/servicios/${s3.servicioId}/transiciones`, { headers: cabecerasEscritura(titular.token), data: { version: 1, destino: 'RETIRADO' } })).status()).toBe(200);
  return { titular: { ...titular, prestadorId }, cliente: await crearCuenta(request, 'cliente', 'Cliente ficticio accesibilidad'), servicioId: s1.servicioId, trabajoTitulo };
}

interface Pantalla { nombre: string; abrir: (p: Page) => Promise<void> }
/** Vistas públicas de 002 (sin sesión). El acceso y el registro pertenecen a 001 y no se miden aquí: solo se usan para llegar a las vistas del titular. */
const publicas = (d: Datos): Pantalla[] => [
  { nombre: 'busqueda-con-resultados', abrir: async (p) => { await p.goto('/buscar'); await expect(p.getByRole('list', { name: 'Resultados' }).getByRole('article').first()).toBeVisible({ timeout: esperaCarga }); } },
  { nombre: 'busqueda-sin-coincidencias', abrir: async (p) => { if (!p.url().endsWith('/buscar')) await p.goto('/buscar'); await expect(p.getByRole('heading', { name: 'Buscar servicios y prestadores' })).toBeVisible({ timeout: esperaCarga }); await p.getByLabel('Zona de atención').selectOption({ label: 'Jesús Nazareno' }); await p.getByLabel('Disponibilidad declarada').selectOption({ label: 'Declara no estar disponible' }); await p.getByLabel('Categoría').selectOption({ label: 'Acabados' }); await p.getByRole('button', { name: 'Buscar', exact: true }).click(); await expect(p.getByText('No hay coincidencias para esos criterios.')).toBeVisible({ timeout: esperaCarga }); } },
  { nombre: 'detalle-de-servicio', abrir: async (p) => { await p.goto(`/servicios/${d.servicioId}`); await expect(p.getByRole('button', { name: 'Ver perfil del prestador' })).toBeVisible({ timeout: esperaCarga }); } },
  { nombre: 'servicio-no-disponible', abrir: async (p) => { await p.goto(`/servicios/${randomUUID()}`); await expect(p.getByRole('alert')).toBeVisible({ timeout: esperaCarga }); } },
  { nombre: 'perfil-publico', abrir: async (p) => { await p.goto(`/prestadores/${d.titular.prestadorId}`); await expect(p.getByRole('article', { name: `Trabajo: ${d.trabajoTitulo}` })).toBeVisible({ timeout: esperaCarga }); } },
];
const entrar = async (p: Page, c: CuentaE2E): Promise<void> => {
  await p.goto('/acceso'); await p.getByLabel('Correo').fill(c.correo); await p.getByLabel('Contraseña', { exact: true }).fill(c.contrasena); await p.getByRole('button', { name: 'Iniciar sesión' }).click();
  await conMenu(p, p.getByRole('link', { name: 'Mi cuenta' }), esperaCarga);
};
/** Pantallas del titular (la sesión vive en memoria: se llega por los enlaces de la cabecera). */
const privadas = (d: Datos): Pantalla[] => [
  { nombre: 'perfil-profesional', abrir: async (p) => { await irA(p, 'Mi perfil profesional'); await expect(p.getByRole('article', { name: `Trabajo: ${d.trabajoTitulo}` })).toBeVisible({ timeout: esperaCarga }); } },
  { nombre: 'mis-servicios', abrir: async (p) => { await irA(p, 'Mis servicios'); await expect(p.getByRole('article', { name: /^Servicio: Servicio retirado/ })).toBeVisible({ timeout: esperaCarga }); } },
  { nombre: 'mis-servicios-edicion-y-retiro', abrir: async (p) => {
    await p.getByRole('button', { name: /^Editar Servicio publicado/ }).click(); await expect(p.getByRole('form', { name: /^Edición de/ })).toBeVisible();
    await p.getByRole('button', { name: /^Retirar Servicio pausado/ }).click(); await expect(p.getByText('El retiro es definitivo: el servicio quedará de solo lectura.')).toBeVisible(); } },
];

/** Recorre las pantallas públicas con un visitante y las del titular con su sesión, y ejecuta la medición en cada una. */
async function recorrer(browser: Browser, request: Parameters<Parameters<typeof test>[2]>[0]['request'], testInfo: TestInfo, medir: (p: Page, nombre: string) => Promise<void>, soloPublicas = false): Promise<Datos> {
  const d = await preparar(request); const viewport = testInfo.project.use.viewport;
  const contexto = await browser.newContext({ baseURL: origenWeb, ...(viewport ? { viewport } : {}) }); const p = await contexto.newPage();
  // Las transiciones de color de 150 ms de la interfaz (enlaces de navegación) falsearían la medición del color efectivo: se mide en reposo, sin animaciones en curso.
  const enReposo = async (nombre: string) => { await p.waitForFunction(() => document.getAnimations().length === 0, undefined, { timeout: 5_000 }).catch(() => undefined); await medir(p, nombre); };
  try {
    for (const s of publicas(d)) { await s.abrir(p); await enReposo(s.nombre); }
    if (!soloPublicas) { await entrar(p, d.titular); for (const s of privadas(d)) { await s.abrir(p); await enReposo(s.nombre); } }
  } finally { await contexto.close(); }
  return d;
}
const resumen = (testInfo: TestInfo, nombre: string, datos: object): Promise<void> => registrarEvidencia(testInfo, nombre, datos);

test.describe('EQ-07/PR07 · adaptabilidad, accesibilidad y usabilidad de las vistas de 002', () => {
  test.describe.configure({ timeout: 300_000 });

  test('diseño adaptable: sin desplazamiento horizontal general, controles superpuestos, elementos fuera de la ventana ni texto recortado', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'EQ-07', 'PR07');
    const filas: Record<string, object> = {}; const fallos: string[] = [];
    await recorrer(browser, request, testInfo, async (p, nombre) => {
      const m = await p.evaluate(medirDiseno, objetivoMinimo); filas[nombre] = { ancho: m.anchoVentana, desbordamiento: m.desbordamientoHorizontal, controles: m.controles, objetivoMinimoPx: m.objetivoMinimo };
      if (m.desbordamientoHorizontal > 0) fallos.push(`${nombre}: desplazamiento horizontal de ${m.desbordamientoHorizontal}px`);
      for (const [clave, lista] of [['fuera de la ventana', m.fueraDeVentana], ['superpuestos', m.solapes], ['objetivo menor de 24 px', m.pequenos], ['texto recortado', m.recortados]] as const) if (lista.length) fallos.push(`${nombre}: ${clave}: ${lista.join('; ')}`);
    });
    expect(fallos).toEqual([]);
    await resumen(testInfo, 'eq-07-diseno', { anchoVentana: testInfo.project.use.viewport?.width, pantallas: filas, criterio: 'sin desplazamiento horizontal general; ningún control superpuesto, fuera de la ventana o menor de 24×24 px; sin texto recortado' });
  });

  test('nombres accesibles, idioma, puntos de referencia y encabezados de todas las vistas', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'EQ-07', 'PR07');
    const filas: Record<string, object> = {}; const fallos: string[] = [];
    await recorrer(browser, request, testInfo, async (p, nombre) => {
      const m = await p.evaluate(medirNombres); filas[nombre] = { controles: m.campos, h1: m.marcas.h1, main: m.marcas.main, nav: m.marcas.nav };
      if (m.sinNombre.length) fallos.push(`${nombre}: sin nombre accesible: ${m.sinNombre.join(', ')}`); if (m.imagenesSinAlt.length) fallos.push(`${nombre}: imágenes sin alt`);
      if (m.saltosDeEncabezado.length) fallos.push(`${nombre}: ${m.saltosDeEncabezado.join('; ')}`); if (m.sinIdioma) fallos.push(`${nombre}: sin atributo lang`);
      if (m.marcas.main !== 1 || m.marcas.nav < 1 || m.marcas.h1 !== 1) fallos.push(`${nombre}: puntos de referencia main=${m.marcas.main} nav=${m.marcas.nav} h1=${m.marcas.h1}`);
    });
    expect(fallos).toEqual([]);
    await resumen(testInfo, 'eq-07-nombres', { pantallas: filas, criterio: 'todo control visible tiene nombre accesible; lang presente; un main, un h1 y navegación; encabezados sin saltos' });
  });

  test('contraste: texto 4,5:1 (3:1 si es grande) y bordes de campos 3:1 en todas las vistas', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'EQ-07', 'PR07');
    const filas: Record<string, object> = {}; const fallos: string[] = [];
    await recorrer(browser, request, testInfo, async (p, nombre) => {
      const m = await p.evaluate(medirContraste); filas[nombre] = { textosComprobados: m.comprobados, peorRazon: m.peor, omitidosPorFondoComplejo: m.omitidosPorFondoComplejo };
      for (const f of m.fallos) fallos.push(`${nombre}: «${f.texto}» (${f.elemento}) ${f.razon}:1 < ${f.minimo}:1`); for (const b of m.bordes) fallos.push(`${nombre}: borde de ${b.elemento} ${b.razon}:1 < 3:1`);
    });
    expect(fallos).toEqual([]);
    await resumen(testInfo, 'eq-07-contraste', { pantallas: filas, criterio: 'texto ≥ 4,5:1 (≥ 3:1 si ≥ 24 px o ≥ 18,66 px en negrita); bordes de campos ≥ 3:1; deshabilitados exentos' });
  });

  test('teclado: todo control es alcanzable con Tab, en orden, sin trampas y con un indicador de foco visible de al menos 3:1', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'EQ-07', 'PR07');
    const filas: Record<string, object> = {}; const fallos: string[] = [];
    await recorrer(browser, request, testInfo, async (p, nombre) => {
      const esperados = await p.evaluate(controlesAlcanzables); // Se reinicia el punto de partida de la navegación secuencial (tras pulsar un enlace, Tab continuaría desde él): un marcador no tabulable al inicio del documento recibe el foco.
      await p.evaluate(() => { window.scrollTo(0, 0); document.getElementById('__inicio_tab')?.remove(); const m = document.createElement('span'); m.id = '__inicio_tab'; m.tabIndex = -1; m.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0'; document.body.prepend(m); m.focus(); });
      const paradas: Foco[] = []; let previo = -1; let ciclo = false;
      for (let i = 0; i < esperados.length + 6; i += 1) {
        await p.keyboard.press('Tab'); let f = await p.evaluate(describirFoco);
        // El navegador desplaza el campo enfocado hasta mostrarlo: se conceden hasta 3 s a ese desplazamiento antes de darlo por fuera de la ventana.
        for (let espera = 0; f && !f.enVentana && espera < 30; espera += 1) { await p.waitForTimeout(100); f = await p.evaluate(describirFoco); }
        if (!f) { ciclo = true; break; } // el foco salió del documento (barra del navegador) o volvió al inicio: no hay trampa
        if (f.indice <= previo) { ciclo = true; break; }
        paradas.push(f); previo = f.indice;
      }
      expect(paradas.length, `${nombre}: ninguna parada de Tab`).toBeGreaterThan(0);
      const alcanzados = paradas.map((f) => `${f.etiqueta}|${f.nombre}`); const sobrantes = [...alcanzados];
      const inalcanzables = esperados.filter((e) => { const i = sobrantes.indexOf(e); if (i >= 0) { sobrantes.splice(i, 1); return false; } return true; });
      if (inalcanzables.length) fallos.push(`${nombre}: no alcanzables con Tab: ${inalcanzables.slice(0, 6).join(', ')}`);
      for (const f of paradas) {
        if (!f.enVentana) fallos.push(`${nombre}: el foco queda fuera de la ventana en «${f.nombre}» (${f.geometria})`);
        if (!f.indicador) fallos.push(`${nombre}: «${f.nombre}» (${f.etiqueta}) no muestra indicador de foco`);
        else if (f.contrasteIndicador > 0 && f.contrasteIndicador < 3) fallos.push(`${nombre}: indicador de foco de «${f.nombre}» ${f.contrasteIndicador}:1 < 3:1`);
        if (f.tabIndexPositivo) fallos.push(`${nombre}: tabindex positivo en «${f.nombre}»`);
      }
      // Orden coherente con el visual: la posición vertical del foco no retrocede de forma significativa (tolerancia de una fila de controles), salvo al pasar a otra columna a la derecha
      // (rejillas de tarjetas, campos en dos columnas) o desde/hacia la barra lateral fija, cuyo orden es el del documento: primero el menú y después el contenido.
      for (let i = 1; i < paradas.length; i += 1) if (!paradas[i]!.fijo && !paradas[i - 1]!.fijo && paradas[i]!.izquierda <= paradas[i - 1]!.izquierda + 100 && paradas[i]!.arriba < paradas[i - 1]!.arriba - 60) fallos.push(`${nombre}: el foco retrocede de «${paradas[i - 1]!.nombre}» a «${paradas[i]!.nombre}»`);
      if (!ciclo) fallos.push(`${nombre}: posible trampa de teclado (el foco no salió tras ${paradas.length} paradas)`);
      filas[nombre] = { paradasDeTab: paradas.length, controlesEsperados: esperados.length };
    });
    expect(fallos).toEqual([]);
    await resumen(testInfo, 'eq-07-teclado', { pantallas: filas, criterio: 'cada control visible y habilitado recibe el foco con Tab en el orden del documento; hay indicador con contraste ≥ 3:1; no hay trampas ni tabindex positivo' });
  });

  test('flujos principales solo con teclado: iniciar sesión, buscar con filtros y publicar un servicio', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'EQ-07', 'PR07');
    const d = await preparar(request); const viewport = testInfo.project.use.viewport;
    const contexto = await browser.newContext({ baseURL: origenWeb, ...(viewport ? { viewport } : {}) }); const p = await contexto.newPage();
    const teclear = async (texto: string) => { await p.keyboard.type(texto); };
    try {
      // Búsqueda sin ratón: zona y disponibilidad con las flechas y envío con Enter.
      await p.goto('/buscar'); await expect(p.getByRole('list', { name: 'Resultados' }).getByRole('article').first()).toBeVisible({ timeout: esperaCarga });
      await p.getByLabel('Zona de atención').focus(); await p.keyboard.press('ArrowDown'); await expect(p.getByLabel('Zona de atención')).not.toHaveValue('');
      await p.keyboard.press('Tab'); await expect(p.getByLabel('Disponibilidad declarada')).toBeFocused(); await p.keyboard.press('ArrowDown'); await expect(p.getByLabel('Disponibilidad declarada')).not.toHaveValue('');
      await p.keyboard.press('Tab'); await expect(p.getByRole('button', { name: 'Buscar', exact: true })).toBeFocused(); await p.keyboard.press('Enter');
      const zona = await p.getByLabel('Zona de atención').inputValue(); const disp = await p.getByLabel('Disponibilidad declarada').inputValue();
      const esperado = ((await (await request.get(`/api/v1/servicios?distrito=${zona}&disponibilidad=${disp}`)).json()) as { total: number }).total;
      await expect(p.getByText(esperado === 0 ? 'No hay coincidencias' : `${esperado} ${esperado === 1 ? 'resultado' : 'resultados'}`).first()).toBeVisible({ timeout: esperaCarga });
      // Inicio de sesión sin ratón.
      await p.goto('/acceso'); await p.getByLabel('Correo').focus(); await teclear(d.titular.correo); await p.keyboard.press('Tab'); await teclear(d.titular.contrasena);
      await p.keyboard.press('Enter'); await conMenu(p, p.getByRole('link', { name: 'Mi cuenta' }), esperaCarga);
      // Publicación de un servicio sin ratón: Tab entre campos y Enter para enviar.
      const menu = p.getByRole('button', { name: 'Menú', exact: true }); if ((await menu.isVisible()) && (await menu.getAttribute('aria-expanded')) === 'false') { await menu.focus(); await p.keyboard.press('Enter'); } // en celular el menú se abre con el teclado
      await expect(p.getByRole('link', { name: 'Mis servicios' })).toBeVisible({ timeout: esperaCarga }); await p.getByRole('link', { name: 'Mis servicios' }).focus(); await p.keyboard.press('Enter'); await expect(p.getByRole('heading', { name: 'Mis servicios' })).toBeVisible({ timeout: esperaCarga });
      const titulo = `Servicio por teclado ${randomUUID().slice(0, 6)}`;
      await p.getByLabel('Título del servicio').focus(); await teclear(titulo); await p.keyboard.press('Tab'); await teclear('Descripción ficticia escrita solo con el teclado.');
      await p.keyboard.press('Tab'); await expect(p.getByLabel('Categoría del servicio')).toBeFocused(); await p.keyboard.press('Tab'); await expect(p.getByRole('button', { name: 'Publicar servicio' })).toBeFocused(); await p.keyboard.press('Enter');
      await expect(p.getByRole('status').filter({ hasText: 'Servicio publicado.' })).toBeVisible({ timeout: esperaCarga });
      await expect(p.getByRole('article', { name: `Servicio: ${titulo}` })).toBeVisible();
      await resumen(testInfo, 'eq-07-flujos-teclado', { busqueda: { zona, disponibilidad: disp, resultados: esperado }, inicioDeSesion: 'completado', publicacion: 'completada', sinRaton: true });
    } finally { await contexto.close(); }
  });

  test('errores y avisos: se anuncian (alert y status) y se asocian al campo que los causa', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'EQ-07', 'PR07');
    const d = await preparar(request); const viewport = testInfo.project.use.viewport;
    const contexto = await browser.newContext({ baseURL: origenWeb, ...(viewport ? { viewport } : {}) }); const p = await contexto.newPage(); const fallos: string[] = []; const casos: Record<string, object> = {};
    /** Cada error de campo debe ser un `alert` visible y el campo debe declararlo (`aria-invalid` y `aria-describedby` hacia ese texto). */
    const comprobar = async (caso: string, campo: ReturnType<Page['getByLabel']>, mensaje: string) => {
      const alerta = p.getByRole('alert').filter({ hasText: mensaje }).first(); await expect(alerta).toBeVisible({ timeout: esperaCarga });
      const invalido = await campo.getAttribute('aria-invalid'); const descrito = (await campo.getAttribute('aria-describedby')) ?? ''; const idAlerta = (await alerta.getAttribute('id')) ?? '';
      const asociado = invalido === 'true' && idAlerta !== '' && descrito.split(/\s+/).includes(idAlerta); casos[caso] = { alert: true, ariaInvalid: invalido, asociadoAlCampo: asociado };
      if (!asociado) fallos.push(`${caso}: el error «${mensaje}» no está asociado al campo (aria-invalid=${invalido}, aria-describedby=${descrito}, id=${idAlerta})`);
    };
    try {
      await entrar(p, d.titular);
      await irA(p, 'Mis servicios'); await expect(p.getByRole('heading', { name: 'Mis servicios' })).toBeVisible({ timeout: esperaCarga });
      await p.getByRole('button', { name: 'Publicar servicio' }).click();
      await comprobar('servicio-titulo-vacio', p.getByLabel('Título del servicio'), 'Indique el título del servicio.');
      await irA(p, 'Mi perfil profesional'); await expect(p.getByRole('heading', { name: 'Mi perfil profesional' })).toBeVisible({ timeout: esperaCarga });
      await p.getByLabel('Nombre público').fill(''); await p.getByRole('button', { name: 'Guardar perfil' }).click();
      await comprobar('perfil-nombre-vacio', p.getByLabel('Nombre público'), 'Indique su nombre público.');
    } finally { await contexto.close(); }
    expect(fallos).toEqual([]);
    await resumen(testInfo, 'eq-07-errores', { casos, criterio: 'cada error de validación es un alert visible, con id, y su campo tiene aria-invalid y aria-describedby hacia él' });
  });
});
