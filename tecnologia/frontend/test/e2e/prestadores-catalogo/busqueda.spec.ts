import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { APIRequestContext, Browser, Page, TestInfo } from '@playwright/test';
import { cabecerasEscritura, criterios, crearCuenta, expect, origenWeb, registrarEvidencia, test, type CuentaE2E } from './soporte.js';

/**
 * T078 · Recorridos de HU05 (búsqueda y consulta de la oferta) en Chromium, Firefox y WebKit a 360, 768 y 1366 px, sobre HTTPS con la CA 002 y una base descartable por corrida.
 * El visitante y una cuenta autenticada usan la interfaz web real; la oferta (categorías, prestadores y servicios ficticios, propios de cada prueba) se prepara por la API
 * con el operador de la base descartable (E2E_OPERADOR_002). Cada prueba declara los criterios CA-BUS que demuestra y adjunta los hechos verificables que el reporte conserva en
 * `hu05/<proyecto>/`. Los avisos de 011 y 012 se comprueban con ambas fuentes ausentes (el estado real de 002); los otros tres casos de disponibilidad requieren dobles y se
 * verifican en el nivel de backend (T044 y T052). Todos los datos son ficticios.
 */
const esperaCarga = 60_000;
const avisoCalificaciones = 'Calificaciones aún no disponibles'; const avisoVerificaciones = 'Verificaciones aún no disponibles';
const textoVacio = 'No hay coincidencias para esos criterios. Ajuste los filtros e intente de nuevo.';

interface ServicioApi { servicioId: string; prestadorId: string; titulo: string; descripcion: string; categoriaId: string; estado: string; version: number }
interface Prestador extends CuentaE2E { prestadorId: string; nombrePublico: string }
interface Pagina<T> { elementos: T[]; total: number; pagina: number; tamano: number }
const sufijo = (): string => randomUUID().slice(0, 6);

async function operador(request: APIRequestContext): Promise<string> {
  const { correo, contrasena } = JSON.parse(await readFile(process.env['E2E_OPERADOR_002']!, 'utf8')) as { correo: string; contrasena: string };
  const r = await request.post('/api/v1/sesiones', { headers: { origin: origenWeb }, data: { correo, contrasena } }); expect(r.status()).toBe(200);
  return ((await r.json()) as { tokenAcceso: string }).tokenAcceso;
}
/** Categoría ficticia propia de la prueba, creada y activada por el operador; con `padre` es subcategoría de otra ya activa. */
async function categoria(request: APIRequestContext, admin: string, nombre: string, padre?: string): Promise<{ categoriaId: string; nombre: string; version: number }> {
  const c = await request.post('/api/v1/admin/categorias', { headers: cabecerasEscritura(admin), data: { nombre, ...(padre ? { categoriaPadreId: padre } : {}), motivo: 'Alta de prueba E2E' } }); expect(c.status()).toBe(201);
  const { categoriaId } = (await c.json()) as { categoriaId: string };
  const a = await request.post(`/api/v1/admin/categorias/${categoriaId}/activaciones`, { headers: cabecerasEscritura(admin), data: { version: 1, motivo: 'Activación de prueba E2E' } }); expect(a.status()).toBe(200);
  return { categoriaId, nombre, version: ((await a.json()) as { version: number }).version };
}
async function desactivar(request: APIRequestContext, admin: string, categoriaId: string, version: number): Promise<number> {
  const p = await request.post(`/api/v1/admin/categorias/${categoriaId}/previsualizaciones-desactivacion`, { headers: cabecerasEscritura(admin), data: { version } }); expect(p.status()).toBe(201);
  const { confirmacionId } = (await p.json()) as { confirmacionId: string };
  const d = await request.post(`/api/v1/admin/categorias/${categoriaId}/desactivaciones`, { headers: cabecerasEscritura(admin), data: { confirmacionId, version, motivo: 'Baja de prueba E2E' } }); expect(d.status()).toBe(200);
  return ((await d.json()) as { version: number }).version;
}
async function activar(request: APIRequestContext, admin: string, categoriaId: string, version: number): Promise<void> {
  const a = await request.post(`/api/v1/admin/categorias/${categoriaId}/activaciones`, { headers: cabecerasEscritura(admin), data: { version, motivo: 'Reactivación de prueba E2E' } }); expect(a.status()).toBe(200);
}
async function prestador(request: APIRequestContext, nombre: string, distritos: string[], disponible: boolean, especialidad: string): Promise<Prestador> {
  const nombrePublico = `${nombre} ${sufijo()}`; const cuenta = await crearCuenta(request, 'prestador', nombrePublico);
  const r = await request.put('/api/v1/prestadores/perfil', { headers: cabecerasEscritura(cuenta.token), data: { version: 0, nombrePublico, tipo: 'TECNICO', experiencia: `Experiencia ficticia de ${nombrePublico}.`, especialidadesIds: [especialidad], distritos, disponibilidadDeclarada: disponible } });
  expect(r.status()).toBe(201); return { ...cuenta, prestadorId: ((await r.json()) as { prestadorId: string }).prestadorId, nombrePublico };
}
async function publicar(request: APIRequestContext, token: string, titulo: string, categoriaId: string): Promise<ServicioApi> {
  const r = await request.post('/api/v1/servicios', { headers: cabecerasEscritura(token), data: { titulo, descripcion: `Descripción ficticia de ${titulo}.`, categoriaId } }); expect(r.status()).toBe(201);
  return (await r.json()) as ServicioApi;
}
const transicion = (request: APIRequestContext, token: string, s: ServicioApi, version: number, destino: string) =>
  request.post(`/api/v1/servicios/${s.servicioId}/transiciones`, { headers: cabecerasEscritura(token), data: { version, destino } });
async function api<T>(request: APIRequestContext, ruta: string, token?: string): Promise<{ status: number; cuerpo: T }> {
  const r = await request.get(`/api/v1${ruta}`, token ? { headers: { authorization: `Bearer ${token}` } } : {}); return { status: r.status(), cuerpo: (await r.json()) as T };
}
const titulosApi = async (request: APIRequestContext, consulta: string, token?: string): Promise<string[]> => (await api<Pagina<{ titulo: string }>>(request, `/servicios?${consulta}`, token)).cuerpo.elementos.map((s) => s.titulo).sort();

/** Contexto de navegador sin sesión con el tamaño del proyecto: el visitante. */
async function visitante(browser: Browser, testInfo: TestInfo): Promise<{ pagina: Page; cerrar: () => Promise<void> }> {
  const contexto = await browser.newContext({ baseURL: origenWeb, ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}) });
  return { pagina: await contexto.newPage(), cerrar: () => contexto.close() };
}
async function iniciarSesion(page: Page, cuenta: CuentaE2E): Promise<void> {
  await page.goto('/acceso');
  await page.getByLabel('Correo').fill(cuenta.correo); await page.getByLabel('Contraseña', { exact: true }).fill(cuenta.contrasena); await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  // «Buscar servicios» también se ve sin sesión: se espera un enlace que solo existe con sesión iniciada.
  await expect(page.getByRole('link', { name: 'Mi cuenta' })).toBeVisible({ timeout: esperaCarga });
}
/** Abre la búsqueda: con sesión por el enlace de la cabecera (la sesión vive en memoria) y sin sesión por la ruta pública. */
async function abrirBusqueda(page: Page, conSesion: boolean): Promise<void> {
  if (conSesion) await page.getByRole('link', { name: 'Buscar servicios' }).click(); else await page.goto('/buscar');
  await expect(page.getByRole('heading', { name: 'Buscar servicios y prestadores' })).toBeVisible({ timeout: esperaCarga });
}
const resultados = (page: Page, tipo: 'Servicio' | 'Prestador') => page.getByRole('list', { name: 'Resultados' }).getByRole('article', { name: new RegExp(`^${tipo}: `) });
async function esperarResultados(page: Page, tipo: 'Servicio' | 'Prestador', esperados: string[]): Promise<void> {
  const nombres = esperados.map((t) => `${tipo}: ${t}`).sort();
  await expect.poll(async () => (await resultados(page, tipo).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))).sort(), { timeout: esperaCarga }).toEqual(nombres);
}
async function buscarEnUi(page: Page, filtros: { categoria?: string; zona?: string; disponibilidad?: string }): Promise<void> {
  await page.getByLabel('Categoría').selectOption({ label: filtros.categoria ?? 'Todas' });
  await page.getByLabel('Zona de atención').selectOption({ label: filtros.zona ?? 'Todas' });
  await page.getByLabel('Disponibilidad declarada').selectOption({ label: filtros.disponibilidad ?? 'Cualquiera' });
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
}
const hechos = (testInfo: TestInfo, nombre: string, datos: object): Promise<void> => registrarEvidencia(testInfo, nombre, datos);

/** Oferta de referencia: raíz R con subcategoría H, tres prestadores con zonas y disponibilidad distintas y cuatro servicios. */
async function ofertaDeReferencia(request: APIRequestContext) {
  const admin = await operador(request); const id = sufijo();
  const raiz = await categoria(request, admin, `Raíz ficticia ${id}`); const hija = await categoria(request, admin, `Hija ficticia ${id}`, raiz.categoriaId);
  const p1 = await prestador(request, 'Prestador Uno', ['ayacucho'], true, raiz.categoriaId);
  const p2 = await prestador(request, 'Prestador Dos', ['carmen-alto'], false, hija.categoriaId);
  const p3 = await prestador(request, 'Prestador Tres', ['ayacucho', 'carmen-alto'], false, raiz.categoriaId);
  const s1 = await publicar(request, p1.token, `Servicio uno ${id}`, hija.categoriaId); const s2 = await publicar(request, p2.token, `Servicio dos ${id}`, hija.categoriaId);
  const s3 = await publicar(request, p3.token, `Servicio tres ${id}`, raiz.categoriaId); const s4 = await publicar(request, p3.token, `Servicio cuatro ${id}`, hija.categoriaId);
  return { admin, raiz, hija, p1, p2, p3, s1, s2, s3, s4 };
}

test.describe('HU05 · búsqueda y consulta de la oferta', () => {
  test.describe.configure({ timeout: 240_000 });

  test('CA-BUS-01 y CA-BUS-02: el visitante combina filtros, ve el vacío válido y ajusta los criterios; una cuenta autenticada obtiene lo mismo', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'CA-BUS-01', 'CA-BUS-02', 'CA-BUS-04');
    const o = await ofertaDeReferencia(request); const nombreHija = `${o.raiz.nombre} › ${o.hija.nombre}`;
    const { pagina, cerrar } = await visitante(browser, testInfo);
    const t = (s: ServicioApi) => s.titulo;
    try {
      await abrirBusqueda(pagina, false);
      // La búsqueda base no ofrece filtro ni texto de calificaciones.
      await expect(pagina.getByLabel(/calificaci/i)).toHaveCount(0); await expect(pagina.getByText(/estrella|★|sin valoraciones/i)).toHaveCount(0);
      // Categoría raíz: incluye la subcategoría (jerarquía efectiva).
      await buscarEnUi(pagina, { categoria: o.raiz.nombre }); await esperarResultados(pagina, 'Servicio', [t(o.s1), t(o.s2), t(o.s3), t(o.s4)]);
      await expect(pagina.getByText('4 resultados', { exact: true })).toBeVisible();
      // Subcategoría: solo la suya.
      await buscarEnUi(pagina, { categoria: nombreHija }); await esperarResultados(pagina, 'Servicio', [t(o.s1), t(o.s2), t(o.s4)]);
      // Zona de atención: la zona del prestador (Carmen Alto: prestadores 2 y 3).
      await buscarEnUi(pagina, { categoria: o.raiz.nombre, zona: 'Carmen Alto' }); await esperarResultados(pagina, 'Servicio', [t(o.s2), t(o.s3), t(o.s4)]);
      // Disponibilidad declarada: solo el prestador 1 declara estar disponible.
      await buscarEnUi(pagina, { categoria: o.raiz.nombre, disponibilidad: 'Declara estar disponible' }); await esperarResultados(pagina, 'Servicio', [t(o.s1)]);
      // Todos los filtros a la vez.
      await buscarEnUi(pagina, { categoria: nombreHija, zona: 'Ayacucho', disponibilidad: 'Declara no estar disponible' }); await esperarResultados(pagina, 'Servicio', [t(o.s4)]);
      // Vacío válido: una zona sin prestadores; se informa y se pueden ajustar los filtros.
      await buscarEnUi(pagina, { categoria: o.raiz.nombre, zona: 'Jesús Nazareno' });
      await expect(pagina.getByText(textoVacio)).toBeVisible({ timeout: esperaCarga }); await expect(resultados(pagina, 'Servicio')).toHaveCount(0); await expect(pagina.getByRole('alert')).toHaveCount(0);
      await pagina.getByRole('button', { name: 'Quitar filtros' }).click(); await expect(pagina.getByText(textoVacio)).toHaveCount(0);
      await expect(pagina.getByLabel('Categoría')).toHaveValue('', { timeout: esperaCarga });
      await buscarEnUi(pagina, { categoria: o.raiz.nombre, zona: 'Ayacucho' }); await esperarResultados(pagina, 'Servicio', [t(o.s1), t(o.s3), t(o.s4)]);
      // Prestadores: mismos filtros sobre el otro tipo de resultado.
      await pagina.getByRole('radio', { name: 'Prestadores' }).check();
      await buscarEnUi(pagina, { categoria: o.raiz.nombre, zona: 'Carmen Alto' }); await esperarResultados(pagina, 'Prestador', [o.p2.nombrePublico, o.p3.nombrePublico]);
      await buscarEnUi(pagina, { categoria: o.raiz.nombre, disponibilidad: 'Declara estar disponible' }); await esperarResultados(pagina, 'Prestador', [o.p1.nombrePublico]);
      await expect(resultados(pagina, 'Prestador').first().getByText('Disponibilidad declarada: sí')).toBeVisible();
    } finally { await cerrar(); }

    // Cuenta autenticada (solo cliente) en el navegador y por la API: los mismos resultados que el visitante.
    const cliente = await crearCuenta(request, 'cliente', 'Cliente ficticio HU05'); const contexto = await browser.newContext({ baseURL: origenWeb, ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}) }); const pagina2 = await contexto.newPage();
    try {
      await iniciarSesion(pagina2, cliente); await abrirBusqueda(pagina2, true);
      await buscarEnUi(pagina2, { categoria: o.raiz.nombre, zona: 'Carmen Alto' }); await esperarResultados(pagina2, 'Servicio', [t(o.s2), t(o.s3), t(o.s4)]);
      await buscarEnUi(pagina2, { categoria: o.raiz.nombre, zona: 'Jesús Nazareno' }); await expect(pagina2.getByText(textoVacio)).toBeVisible({ timeout: esperaCarga });
    } finally { await contexto.close(); }
    const consulta = `categoria=${o.raiz.categoriaId}&distrito=carmen-alto&disponibilidad=false`;
    const anonimo = await titulosApi(request, consulta); const conSesion = await titulosApi(request, consulta, cliente.token);
    expect(conSesion).toEqual(anonimo); expect(anonimo).toEqual([t(o.s2), t(o.s3), t(o.s4)].sort());
    // Parámetros no admitidos: el filtro por calificación no existe en 002 y los duplicados o desconocidos se rechazan sin resultados.
    const rechazos: Record<string, { http: number; codigo: string }> = {};
    for (const [nombre, q] of [['calificacion', 'calificacion=5'], ['duplicado', `categoria=${o.raiz.categoriaId}&categoria=${o.raiz.categoriaId}`], ['desconocido', 'foo=1'], ['categoriaNoUuid', 'categoria=abc'], ['tamanoCero', 'tamano=0']] as const) {
      const r = await api<{ codigo: string }>(request, `/servicios?${q}`); expect([r.status, r.cuerpo.codigo], nombre).toEqual([400, 'DATOS_INVALIDOS']); rechazos[nombre] = { http: r.status, codigo: r.cuerpo.codigo };
    }
    await hechos(testInfo, 'ca-bus-01-02', {
      filtros: { raiz: 4, hija: 3, zonaCarmenAlto: 3, disponible: 1, todosLosFiltros: 1, zonaSinPrestadores: 0 }, prestadores: { zonaCarmenAlto: 2, disponible: 1 },
      autenticadaIgualQueVisitante: true, parametrosRechazados: rechazos, filtroDeCalificacionOfrecido: false,
    });
  });

  test('CA-BUS-01: la paginación recorre todas las coincidencias sin repetir ni perder ninguna, con el mismo orden y total', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'CA-BUS-01');
    const admin = await operador(request); const cat = await categoria(request, admin, `Paginación ficticia ${sufijo()}`);
    const titular = await prestador(request, 'Prestador Paginación', ['ayacucho'], true, cat.categoriaId);
    const total = 22; const publicados: ServicioApi[] = [];
    for (let i = 1; i <= total; i += 1) publicados.push(await publicar(request, titular.token, `Servicio paginado ${String(i).padStart(2, '0')} ${cat.categoriaId.slice(0, 6)}`, cat.categoriaId));
    const todos = publicados.map((s) => s.titulo).sort();
    // API con página de 7: tres páginas completas más una de 1; el total no cambia y la unión es exacta.
    const vistos: string[] = []; const totales = new Set<number>();
    for (const pagina of [1, 2, 3, 4]) {
      const r = await api<Pagina<{ servicioId: string; titulo: string }>>(request, `/servicios?categoria=${cat.categoriaId}&tamano=7&pagina=${pagina}`);
      expect(r.status).toBe(200); totales.add(r.cuerpo.total); expect(r.cuerpo.elementos).toHaveLength(pagina < 4 ? 7 : 1); vistos.push(...r.cuerpo.elementos.map((e) => e.titulo));
    }
    expect([...totales]).toEqual([total]); expect(new Set(vistos).size).toBe(total); expect([...vistos].sort()).toEqual(todos);
    const repetida = (await api<Pagina<{ titulo: string }>>(request, `/servicios?categoria=${cat.categoriaId}&tamano=7&pagina=2`)).cuerpo.elementos.map((e) => e.titulo);
    expect(repetida).toEqual(vistos.slice(7, 14));
    const fuera = await api<Pagina<unknown>>(request, `/servicios?categoria=${cat.categoriaId}&pagina=99`); expect([fuera.status, fuera.cuerpo.elementos.length, fuera.cuerpo.total]).toEqual([200, 0, total]);

    // En la web (cuenta autenticada): 20 en la primera página y 2 en la segunda, con los filtros intactos.
    const cliente = await crearCuenta(request, 'cliente', 'Cliente ficticio paginación'); const contexto = await browser.newContext({ baseURL: origenWeb, ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}) }); const pagina = await contexto.newPage();
    try {
      await iniciarSesion(pagina, cliente); await abrirBusqueda(pagina, true); await buscarEnUi(pagina, { categoria: cat.nombre });
      await expect(pagina.getByText(`${total} resultados`, { exact: true })).toBeVisible({ timeout: esperaCarga }); await expect(pagina.getByText('Página 1 de 2')).toBeVisible();
      await expect(resultados(pagina, 'Servicio')).toHaveCount(20); await expect(pagina.getByRole('button', { name: 'Anterior' })).toBeDisabled();
      const primera = await resultados(pagina, 'Servicio').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '').replace('Servicio: ', '')));
      await pagina.getByRole('button', { name: 'Siguiente' }).click(); await expect(pagina.getByText('Página 2 de 2')).toBeVisible({ timeout: esperaCarga });
      await expect(resultados(pagina, 'Servicio')).toHaveCount(2); await expect(pagina.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
      const segunda = await resultados(pagina, 'Servicio').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '').replace('Servicio: ', '')));
      expect(new Set([...primera, ...segunda]).size).toBe(total); expect([...primera, ...segunda].sort()).toEqual(todos);
      await pagina.getByRole('button', { name: 'Anterior' }).click(); await expect(pagina.getByText('Página 1 de 2')).toBeVisible({ timeout: esperaCarga });
      await expect(resultados(pagina, 'Servicio')).toHaveCount(20); expect(await resultados(pagina, 'Servicio').evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '').replace('Servicio: ', '')))).toEqual(primera);
      await pagina.getByLabel('Categoría').selectOption({ label: cat.nombre }); await expect(pagina.getByLabel('Categoría')).toHaveValue(cat.categoriaId);
    } finally { await contexto.close(); }
    await hechos(testInfo, 'ca-bus-01-paginacion', {
      total, api: { tamano: 7, paginas: [7, 7, 7, 1], unionExacta: true, sinRepetidos: true, totalConstante: true, paginaRepetidaIgual: true, paginaFueraDeRango: { http: fuera.status, elementos: 0, total: fuera.cuerpo.total } },
      web: { pagina1: 20, pagina2: 2, unionExacta: true, volverAPagina1ConservaElOrden: true },
    });
  });

  test('CA-BUS-03, CA-BUS-04, CA-BUS-05, CA-BUS-07 y CA-BUS-08: detalle y perfil públicos con avisos exactos y sin datos personales', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'CA-BUS-03', 'CA-BUS-04', 'CA-BUS-05', 'CA-BUS-07', 'CA-BUS-08');
    const admin = await operador(request); const cat = await categoria(request, admin, `Perfil ficticio ${sufijo()}`);
    const p = await prestador(request, 'Prestador Perfil', ['ayacucho', 'carmen-alto'], false, cat.categoriaId);
    const s = await publicar(request, p.token, `Servicio de perfil ${sufijo()}`, cat.categoriaId);
    const trabajo = `Trabajo ficticio ${sufijo()}`;
    const t = await request.post('/api/v1/prestadores/perfil/trabajos', { headers: cabecerasEscritura(p.token), data: { versionPerfil: 1, titulo: trabajo, descripcion: 'Trabajo anterior ficticio.' } }); expect(t.status()).toBe(201);
    const parteLocal = p.correo.split('@')[0]!;
    const { pagina, cerrar } = await visitante(browser, testInfo);
    try {
      // Detalle del servicio.
      await pagina.goto(`/servicios/${s.servicioId}`);
      await expect(pagina.getByRole('heading', { name: s.titulo })).toBeVisible({ timeout: esperaCarga }); await expect(pagina.getByText(s.descripcion)).toBeVisible();
      // Perfil público: datos declarados, disponibilidad como declaración, trabajos y los dos avisos exactos.
      await pagina.getByRole('button', { name: 'Ver perfil del prestador' }).click();
      await expect(pagina.getByRole('heading', { name: p.nombrePublico })).toBeVisible({ timeout: esperaCarga });
      const declarada = pagina.getByRole('region', { name: 'Información declarada por el prestador' });
      await expect(declarada.getByText(`Experiencia ficticia de ${p.nombrePublico}.`)).toBeVisible(); await expect(declarada.getByText('Zonas de atención: Ayacucho, Carmen Alto')).toBeVisible();
      await expect(declarada.getByText('Disponibilidad declarada: no. Es una declaración del prestador y no constituye una reserva ni una confirmación.')).toBeVisible();
      await expect(pagina.getByRole('article', { name: `Trabajo: ${trabajo}` })).toBeVisible(); await expect(pagina.getByRole('article', { name: `Servicio: ${s.titulo}` })).toBeVisible();
      const fuentes = pagina.getByRole('region', { name: 'Estado de las fuentes' });
      await expect(fuentes.getByText(avisoCalificaciones, { exact: true })).toBeVisible(); await expect(fuentes.getByText(avisoVerificaciones, { exact: true })).toBeVisible();
      await expect(fuentes.locator('p')).toHaveText([avisoCalificaciones, avisoVerificaciones]);
      // Sin respaldo de 011 ni 012: ni «Sin valoraciones», ni puntuaciones, estrellas, insignias o estados de verificación.
      const texto = await pagina.locator('body').innerText();
      expect(texto).not.toMatch(/sin valoraciones|★|☆|estrella|puntuaci[oó]n|insignia|verificado\b|verificada\b/i);
      expect(texto).not.toContain(p.correo); expect(texto).not.toContain(parteLocal); expect(texto).not.toContain(p.cuentaId);
      // Contenido servido por la API pública: lista cerrada de campos y ningún dato privado de la cuenta.
      const perfil = await api<Record<string, unknown> & { avisos: Record<string, unknown>; servicios: Pagina<Record<string, unknown>>; trabajos: Record<string, unknown>[] }>(request, `/prestadores/${p.prestadorId}`);
      const detalle = await api<Record<string, unknown>>(request, `/servicios/${s.servicioId}`); const resumen = await api<Pagina<Record<string, unknown>>>(request, `/prestadores?especialidad=${cat.categoriaId}`);
      expect([perfil.status, detalle.status, resumen.status]).toEqual([200, 200, 200]);
      expect(Object.keys(perfil.cuerpo).sort()).toEqual(['avisos', 'disponibilidadDeclarada', 'distritos', 'especialidadesIds', 'experiencia', 'nombrePublico', 'prestadorId', 'servicios', 'tipo', 'trabajos']);
      expect(Object.keys(detalle.cuerpo).sort()).toEqual(['categoriaId', 'descripcion', 'estado', 'prestadorId', 'servicioId', 'titulo']);
      expect(Object.keys(resumen.cuerpo.elementos[0]!).sort()).toEqual(['disponibilidadDeclarada', 'distritos', 'especialidadesIds', 'nombrePublico', 'prestadorId', 'tipo']);
      expect(Object.keys(perfil.cuerpo.servicios.elementos[0]!).sort()).toEqual(['categoriaId', 'descripcion', 'estado', 'prestadorId', 'servicioId', 'titulo']);
      expect(Object.keys(perfil.cuerpo.avisos).sort()).toEqual(['calificaciones', 'verificaciones']); expect(perfil.cuerpo.avisos).toEqual({ calificaciones: avisoCalificaciones, verificaciones: avisoVerificaciones });
      for (const [nombre, r] of [['perfil', perfil], ['detalle', detalle], ['resumen', resumen]] as const) {
        const serializado = JSON.stringify(r.cuerpo);
        expect(serializado, nombre).not.toContain(p.correo); expect(serializado, nombre).not.toContain(parteLocal); expect(serializado, nombre).not.toContain(p.cuentaId); expect(serializado, nombre).not.toMatch(/correo|contrasena|contraseña|documento|direccion|dirección|telefono|teléfono|token|hash/i);
      }
      // Documentos o archivos privados: no existe ruta pública que los entregue y no se confirma su existencia.
      const privados: Record<string, number> = {};
      for (const ruta of [`/prestadores/${p.prestadorId}/documentos/${randomUUID()}`, `/prestadores/${p.prestadorId}/documentos`, `/prestadores/${p.prestadorId}/archivos-privados/${randomUUID()}`, `/prestadores/${p.prestadorId}/trabajos/${randomUUID()}/fotografias/${randomUUID()}`]) {
        const r = await request.get(`/api/v1${ruta}`); expect(r.status(), ruta).toBe(404); expect(JSON.stringify(await r.json())).not.toContain(p.prestadorId); privados[ruta.replace(p.prestadorId, '<prestador>').replace(/[0-9a-f-]{36}/g, '<uuid>')] = r.status();
      }
      // El visitante tampoco ve datos de cuenta en la búsqueda web.
      await pagina.goto('/buscar'); await expect(pagina.getByRole('heading', { name: 'Buscar servicios y prestadores' })).toBeVisible({ timeout: esperaCarga });
      await buscarEnUi(pagina, { categoria: cat.nombre }); await esperarResultados(pagina, 'Servicio', [s.titulo]);
      const buscador = await pagina.locator('body').innerText(); expect(buscador).not.toContain(p.correo); expect(buscador).not.toContain(parteLocal);
      expect(buscador).not.toMatch(/sin valoraciones|★|estrella|verificado\b/i);
      await hechos(testInfo, 'ca-bus-03-04-05-07-08', {
        perfilPublico: { campos: Object.keys(perfil.cuerpo).sort(), avisos: perfil.cuerpo.avisos, trabajos: perfil.cuerpo.trabajos.length }, detalleServicio: { campos: Object.keys(detalle.cuerpo).sort() }, resumenPrestador: { campos: Object.keys(resumen.cuerpo.elementos[0]!).sort() },
        disponibilidadMostradaComoDeclaracion: true, textosAusentes: ['Sin valoraciones', 'estrellas', 'puntuaciones', 'insignias', 'estado de verificación'],
        datosPrivadosAusentes: ['correo', 'parte local del correo', 'identificador de cuenta', 'documento', 'dirección', 'teléfono', 'credenciales'], rutasPrivadas: privados,
        casosDeFuentes: 'Con las dos fuentes ausentes (estado real de 002) aparecen ambos avisos; los otros tres casos de disponibilidad se verifican con dobles en backend (T044, T052).',
      });
    } finally { await cerrar(); }
  });

  test('CA-SER-08 y CA-CAT-02: pausado, retirado y oferta oculta por categoría desactivada no aparecen públicamente', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'CA-SER-08', 'CA-CAT-02', 'CA-BUS-01');
    const o = await ofertaDeReferencia(request); const t = (s: ServicioApi) => s.titulo;
    const { pagina, cerrar } = await visitante(browser, testInfo);
    const buscarRaiz = async () => { await pagina.goto('/buscar'); await expect(pagina.getByRole('heading', { name: 'Buscar servicios y prestadores' })).toBeVisible({ timeout: esperaCarga }); await buscarEnUi(pagina, { categoria: o.raiz.nombre }); };
    try {
      await buscarRaiz(); await esperarResultados(pagina, 'Servicio', [t(o.s1), t(o.s2), t(o.s3), t(o.s4)]);
      // El titular del prestador 1 pausa su servicio y el del prestador 3 retira uno de los suyos.
      expect((await transicion(request, o.p1.token, o.s1, 1, 'PAUSADO')).status()).toBe(200); expect((await transicion(request, o.p3.token, o.s3, 1, 'RETIRADO')).status()).toBe(200);
      await buscarRaiz(); await esperarResultados(pagina, 'Servicio', [t(o.s2), t(o.s4)]);
      expect(await titulosApi(request, `categoria=${o.raiz.categoriaId}`)).toEqual([t(o.s2), t(o.s4)].sort());
      for (const s of [o.s1, o.s3]) {
        const r = await request.get(`/api/v1/servicios/${s.servicioId}`); expect([r.status(), ((await r.json()) as { codigo: string }).codigo]).toEqual([404, 'RECURSO_NO_DISPONIBLE']);
        await pagina.goto(`/servicios/${s.servicioId}`); await expect(pagina.getByRole('alert')).toHaveText('El contenido solicitado no está disponible.', { timeout: esperaCarga });
      }
      await pagina.goto(`/prestadores/${o.p1.prestadorId}`); await expect(pagina.getByText('Este prestador no tiene servicios visibles por ahora.')).toBeVisible({ timeout: esperaCarga });
      await expect(pagina.getByRole('article', { name: `Servicio: ${t(o.s1)}` })).toHaveCount(0);

      // Oferta oculta: el operador desactiva la subcategoría y sus servicios dejan de ser públicos sin cambiar su estado ni el del prestador.
      const versionHija = await desactivar(request, o.admin, o.hija.categoriaId, o.hija.version);
      await buscarRaiz(); await esperarResultados(pagina, 'Servicio', []); await expect(pagina.getByText(textoVacio)).toBeVisible({ timeout: esperaCarga });
      expect(await titulosApi(request, `categoria=${o.raiz.categoriaId}`)).toEqual([]);
      const vacioPerfil = ((await api<{ servicios: Pagina<unknown> }>(request, `/prestadores/${o.p2.prestadorId}`)).cuerpo.servicios); expect(vacioPerfil.total).toBe(0);
      expect((await request.get(`/api/v1/servicios/${o.s2.servicioId}`)).status()).toBe(404);
      const propios = (await api<Pagina<ServicioApi>>(request, '/servicios/mios', o.p2.token)).cuerpo.elementos; expect(propios).toEqual([expect.objectContaining({ servicioId: o.s2.servicioId, estado: 'PUBLICADO', version: 1 })]);
      // El prestador sigue siendo público (su perfil existe) aunque su oferta esté oculta.
      expect((await request.get(`/api/v1/prestadores/${o.p2.prestadorId}`)).status()).toBe(200);
      // Al activar de nuevo la subcategoría vuelven los servicios publicados, pero no el pausado ni el retirado.
      await activar(request, o.admin, o.hija.categoriaId, versionHija);
      await buscarRaiz(); await esperarResultados(pagina, 'Servicio', [t(o.s2), t(o.s4)]);
      await hechos(testInfo, 'ca-bus-oferta-oculta', {
        antes: { busqueda: 4 }, trasPausarYRetirar: { busqueda: 2, detalleDelPausado: 404, detalleDelRetirado: 404, mensajeWeb: 'El contenido solicitado no está disponible.', perfilSinServicios: 'Este prestador no tiene servicios visibles por ahora.' },
        trasDesactivarLaCategoria: { busqueda: 0, mensajeWeb: textoVacio, detalle: 404, estadoDelServicioParaSuTitular: 'PUBLICADO', versionConservada: 1, perfilDelPrestador: 200 },
        trasActivarLaCategoria: { busqueda: 2, pausadoYRetiradoSiguenOcultos: true },
      });
    } finally { await cerrar(); }
  });
});
