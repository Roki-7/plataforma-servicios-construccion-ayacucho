import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

/**
 * Interfaz compuesta (T072): la aplicación real con `fetch` simulado. Cada prueba reinicia los módulos para tener una sesión nueva.
 * Comprueba la consulta pública sin sesión, el uso de la sesión existente en los flujos de Prestadores y Catálogo, el destino tras iniciar sesión y la conservación de los recorridos base.
 */
interface Llamada { readonly metodo: string; readonly ruta: string; readonly autorizacion: string | null; readonly credenciales: RequestCredentials | undefined; readonly clave: string | null }
const json = (http: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status: http, headers: { 'Content-Type': 'application/json' } });
const noAutenticado = () => json(401, { codigo: 'SESION_NO_VALIDA', mensaje: 'Debe autenticarse.', detalles: [] });
const token = 'a'.repeat(43);
const sesionResultado = () => ({ tokenAcceso: token, tipo: 'Bearer', expiraEnSegundos: 900, renovacionVenceEn: new Date(Date.now() + 3600_000).toISOString(), autenticacionConContrasenaEn: new Date().toISOString(), csrfToken: 'c'.repeat(43) });
const categorias = { categorias: [
  { categoriaId: '00000000-0000-4000-8000-000000000001', categoriaPadreId: null, nombre: 'Construcción' },
  { categoriaId: '00000000-0000-4000-8000-000000000002', categoriaPadreId: '00000000-0000-4000-8000-000000000001', nombre: 'Albañilería' },
  { categoriaId: '00000000-0000-4000-8000-000000000003', categoriaPadreId: null, nombre: 'Acabados' },
] };
const pagina = { elementos: [], total: 0, pagina: 1, tamano: 20 };
const perfilCuenta = (perfiles: string[]) => ({ cuentaId: 'c', nombreMostrar: 'Persona ficticia', correo: 'ficticio@example.invalid', telefono: null, distrito: null, fotografiaId: null, perfiles, telefonoCompartible: true, version: 1 });
type Respuesta = (ruta: string, metodo: string, cuerpo: string | null) => Response | undefined;

/** Monta la aplicación en `ruta`. `sesionActiva` simula una sesión recuperable por la cookie de renovación. */
async function montar(ruta: string, opciones: { sesionActiva?: boolean; respuestas?: Respuesta } = {}) {
  vi.resetModules();
  history.replaceState(null, '', ruta);
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_n: string, _o: unknown, trabajo: () => Promise<unknown>) => trabajo() } });
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost'); const ruta2 = url.pathname.replace('/api/v1', '') + url.search; const metodo = init?.method ?? 'GET'; const h = new Headers(init?.headers);
    llamadas.push({ metodo, ruta: ruta2, autorizacion: h.get('Authorization'), credenciales: init?.credentials, clave: h.get('Idempotency-Key') });
    const propia = opciones.respuestas?.(ruta2, metodo, typeof init?.body === 'string' ? init.body : null); if (propia) return propia;
    if (ruta2 === '/sesiones/csrf') return opciones.sesionActiva ? json(200, { csrfToken: 'c'.repeat(43) }) : noAutenticado();
    if (ruta2 === '/sesiones/renovacion') return opciones.sesionActiva ? json(200, sesionResultado()) : noAutenticado();
    if (ruta2 === '/sesiones' && metodo === 'POST') return json(200, sesionResultado());
    if (ruta2 === '/categorias') return json(200, categorias);
    if (ruta2.startsWith('/servicios?') || ruta2.startsWith('/prestadores?')) return json(200, pagina);
    return json(404, { codigo: 'RECURSO_NO_DISPONIBLE', mensaje: 'Recurso no disponible.', detalles: [] });
  });
  const { App } = await import('../../../src/composicion/App.js');
  render(<App />);
  return { llamadas };
}
const enlaces = () => within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('link').map(a => a.textContent);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetModules(); history.replaceState(null, '', '/'); });

test('la búsqueda pública funciona sin sesión: sin credenciales ni Authorization, con las categorías activas como filtro', async () => {
  const { llamadas } = await montar('/buscar');
  expect(await screen.findByRole('heading', { name: 'Buscar servicios y prestadores' })).toBeInTheDocument();
  const filtro = await screen.findByLabelText('Categoría');
  expect(within(filtro).getAllByRole('option').map(o => o.textContent)).toEqual(['Todas', 'Construcción', 'Construcción › Albañilería', 'Acabados']);
  await waitFor(() => expect(llamadas.some(l => l.ruta.startsWith('/servicios?'))).toBe(true));
  for (const l of llamadas.filter(x => x.ruta === '/categorias' || x.ruta.startsWith('/servicios?') || x.ruta.startsWith('/prestadores?'))) { expect(l.autorizacion).toBeNull(); expect(l.credenciales).toBe('omit'); expect(l.metodo).toBe('GET'); }
  expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).toBeNull();
  expect(enlaces()).toEqual(['Buscar servicios', 'Crear cuenta', 'Acceder']);
});

test('la búsqueda sigue disponible si las categorías no cargan, sin el filtro de categoría', async () => {
  await montar('/buscar', { respuestas: ruta => ruta === '/categorias' ? json(503, { codigo: 'DEPENDENCIA_NO_DISPONIBLE', mensaje: 'Servicio temporalmente no disponible.', detalles: [] }) : undefined });
  expect(await screen.findByRole('heading', { name: 'Buscar servicios y prestadores' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/No hay coincidencias/)).toBeInTheDocument());
  expect(screen.queryByLabelText('Categoría')).toBeNull();
});

test('con sesión, las consultas públicas siguen siendo anónimas y la navegación ofrece los flujos profesionales', async () => {
  const { llamadas } = await montar('/buscar', { sesionActiva: true });
  await screen.findByRole('heading', { name: 'Buscar servicios y prestadores' });
  await waitFor(() => expect(enlaces()).toEqual(expect.arrayContaining(['Buscar servicios', 'Mi cuenta', 'Mi perfil profesional', 'Mis servicios'])));
  await waitFor(() => expect(llamadas.some(l => l.ruta === '/categorias')).toBe(true));
  for (const l of llamadas.filter(x => x.ruta === '/categorias' || x.ruta.startsWith('/servicios?'))) { expect(l.autorizacion).toBeNull(); expect(l.credenciales).toBe('omit'); }
});

test('un visitante en una pantalla profesional ve el acceso y, tras iniciar sesión, vuelve a esa misma pantalla', async () => {
  const { llamadas } = await montar('/prestador/servicios', { respuestas: (ruta, metodo) => {
    if (ruta === '/perfil' && metodo === 'GET') return json(200, perfilCuenta(['cliente', 'prestador']));
    if (ruta.startsWith('/servicios/mios')) return json(200, { elementos: [], total: 0, pagina: 1, tamano: 20 });
    return undefined;
  } });
  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(llamadas.some(l => l.ruta.startsWith('/servicios/mios'))).toBe(false);
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ficticio@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: ' una frase privada de prueba ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(await screen.findByLabelText('Categoría del servicio')).toBeInTheDocument();
  expect(location.pathname).toBe('/prestador/servicios');
  const mios = llamadas.find(l => l.ruta.startsWith('/servicios/mios'))!;
  expect(mios.autorizacion).toBe(`Bearer ${token}`);
  const perfil = llamadas.find(l => l.ruta === '/perfil')!; expect(perfil.autorizacion).toBe(`Bearer ${token}`);
  expect(within(screen.getByLabelText('Categoría del servicio')).getAllByRole('option').map(o => o.textContent)).toEqual(['Construcción', 'Construcción › Albañilería', 'Acabados']);
});

test('desde un recorrido base el acceso conserva su destino habitual: Mi cuenta', async () => {
  await montar('/acceso', { respuestas: (ruta, metodo) => ruta === '/perfil' && metodo === 'GET' ? json(200, perfilCuenta(['cliente'])) : undefined });
  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ficticio@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: ' una frase privada de prueba ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  await waitFor(() => expect(location.pathname).toBe('/cuenta'));
});

test('una cuenta sin perfil de prestador no llama a los servicios profesionales y puede habilitarlo', async () => {
  const { llamadas } = await montar('/prestador/perfil', { sesionActiva: true, respuestas: (ruta, metodo) => ruta === '/perfil' && metodo === 'GET' ? json(200, perfilCuenta(['cliente'])) : undefined });
  expect(await screen.findByRole('heading', { name: 'Perfil de prestador requerido' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Habilitar perfil de prestador' })).toHaveAttribute('href', '/habilitar-perfil');
  expect(llamadas.some(l => l.ruta.startsWith('/prestadores/perfil'))).toBe(false);
  expect(llamadas.some(l => l.ruta === '/categorias')).toBe(false);
});

test('el perfil profesional ofrece las categorías activas como especialidades y usa la sesión existente', async () => {
  const { llamadas } = await montar('/prestador/perfil', { sesionActiva: true, respuestas: (ruta, metodo) => {
    if (ruta === '/perfil' && metodo === 'GET') return json(200, perfilCuenta(['cliente', 'prestador']));
    if (ruta === '/prestadores/perfil') return json(404, { codigo: 'RECURSO_NO_DISPONIBLE', mensaje: 'Recurso no disponible.', detalles: [] });
    return undefined;
  } });
  const grupo = await screen.findByRole('group', { name: 'Especialidades' });
  expect(within(grupo).getAllByRole('checkbox').map(c => c.parentElement?.textContent)).toEqual(['Construcción', 'Construcción › Albañilería', 'Acabados']);
  const consulta = llamadas.find(l => l.ruta === '/prestadores/perfil')!; expect(consulta.autorizacion).toBe(`Bearer ${token}`);
});

test('si las categorías no cargan, las pantallas profesionales lo informan y permiten reintentar', async () => {
  let intentos = 0;
  await montar('/prestador/servicios', { sesionActiva: true, respuestas: (ruta, metodo) => {
    if (ruta === '/perfil' && metodo === 'GET') return json(200, perfilCuenta(['cliente', 'prestador']));
    if (ruta.startsWith('/servicios/mios')) return json(200, { elementos: [], total: 0, pagina: 1, tamano: 20 });
    if (ruta === '/categorias') { intentos++; return intentos === 1 ? json(503, { codigo: 'DEPENDENCIA_NO_DISPONIBLE', mensaje: 'Servicio temporalmente no disponible.', detalles: [] }) : undefined; }
    return undefined;
  } });
  expect(await screen.findByText('No fue posible cargar las categorías disponibles.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByLabelText('Categoría del servicio')).toBeInTheDocument();
  expect(intentos).toBe(2);
});

test('al cerrarse la sesión en una pantalla profesional se vuelve al acceso sin conservar datos privados', async () => {
  await montar('/prestador/servicios', { sesionActiva: true, respuestas: (ruta, metodo) => {
    if (ruta === '/perfil' && metodo === 'GET') return json(200, perfilCuenta(['cliente', 'prestador']));
    if (ruta.startsWith('/servicios/mios')) return json(200, { elementos: [], total: 0, pagina: 1, tamano: 20 });
    if (ruta === '/sesiones/actual' && metodo === 'DELETE') return new Response(null, { status: 204 });
    return undefined;
  } });
  await screen.findByLabelText('Categoría del servicio');
  fireEvent.click(await screen.findByRole('button', { name: /Cerrar sesión/ }));
  expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  expect(location.pathname).toBe('/acceso');
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});
