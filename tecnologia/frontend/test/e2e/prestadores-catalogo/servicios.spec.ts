import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { APIRequestContext, Locator, Page, TestInfo } from '@playwright/test';
import { cabecerasEscritura, criterios, crearCuenta, expect, origenWeb, registrarEvidencia, test, type CuentaE2E } from './soporte.js';

/**
 * T077 · Recorridos de HU04 (servicios del prestador) en Chromium, Firefox y WebKit a 360, 768 y 1366 px, sobre HTTPS con la CA 002 y una base descartable por corrida.
 * El titular publica, edita, pausa, reactiva y retira por la interfaz web real; el visitante, la cuenta ajena y la cuenta solo cliente se comprueban por la API pública y,
 * para la visibilidad, también en el navegador. El operador de la base descartable (E2E_OPERADOR_002) prepara y desactiva categorías ficticias propias de cada prueba.
 * Cada prueba declara los criterios CA-SER que demuestra y adjunta los hechos verificables que el reporte conserva en `hu04/<proyecto>/`. Todos los datos son ficticios.
 */
const esperaEscritura = 60_000;
const alba = '00000000-0000-4000-8000-000000009002';

interface ServicioApi { servicioId: string; prestadorId: string; titulo: string; descripcion: string; categoriaId: string; estado: 'PUBLICADO' | 'PAUSADO' | 'RETIRADO'; version: number }
interface ErrorApi { codigo: string; mensaje: string; detalles: { campo?: string; motivo: string }[] }
const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const aError = async (r: { json(): Promise<unknown> }) => (await r.json()) as ErrorApi;

async function iniciarSesionEnFormulario(page: Page, cuenta: CuentaE2E): Promise<void> {
  await page.getByLabel('Correo').fill(cuenta.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(cuenta.contrasena);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
async function abrirMisServicios(page: Page, cuenta: CuentaE2E): Promise<void> {
  await page.goto('/acceso'); await iniciarSesionEnFormulario(page, cuenta);
  await page.getByRole('link', { name: 'Mis servicios' }).click();
  await expect(page.getByRole('heading', { name: 'Mis servicios' })).toBeVisible({ timeout: esperaEscritura });
}
const estadoUi = (page: Page, texto: string): Locator => page.getByRole('status').filter({ hasText: texto });
const tarjeta = (page: Page, titulo: string): Locator => page.getByRole('article', { name: `Servicio: ${titulo}` });
/** Ejecuta una operación de escritura de la interfaz con un único reintento acotado ante el 503 transitorio que la propia aplicación indica reintentar (queda anotado en la prueba). */
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

async function operador(request: APIRequestContext): Promise<string> {
  const { correo, contrasena } = JSON.parse(await readFile(process.env['E2E_OPERADOR_002']!, 'utf8')) as { correo: string; contrasena: string };
  const r = await request.post('/api/v1/sesiones', { headers: { origin: origenWeb }, data: { correo, contrasena } }); expect(r.status()).toBe(200);
  return ((await r.json()) as { tokenAcceso: string }).tokenAcceso;
}
/** Categoría raíz ficticia, propia de la prueba, creada y activada por el operador de la base descartable. */
async function categoriaPropia(request: APIRequestContext, admin: string): Promise<{ categoriaId: string; nombre: string; version: number }> {
  const nombre = `Categoría ficticia ${randomUUID().slice(0, 8)}`;
  const c = await request.post('/api/v1/admin/categorias', { headers: cabecerasEscritura(admin), data: { nombre, motivo: 'Alta de prueba E2E' } }); expect(c.status()).toBe(201);
  const { categoriaId } = (await c.json()) as { categoriaId: string };
  const a = await request.post(`/api/v1/admin/categorias/${categoriaId}/activaciones`, { headers: cabecerasEscritura(admin), data: { version: 1, motivo: 'Activación de prueba E2E' } }); expect(a.status()).toBe(200);
  return { categoriaId, nombre, version: ((await a.json()) as { version: number }).version };
}
async function desactivarCategoria(request: APIRequestContext, admin: string, categoriaId: string, version: number): Promise<number> {
  const p = await request.post(`/api/v1/admin/categorias/${categoriaId}/previsualizaciones-desactivacion`, { headers: cabecerasEscritura(admin), data: { version } }); expect(p.status()).toBe(201);
  const { confirmacionId } = (await p.json()) as { confirmacionId: string };
  const d = await request.post(`/api/v1/admin/categorias/${categoriaId}/desactivaciones`, { headers: cabecerasEscritura(admin), data: { confirmacionId, version, motivo: 'Baja de prueba E2E' } }); expect(d.status()).toBe(200);
  return ((await d.json()) as { version: number }).version;
}
async function activarCategoria(request: APIRequestContext, admin: string, categoriaId: string, version: number): Promise<number> {
  const a = await request.post(`/api/v1/admin/categorias/${categoriaId}/activaciones`, { headers: cabecerasEscritura(admin), data: { version, motivo: 'Reactivación de prueba E2E' } }); expect(a.status()).toBe(200);
  return ((await a.json()) as { version: number }).version;
}
/** Cuenta prestador con perfil habilitado (la versión 0 crea el perfil). */
async function prestadorHabilitado(request: APIRequestContext, nombre: string): Promise<CuentaE2E & { prestadorId: string }> {
  const cuenta = await crearCuenta(request, 'prestador', nombre);
  const r = await request.put('/api/v1/prestadores/perfil', { headers: cabecerasEscritura(cuenta.token), data: { version: 0, nombrePublico: nombre, tipo: 'TECNICO', experiencia: 'Experiencia ficticia de obra.', especialidadesIds: [alba], distritos: ['ayacucho'], disponibilidadDeclarada: true } });
  expect(r.status()).toBe(201);
  return { ...cuenta, prestadorId: ((await r.json()) as { prestadorId: string }).prestadorId };
}
async function publicarApi(request: APIRequestContext, token: string, titulo: string, categoriaId: string): Promise<ServicioApi> {
  const r = await request.post('/api/v1/servicios', { headers: cabecerasEscritura(token), data: { titulo, descripcion: `Descripción ficticia de ${titulo}.`, categoriaId } }); expect(r.status()).toBe(201);
  return (await r.json()) as ServicioApi;
}
const transicion = (request: APIRequestContext, token: string, id: string, version: number, destino: string) =>
  request.post(`/api/v1/servicios/${id}/transiciones`, { headers: cabecerasEscritura(token), data: { version, destino } });
const editarApi = (request: APIRequestContext, token: string, id: string, version: number, cambios: object) =>
  request.patch(`/api/v1/servicios/${id}`, { headers: cabecerasEscritura(token), data: { version, ...cambios } });
async function propios(request: APIRequestContext, token: string): Promise<ServicioApi[]> {
  const r = await request.get('/api/v1/servicios/mios', { headers: auth(token) }); expect(r.status()).toBe(200); return ((await r.json()) as { elementos: ServicioApi[] }).elementos;
}
const detallePublico = (request: APIRequestContext, id: string) => request.get(`/api/v1/servicios/${id}`);
async function buscar(request: APIRequestContext, categoriaId: string): Promise<string[]> {
  const r = await request.get(`/api/v1/servicios?categoria=${categoriaId}`); expect(r.status()).toBe(200);
  return ((await r.json()) as { elementos: { servicioId: string }[] }).elementos.map((e) => e.servicioId);
}
async function perfilPublico(request: APIRequestContext, prestadorId: string): Promise<string[]> {
  const r = await request.get(`/api/v1/prestadores/${prestadorId}`); expect(r.status()).toBe(200);
  return ((await r.json()) as { servicios: { elementos: { servicioId: string }[] } }).servicios.elementos.map((e) => e.servicioId);
}
const noDisponible = async (r: { status(): number; json(): Promise<unknown> }) => { const e = await aError(r); expect([r.status(), e.codigo]).toEqual([404, 'RECURSO_NO_DISPONIBLE']); return e; };

test.describe('HU04 · servicios del prestador: publicación, ciclo de vida y visibilidad', () => {
  test.describe.configure({ timeout: 240_000 });

  test('CA-SER-01, CA-SER-05, CA-SER-07 y CA-SER-02: el titular publica, edita, pausa, edita en pausa, reactiva y retira en la web', async ({ page, request }, testInfo) => {
    criterios(testInfo, 'CA-SER-01', 'CA-SER-02', 'CA-SER-05', 'CA-SER-07');
    const titular = await prestadorHabilitado(request, 'Titular ficticio HU04');
    await abrirMisServicios(page, titular);
    await expect(page.getByText('Aún no ha publicado servicios.')).toBeVisible();

    // CA-SER-01: publica un servicio en una categoría activa.
    const titulo = 'Albañilería de muros ficticia';
    await escribirUi(page, testInfo, async () => {
      await page.getByLabel('Título del servicio').fill(titulo); await page.getByLabel('Descripción del servicio').fill('Levantamiento de muros de ladrillo, descripción ficticia.');
      await page.getByLabel('Categoría del servicio').selectOption({ value: alba }); await page.getByRole('button', { name: 'Publicar servicio' }).click();
    }, 'Servicio publicado.');
    await expect(tarjeta(page, titulo).getByText('Estado: Publicado · versión 1')).toBeVisible();
    let servicios = await propios(request, titular.token); expect(servicios).toHaveLength(1);
    const original = servicios[0]!; expect(original).toMatchObject({ titulo, estado: 'PUBLICADO', version: 1, categoriaId: alba, prestadorId: titular.prestadorId });
    expect((await detallePublico(request, original.servicioId)).status()).toBe(200);

    // CA-SER-01: edita título y descripción; conserva identificador, categoría y estado, y sube la versión.
    const titulo2 = 'Albañilería de muros y tabiques ficticia';
    await tarjeta(page, titulo).getByRole('button', { name: `Editar ${titulo}` }).click();
    await escribirUi(page, testInfo, async () => {
      const f = page.getByRole('form', { name: `Edición de ${titulo}` });
      await f.getByLabel('Título').fill(titulo2); await f.getByLabel('Descripción').fill('Muros y tabiques de ladrillo, descripción ficticia editada.');
      await f.getByRole('button', { name: 'Guardar cambios' }).click();
    }, 'Servicio actualizado.');
    await expect(tarjeta(page, titulo2).getByText('Estado: Publicado · versión 2')).toBeVisible();
    servicios = await propios(request, titular.token);
    expect(servicios[0]).toMatchObject({ servicioId: original.servicioId, titulo: titulo2, estado: 'PUBLICADO', version: 2, categoriaId: alba });
    const publicoEditado = (await (await detallePublico(request, original.servicioId)).json()) as ServicioApi; expect(publicoEditado.titulo).toBe(titulo2);

    // Pausa: el servicio deja de verse en lo público y se conserva con su identificador.
    await escribirUi(page, testInfo, () => tarjeta(page, titulo2).getByRole('button', { name: `Pausar ${titulo2}` }).click(), 'Servicio pausado.');
    await expect(tarjeta(page, titulo2).getByText('Estado: Pausado · versión 3')).toBeVisible();
    await noDisponible(await detallePublico(request, original.servicioId));

    // CA-SER-05: un servicio pausado se puede editar y mantiene su estado.
    const titulo3 = 'Albañilería de muros pausada y revisada';
    await tarjeta(page, titulo2).getByRole('button', { name: `Editar ${titulo2}` }).click();
    await escribirUi(page, testInfo, async () => {
      const f = page.getByRole('form', { name: `Edición de ${titulo2}` }); await f.getByLabel('Título').fill(titulo3); await f.getByRole('button', { name: 'Guardar cambios' }).click();
    }, 'Servicio actualizado.');
    await expect(tarjeta(page, titulo3).getByText('Estado: Pausado · versión 4')).toBeVisible();
    expect(await propios(request, titular.token)).toEqual([expect.objectContaining({ servicioId: original.servicioId, titulo: titulo3, estado: 'PAUSADO', version: 4 })]);
    await noDisponible(await detallePublico(request, original.servicioId));

    // CA-SER-05: reactivación; vuelve a ser público.
    await escribirUi(page, testInfo, () => tarjeta(page, titulo3).getByRole('button', { name: `Reactivar ${titulo3}` }).click(), 'Servicio reactivado.');
    await expect(tarjeta(page, titulo3).getByText('Estado: Publicado · versión 5')).toBeVisible();
    const reactivado = await detallePublico(request, original.servicioId); expect(reactivado.status()).toBe(200); expect(((await reactivado.json()) as ServicioApi).titulo).toBe(titulo3);

    // Retiro con confirmación: «Cancelar retiro» no cambia nada y «Confirmar retiro» lo hace definitivo.
    await tarjeta(page, titulo3).getByRole('button', { name: `Retirar ${titulo3}` }).click();
    await expect(page.getByText('El retiro es definitivo: el servicio quedará de solo lectura.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar retiro' }).click();
    await expect(tarjeta(page, titulo3).getByText('Estado: Publicado · versión 5')).toBeVisible();
    await tarjeta(page, titulo3).getByRole('button', { name: `Retirar ${titulo3}` }).click();
    await escribirUi(page, testInfo, () => page.getByRole('button', { name: `Confirmar retiro de ${titulo3}` }).click(), 'Servicio retirado.');

    // CA-SER-07: RETIRADO es de solo lectura en la web y en la API.
    const retirado = tarjeta(page, titulo3);
    await expect(retirado.getByText('Estado: Retirado · versión 6')).toBeVisible(); await expect(retirado.getByText('Registro histórico de solo lectura. No admite cambios.')).toBeVisible();
    await expect(retirado.getByRole('button')).toHaveCount(0);
    const editarRetirado = await editarApi(request, titular.token, original.servicioId, 6, { titulo: 'Intento de edición' }); const errEditar = await aError(editarRetirado);
    const reactivarRetirado = await transicion(request, titular.token, original.servicioId, 6, 'PUBLICADO'); const errReactivar = await aError(reactivarRetirado);
    const pausarRetirado = await transicion(request, titular.token, original.servicioId, 6, 'PAUSADO'); const errPausar = await aError(pausarRetirado);
    expect([[editarRetirado.status(), errEditar.codigo], [reactivarRetirado.status(), errReactivar.codigo], [pausarRetirado.status(), errPausar.codigo]]).toEqual(Array(3).fill([422, 'SERVICIO_RETIRADO']));
    const despues = await propios(request, titular.token);
    expect(despues).toEqual([expect.objectContaining({ servicioId: original.servicioId, titulo: titulo3, estado: 'RETIRADO', version: 6, categoriaId: alba })]);
    await noDisponible(await detallePublico(request, original.servicioId));
    // Recargar la página: el retiro se conserva (historial).
    await page.reload(); await expect(page.getByRole('heading', { name: 'Mis servicios' }).or(page.getByRole('heading', { name: 'Iniciar sesión' })).first()).toBeVisible({ timeout: esperaEscritura });
    await evidencia(testInfo, 'ca-ser-01-02-05-07', {
      servicioId: original.servicioId, versiones: { publicado: 1, editado: 2, pausado: 3, editadoPausado: 4, reactivado: 5, retirado: 6 },
      retiradoSoloLectura: { editar: { http: editarRetirado.status(), codigo: errEditar.codigo }, reactivar: { http: reactivarRetirado.status(), codigo: errReactivar.codigo }, pausar: { http: pausarRetirado.status(), codigo: errPausar.codigo } },
      conservadoTrasRetiro: { servicioId: despues[0]!.servicioId, estado: despues[0]!.estado, titulo: despues[0]!.titulo, categoriaId: despues[0]!.categoriaId, detallePublico: 404 },
    });
  });

  test('CA-SER-03: visitante, cuenta solo cliente, perfil no habilitado y prestador ajeno no publican ni modifican servicios', async ({ browser, request }, testInfo) => {
    criterios(testInfo, 'CA-SER-03');
    const admin = await operador(request); const categoria = await categoriaPropia(request, admin);
    const titular = await prestadorHabilitado(request, 'Titular ficticio HU04 CA-SER-03'); const ajeno = await prestadorHabilitado(request, 'Prestador ajeno ficticio');
    const cliente = await crearCuenta(request, 'cliente', 'Cliente ficticio'); const sinPerfil = await crearCuenta(request, 'prestador', 'Prestador sin perfil ficticio');
    const servicio = await publicarApi(request, titular.token, 'Servicio del titular ficticio', categoria.categoriaId);
    const antes = JSON.stringify(await propios(request, titular.token));
    const cuerpo = { titulo: 'Servicio no autorizado', descripcion: 'Descripción no autorizada.', categoriaId: categoria.categoriaId };
    const intentos: Record<string, Record<string, { http: number; codigo: string }>> = {};
    const registrar = async (quien: string, accion: string, r: { status(): number; json(): Promise<unknown> }, http: number, codigo: string) => {
      const e = await aError(r); expect([r.status(), e.codigo], `${quien}: ${accion}`).toEqual([http, codigo]); (intentos[quien] ??= {})[accion] = { http: r.status(), codigo: e.codigo };
    };
    // Visitante: 401 en toda escritura y en el listado propio.
    await registrar('visitante', 'publicar', await request.post('/api/v1/servicios', { headers: cabecerasEscritura(), data: cuerpo }), 401, 'NO_AUTENTICADO');
    await registrar('visitante', 'editar', await request.patch(`/api/v1/servicios/${servicio.servicioId}`, { headers: cabecerasEscritura(), data: { version: 1, titulo: 'x'.repeat(5) } }), 401, 'NO_AUTENTICADO');
    await registrar('visitante', 'pausar', await request.post(`/api/v1/servicios/${servicio.servicioId}/transiciones`, { headers: cabecerasEscritura(), data: { version: 1, destino: 'PAUSADO' } }), 401, 'NO_AUTENTICADO');
    await registrar('visitante', 'mios', await request.get('/api/v1/servicios/mios'), 401, 'NO_AUTENTICADO');
    // Cuenta solo cliente: 403; cuenta de prestador sin perfil habilitado: la operación se presenta como no disponible.
    for (const [quien, cuenta, http, codigo] of [['cliente', cliente, 403, 'SIN_PERMISO'], ['prestadorSinPerfil', sinPerfil, 404, 'RECURSO_NO_DISPONIBLE']] as const) {
      await registrar(quien, 'publicar', await request.post('/api/v1/servicios', { headers: cabecerasEscritura(cuenta.token), data: cuerpo }), http, codigo);
      await registrar(quien, 'editar', await editarApi(request, cuenta.token, servicio.servicioId, 1, { titulo: 'Título ajeno' }), http, codigo);
      await registrar(quien, 'pausar', await transicion(request, cuenta.token, servicio.servicioId, 1, 'PAUSADO'), http, codigo);
      if (quien === 'cliente') await registrar(quien, 'mios', await request.get('/api/v1/servicios/mios', { headers: auth(cuenta.token) }), http, codigo);
    }
    // Sin perfil habilitado no hay servicios propios: la lista es vacía y nunca incluye los del titular.
    expect(await propios(request, sinPerfil.token)).toEqual([]);
    // Prestador ajeno habilitado: no distingue «no existe» de «no es suyo» (404) y no ve el servicio en sus propios.
    await registrar('prestadorAjeno', 'editar', await editarApi(request, ajeno.token, servicio.servicioId, 1, { titulo: 'Título ajeno' }), 404, 'RECURSO_NO_DISPONIBLE');
    await registrar('prestadorAjeno', 'pausar', await transicion(request, ajeno.token, servicio.servicioId, 1, 'PAUSADO'), 404, 'RECURSO_NO_DISPONIBLE');
    await registrar('prestadorAjeno', 'retirar', await transicion(request, ajeno.token, servicio.servicioId, 1, 'RETIRADO'), 404, 'RECURSO_NO_DISPONIBLE');
    expect(await propios(request, ajeno.token)).toEqual([]);
    // Nada cambió: mismo estado, versión y contenido; sigue publicado.
    expect(JSON.stringify(await propios(request, titular.token))).toBe(antes);
    expect((await detallePublico(request, servicio.servicioId)).status()).toBe(200);
    // En la web, el visitante que abre la sección de servicios propios no ve nada del titular y se le pide iniciar sesión.
    const visitante = await browser.newContext({ baseURL: origenWeb, ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}) }); const pagina = await visitante.newPage();
    try {
      await pagina.goto('/prestador/servicios');
      await expect(pagina.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible({ timeout: esperaEscritura });
      await expect(pagina.getByRole('heading', { name: 'Mis servicios' })).toHaveCount(0); await expect(pagina.getByText('Servicio del titular ficticio')).toHaveCount(0);
    } finally { await visitante.close(); }
    await evidencia(testInfo, 'ca-ser-03', { intentos, servicioConservado: { servicioId: servicio.servicioId, estado: 'PUBLICADO', version: 1 }, visitanteEnLaWeb: 'se le pide iniciar sesión y no ve servicios propios' });
  });

  test('CA-SER-04, CA-SER-06 y CA-SER-09: una categoría desactivada impide publicar y reactivar, y sus servicios dejan de ser elegibles', async ({ page, request }, testInfo) => {
    criterios(testInfo, 'CA-SER-04', 'CA-SER-06', 'CA-SER-09');
    const admin = await operador(request); const categoria = await categoriaPropia(request, admin);
    const titular = await prestadorHabilitado(request, 'Titular ficticio HU04 categorías');
    const pausado = await publicarApi(request, titular.token, 'Servicio a pausar por categoría', categoria.categoriaId);
    const visible = await publicarApi(request, titular.token, 'Servicio visible por categoría', categoria.categoriaId);
    expect((await transicion(request, titular.token, pausado.servicioId, 1, 'PAUSADO')).status()).toBe(200);
    // Antes de desactivar: el servicio publicado es elegible (detalle, búsqueda por categoría y perfil público).
    expect((await detallePublico(request, visible.servicioId)).status()).toBe(200);
    expect(await buscar(request, categoria.categoriaId)).toEqual([visible.servicioId]); expect(await perfilPublico(request, titular.prestadorId)).toEqual([visible.servicioId]);
    // El operador desactiva la categoría.
    const versionInactiva = await desactivarCategoria(request, admin, categoria.categoriaId, categoria.version);
    const categoriasPublicas = ((await (await request.get('/api/v1/categorias')).json()) as { categorias: { categoriaId: string }[] }).categorias;
    expect(categoriasPublicas.some((c) => c.categoriaId === categoria.categoriaId)).toBe(false);

    // CA-SER-04: no se admiten nuevas publicaciones en la categoría desactivada (API y web).
    const nuevo = await request.post('/api/v1/servicios', { headers: cabecerasEscritura(titular.token), data: { titulo: 'Nuevo en categoría inactiva', descripcion: 'Descripción ficticia.', categoriaId: categoria.categoriaId } });
    const errNuevo = await aError(nuevo); expect([nuevo.status(), errNuevo.codigo, errNuevo.detalles]).toEqual([422, 'CATEGORIA_NO_ACTIVA', [{ campo: 'categoriaId', motivo: 'La clasificación no está activa.' }]]);
    const inexistente = await request.post('/api/v1/servicios', { headers: cabecerasEscritura(titular.token), data: { titulo: 'Nuevo en categoría inexistente', descripcion: 'Descripción ficticia.', categoriaId: randomUUID() } });
    expect([inexistente.status(), (await aError(inexistente)).codigo]).toEqual([422, 'CATEGORIA_NO_ACTIVA']);
    const seedInactiva = await request.post('/api/v1/servicios', { headers: cabecerasEscritura(titular.token), data: { titulo: 'Nuevo en Electricidad', descripcion: 'Descripción ficticia.', categoriaId: '00000000-0000-4000-8000-000000009003' } });
    expect([seedInactiva.status(), (await aError(seedInactiva)).codigo]).toEqual([422, 'CATEGORIA_NO_ACTIVA']);

    // CA-SER-09: el servicio publicado de esa categoría deja de ser elegible: no hay detalle, ni búsqueda, ni lugar en el perfil público. El titular lo sigue viendo como suyo.
    await noDisponible(await detallePublico(request, visible.servicioId));
    expect(await buscar(request, categoria.categoriaId)).toEqual([]); expect(await perfilPublico(request, titular.prestadorId)).toEqual([]);
    expect((await propios(request, titular.token)).find((s) => s.servicioId === visible.servicioId)).toMatchObject({ estado: 'PUBLICADO', version: 1 });

    // CA-SER-06: la reactivación del servicio pausado se rechaza y lo deja pausado; en la web se muestra el motivo.
    const rechazo = await transicion(request, titular.token, pausado.servicioId, 2, 'PUBLICADO'); const errRechazo = await aError(rechazo);
    expect([rechazo.status(), errRechazo.codigo]).toEqual([422, 'CATEGORIA_NO_ACTIVA']);
    expect((await propios(request, titular.token)).find((s) => s.servicioId === pausado.servicioId)).toMatchObject({ estado: 'PAUSADO', version: 2 });
    await abrirMisServicios(page, titular);
    await expect(tarjeta(page, pausado.titulo).getByText('Estado: Pausado · versión 2')).toBeVisible({ timeout: esperaEscritura });
    await tarjeta(page, pausado.titulo).getByRole('button', { name: `Reactivar ${pausado.titulo}` }).click();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: esperaEscritura }); const mensajeWeb = (await page.getByRole('alert').first().innerText()).trim();
    await expect(tarjeta(page, pausado.titulo).getByText('Estado: Pausado · versión 2')).toBeVisible();
    // La categoría desactivada no se ofrece para publicar en la web.
    await expect(page.getByLabel('Categoría del servicio').locator('option', { hasText: categoria.nombre })).toHaveCount(0);

    // Al activar de nuevo la categoría, vuelve la elegibilidad y la reactivación se admite.
    await activarCategoria(request, admin, categoria.categoriaId, versionInactiva);
    expect((await detallePublico(request, visible.servicioId)).status()).toBe(200); expect(await buscar(request, categoria.categoriaId)).toEqual([visible.servicioId]);
    await escribirUi(page, testInfo, async () => { await page.reload(); await expect(tarjeta(page, pausado.titulo)).toBeVisible({ timeout: esperaEscritura }); await tarjeta(page, pausado.titulo).getByRole('button', { name: `Reactivar ${pausado.titulo}` }).click(); }, 'Servicio reactivado.');
    expect((await propios(request, titular.token)).find((s) => s.servicioId === pausado.servicioId)).toMatchObject({ estado: 'PUBLICADO', version: 3 });
    expect((await buscar(request, categoria.categoriaId)).sort()).toEqual([pausado.servicioId, visible.servicioId].sort());
    await evidencia(testInfo, 'ca-ser-04-06-09', {
      publicarEnCategoriaInactiva: { http: nuevo.status(), codigo: errNuevo.codigo, detalles: errNuevo.detalles }, categoriaInexistente: { http: inexistente.status(), codigo: 'CATEGORIA_NO_ACTIVA' }, categoriaSembradaInactiva: { http: seedInactiva.status(), codigo: 'CATEGORIA_NO_ACTIVA' },
      reactivarConCategoriaInactiva: { http: rechazo.status(), codigo: errRechazo.codigo, estadoTrasRechazo: 'PAUSADO', versionTrasRechazo: 2, mensajeEnLaWeb: mensajeWeb },
      elegibilidadConCategoriaInactiva: { detallePublico: 404, busquedaPorCategoria: 0, perfilPublico: 0, visibleParaElTitular: true }, elegibilidadTrasActivar: { detallePublico: 200, busquedaPorCategoria: 1 },
    });
  });

  test('CA-SER-08: un servicio pausado o retirado no aparece en la búsqueda ni en el perfil público y su enlace directo indica que no está disponible', async ({ browser, page, request }, testInfo) => {
    criterios(testInfo, 'CA-SER-08', 'CA-SER-02');
    const admin = await operador(request); const categoria = await categoriaPropia(request, admin);
    const titular = await prestadorHabilitado(request, 'Titular ficticio HU04 visibilidad');
    const a = await publicarApi(request, titular.token, 'Servicio A visible ficticio', categoria.categoriaId); const b = await publicarApi(request, titular.token, 'Servicio B visible ficticio', categoria.categoriaId);
    const visitante = await browser.newContext({ baseURL: origenWeb, ...(testInfo.project.use.viewport ? { viewport: testInfo.project.use.viewport } : {}) }); const publica = await visitante.newPage();
    const enlaceDirecto = async (id: string) => {
      await publica.goto(`/servicios/${id}`);
      await expect(publica.getByRole('alert').filter({ hasText: 'El contenido solicitado no está disponible.' }).or(publica.getByRole('heading', { level: 2 })).first()).toBeVisible({ timeout: esperaEscritura });
    };
    try {
      // Antes: ambos aparecen en la búsqueda, en el perfil público (web) y por su enlace directo (web).
      expect((await buscar(request, categoria.categoriaId)).sort()).toEqual([a.servicioId, b.servicioId].sort());
      await publica.goto(`/prestadores/${titular.prestadorId}`);
      await expect(tarjeta(publica, a.titulo)).toBeVisible({ timeout: esperaEscritura }); await expect(tarjeta(publica, b.titulo)).toBeVisible();
      await enlaceDirecto(a.servicioId); await expect(publica.getByRole('heading', { name: a.titulo })).toBeVisible();

      // El titular pausa A y retira B en la web.
      await abrirMisServicios(page, titular);
      await escribirUi(page, testInfo, () => tarjeta(page, a.titulo).getByRole('button', { name: `Pausar ${a.titulo}` }).click(), 'Servicio pausado.');
      await tarjeta(page, b.titulo).getByRole('button', { name: `Retirar ${b.titulo}` }).click();
      await escribirUi(page, testInfo, () => page.getByRole('button', { name: `Confirmar retiro de ${b.titulo}` }).click(), 'Servicio retirado.');

      // Después: la búsqueda no los devuelve, el perfil público no los lista y el enlace directo dice que no están disponibles.
      expect(await buscar(request, categoria.categoriaId)).toEqual([]); expect(await perfilPublico(request, titular.prestadorId)).toEqual([]);
      const errA = await noDisponible(await detallePublico(request, a.servicioId)); const errB = await noDisponible(await detallePublico(request, b.servicioId));
      await publica.goto(`/prestadores/${titular.prestadorId}`);
      await expect(publica.getByText('Este prestador no tiene servicios visibles por ahora.')).toBeVisible({ timeout: esperaEscritura });
      await expect(tarjeta(publica, a.titulo)).toHaveCount(0); await expect(tarjeta(publica, b.titulo)).toHaveCount(0);
      for (const id of [a.servicioId, b.servicioId]) {
        await enlaceDirecto(id);
        await expect(publica.getByRole('alert')).toHaveText('El contenido solicitado no está disponible.'); await expect(publica.getByRole('heading', { level: 2 })).toHaveCount(0);
      }
      // CA-SER-02 (parte observable): se conservan, con identificador, contenido y categoría, para el titular.
      const conservados = await propios(request, titular.token);
      expect(conservados.map((s) => [s.servicioId, s.estado, s.titulo, s.categoriaId]).sort()).toEqual([[a.servicioId, 'PAUSADO', a.titulo, categoria.categoriaId], [b.servicioId, 'RETIRADO', b.titulo, categoria.categoriaId]].sort());
      // Un servicio inexistente se presenta igual que uno pausado o retirado.
      const sinServicio = await detallePublico(request, randomUUID()); const errNo = await noDisponible(sinServicio);
      expect(errNo).toEqual(errA); expect(errNo).toEqual(errB);
      // La caché de la búsqueda no conserva resultados caducados: tras reactivar A reaparece de inmediato.
      await escribirUi(page, testInfo, () => tarjeta(page, a.titulo).getByRole('button', { name: `Reactivar ${a.titulo}` }).click(), 'Servicio reactivado.');
      expect(await buscar(request, categoria.categoriaId)).toEqual([a.servicioId]); expect(await perfilPublico(request, titular.prestadorId)).toEqual([a.servicioId]);
      await evidencia(testInfo, 'ca-ser-08', {
        antes: { busqueda: 2, perfilPublico: 2, enlaceDirecto: 200 },
        pausado: { detalle: 404, codigo: errA.codigo }, retirado: { detalle: 404, codigo: errB.codigo }, inexistenteIgualQueNoDisponible: true,
        despues: { busqueda: 0, perfilPublico: 0, mensajeEnlaceDirecto: 'El contenido solicitado no está disponible.', perfilSinServicios: 'Este prestador no tiene servicios visibles por ahora.' },
        titularConservaAmbos: { pausado: a.servicioId, retirado: b.servicioId }, trasReactivarElPausado: { busqueda: 1, perfilPublico: 1 },
      });
    } finally { await visitante.close(); }
  });
});
