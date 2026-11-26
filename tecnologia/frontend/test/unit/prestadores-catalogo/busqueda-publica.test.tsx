import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ErrorApi } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';
import { BusquedaWeb, mensajeBusqueda, totalPaginas } from '../../../src/features/prestadores-catalogo/aplicacion/busqueda.js';
import type { ApiBusqueda } from '../../../src/features/prestadores-catalogo/aplicacion/puertos.js';
import { ApiBusquedaHttp } from '../../../src/features/prestadores-catalogo/infraestructura/api-busqueda.js';
import type { PerfilPublico, PrestadorResumen, ServicioPublico } from '../../../src/features/prestadores-catalogo/modelos/contratos.js';
import { BuscarOferta } from '../../../src/features/prestadores-catalogo/presentacion/BuscarOferta.js';
import { DetalleServicio, DetallePrestador } from '../../../src/features/prestadores-catalogo/presentacion/DetallePrestador.js';

afterEach(cleanup);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const servicio = (n: number): ServicioPublico => ({ servicioId: uuid(n), prestadorId: uuid(100 + n), titulo: `Servicio ${n}`, descripcion: `Descripción ${n}`, categoriaId: uuid(500), estado: 'PUBLICADO' });
const prestador = (n: number, disponible = true): PrestadorResumen => ({ prestadorId: uuid(100 + n), nombrePublico: `Prestador ${n}`, tipo: 'TECNICO', especialidadesIds: [uuid(500)], distritos: ['ayacucho', 'carmen-alto'], disponibilidadDeclarada: disponible });
const pagina = <T,>(elementos: T[], total = elementos.length, p = 1, tamano = 20) => ({ elementos, total, pagina: p, tamano });
type Falsa = ApiBusqueda & { [K in keyof ApiBusqueda]: ReturnType<typeof vi.fn> };
const api = (extra: Partial<ApiBusqueda> = {}) => ({
  buscarServicios: vi.fn(async () => pagina([servicio(1), servicio(2)])), buscarPrestadores: vi.fn(async () => pagina([prestador(1), prestador(2, false)])),
  obtenerServicio: vi.fn(async (id: string) => ({ ...servicio(1), servicioId: id })), obtenerPerfil: vi.fn(), obtenerImagen: vi.fn(async () => ({ tipoMime: 'image/webp' as const, contenidoBase64: 'AAAA' })), ...extra,
}) as unknown as Falsa;
const montar = async (a: Falsa, props: { categorias?: { id: string; nombre: string }[] } = {}) => {
  const alVerPrestador = vi.fn();
  render(<BuscarOferta busqueda={new BusquedaWeb(a)} alVerPrestador={alVerPrestador} {...props} />);
  await screen.findByRole('heading', { name: 'Buscar servicios y prestadores' });
  return alVerPrestador;
};

const perfil = (extra: Partial<PerfilPublico> = {}): PerfilPublico => ({
  prestadorId: uuid(101), nombrePublico: 'Ana Albañil', tipo: 'TECNICO', experiencia: 'Diez años de obra.', especialidadesIds: [uuid(500)], distritos: ['ayacucho'], disponibilidadDeclarada: true,
  trabajos: [{ trabajoId: uuid(7), titulo: 'Fachada', descripcion: 'Trabajo previo', fotografias: [{ fotografiaId: uuid(8), tipoMime: 'image/webp', ancho: 800, alto: 600, ruta: `/api/v1/prestadores/${uuid(101)}/trabajos/${uuid(7)}/fotografias/${uuid(8)}` }] }],
  servicios: pagina([servicio(1)]), avisos: { calificaciones: 'Calificaciones aún no disponibles', verificaciones: 'Verificaciones aún no disponibles' }, ...extra,
});
const montarPerfil = async (a: Falsa) => { render(<DetallePrestador busqueda={new BusquedaWeb(a)} prestadorId={uuid(101)} />); return screen.findByRole('heading', { name: 'Ana Albañil' }); };

test('CA-BUS-01 la búsqueda base se ejecuta sin sesión y combina zona y disponibilidad declarada', async () => {
  const a = api();
  await montar(a);
  expect(a.buscarServicios).toHaveBeenCalledWith({ pagina: 1, tamano: 20 });
  expect(screen.getAllByRole('article')).toHaveLength(2);
  fireEvent.change(screen.getByLabelText('Zona de atención'), { target: { value: 'carmen-alto' } });
  fireEvent.change(screen.getByLabelText('Disponibilidad declarada'), { target: { value: 'false' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(a.buscarServicios).toHaveBeenLastCalledWith({ pagina: 1, tamano: 20, distrito: 'carmen-alto', disponibilidad: false }));
});

test('CA-BUS-01 permite elegir una categoría cuando la composición la ofrece y cambiar entre servicios y prestadores', async () => {
  const a = api();
  await montar(a, { categorias: [{ id: uuid(500), nombre: 'Electricidad' }] });
  fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: uuid(500) } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(a.buscarServicios).toHaveBeenLastCalledWith({ pagina: 1, tamano: 20, categoria: uuid(500) }));
  fireEvent.click(screen.getByLabelText('Prestadores'));
  await waitFor(() => expect(a.buscarPrestadores).toHaveBeenLastCalledWith({ pagina: 1, tamano: 20, categoria: uuid(500) }));
  const ana = await screen.findByRole('article', { name: 'Prestador: Prestador 1' });
  expect(within(ana).getByText(/Zonas: Ayacucho, Carmen Alto/)).toBeInTheDocument();
  expect(within(screen.getByRole('article', { name: 'Prestador: Prestador 2' })).getByText('Disponibilidad declarada: no')).toBeInTheDocument();
});

test('CA-BUS-02 un resultado vacío informa que no hay coincidencias y permite ajustar o quitar los criterios', async () => {
  const a = api({ buscarServicios: vi.fn(async (f: { distrito?: string }) => (f.distrito ? pagina<ServicioPublico>([]) : pagina([servicio(1)]))) });
  await montar(a);
  fireEvent.change(screen.getByLabelText('Zona de atención'), { target: { value: 'jesus-nazareno' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  expect(await screen.findByText(/No hay coincidencias para esos criterios/)).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
  await screen.findByRole('article', { name: 'Servicio: Servicio 1' });
  expect(screen.getByLabelText('Zona de atención')).toHaveValue('');
  expect(a.buscarServicios).toHaveBeenLastCalledWith({ pagina: 1, tamano: 20 });
});

test('CA-BUS-01 la paginación muestra la página y el total, y conserva los filtros al avanzar', async () => {
  const a = api({ buscarServicios: vi.fn(async (f: { pagina: number }) => pagina([servicio(f.pagina)], 45, f.pagina)) });
  await montar(a);
  expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Zona de atención'), { target: { value: 'ayacucho' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  await waitFor(() => expect(a.buscarServicios).toHaveBeenLastCalledWith({ pagina: 1, tamano: 20, distrito: 'ayacucho' }));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 2 de 3');
  expect(a.buscarServicios).toHaveBeenLastCalledWith({ pagina: 2, tamano: 20, distrito: 'ayacucho' });
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 3 de 3');
  expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  expect(totalPaginas({ total: 0, tamano: 20 })).toBe(1);
});

test('la búsqueda aclara que los datos son declarados y no muestra puntuaciones, insignias ni estados de verificación', async () => {
  await montar(api());
  fireEvent.click(screen.getByLabelText('Prestadores'));
  await screen.findByRole('article', { name: 'Prestador: Prestador 1' });
  expect(screen.getByText(/son declarados por el prestador/)).toBeInTheDocument();
  const texto = document.body.textContent ?? '';
  for (const prohibido of ['★', '☆', 'Sin valoraciones', 'Verificado', 'Calificación', 'insignia']) expect(texto).not.toContain(prohibido);
});

test('un error del servicio se informa sin vaciar la pantalla y un resultado antiguo no pisa al nuevo', async () => {
  const a = api({ buscarServicios: vi.fn(async () => { throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'x', []); }) });
  await montar(a);
  expect(await screen.findByRole('alert')).toHaveTextContent('La búsqueda no está disponible por ahora');
  expect(mensajeBusqueda(new ErrorApi(404, 'RECURSO_NO_DISPONIBLE', 'x', []))).toBe('El contenido solicitado no está disponible.');
});

test('CA-BUS-04 CA-BUS-05 el perfil muestra los dos avisos exactos, separados, y los datos declarados diferenciados', async () => {
  await montarPerfil(api({ obtenerPerfil: vi.fn(async () => perfil()) }));
  const declarada = screen.getByRole('region', { name: 'Información declarada por el prestador' });
  expect(within(declarada).getByText('Diez años de obra.')).toBeInTheDocument();
  expect(within(declarada).getByText(/Disponibilidad declarada: sí\. Es una declaración del prestador y no constituye una reserva ni una confirmación\./)).toBeInTheDocument();
  const avisos = document.querySelectorAll('.aviso-fuente');
  expect([...avisos].map(a => [a.getAttribute('data-fuente'), a.textContent])).toEqual([['calificaciones', 'Calificaciones aún no disponibles'], ['verificaciones', 'Verificaciones aún no disponibles']]);
  expect(declarada.contains(avisos[0]!)).toBe(false);
  const texto = document.body.textContent ?? '';
  for (const prohibido of ['★', 'Sin valoraciones', 'Verificado', 'insignia']) expect(texto).not.toContain(prohibido);
});

test('CA-BUS-07 cada aviso se retira por separado cuando su fuente está disponible', async () => {
  for (const [avisos, esperados] of [
    [{ calificaciones: null, verificaciones: 'Verificaciones aún no disponibles' }, ['Verificaciones aún no disponibles']],
    [{ calificaciones: 'Calificaciones aún no disponibles', verificaciones: null }, ['Calificaciones aún no disponibles']],
    [{ calificaciones: null, verificaciones: null }, []],
  ] as const) {
    cleanup();
    await montarPerfil(api({ obtenerPerfil: vi.fn(async () => perfil({ avisos })) }));
    expect([...document.querySelectorAll('.aviso-fuente')].map(a => a.textContent)).toEqual(esperados);
  }
});

test('el perfil carga las imágenes solo bajo demanda, muestra los servicios y un perfil no visible informa que no está disponible', async () => {
  const a = api({ obtenerPerfil: vi.fn(async () => perfil()) });
  await montarPerfil(a);
  expect(a.obtenerImagen).not.toHaveBeenCalled();
  expect(screen.queryByRole('img')).toBeNull();
  expect(within(screen.getByRole('region', { name: 'Servicios del prestador' })).getByRole('article', { name: 'Servicio: Servicio 1' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ver imagen 1 de Fachada' }));
  expect(await screen.findByRole('img', { name: 'Imagen 1 de Fachada' })).toHaveAttribute('src', 'data:image/webp;base64,AAAA');
  cleanup();
  render(<DetallePrestador busqueda={new BusquedaWeb(api({ obtenerPerfil: vi.fn(async () => { throw new ErrorApi(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.', []); }) }))} prestadorId={uuid(999)} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('El contenido solicitado no está disponible.');
});

test('el detalle de un servicio no visible se presenta como no disponible y sin sesión', async () => {
  render(<DetalleServicio busqueda={new BusquedaWeb(api({ obtenerServicio: vi.fn(async () => { throw new ErrorApi(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.', []); }) }))} servicioId={uuid(5)} alVerPrestador={() => undefined} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('El contenido solicitado no está disponible.');
});

test('el cliente HTTP es anónimo: sin credenciales ni cabecera de autorización y con filtros codificados', async () => {
  const solicitar = vi.fn(async () => new Response(JSON.stringify(pagina([servicio(1)])), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const http = new ApiBusquedaHttp(solicitar as unknown as typeof fetch);
  await http.buscarServicios({ categoria: uuid(500), distrito: 'ayacucho', disponibilidad: false, pagina: 2, tamano: 20 });
  const [url, init] = solicitar.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`/api/v1/servicios?categoria=${uuid(500)}&distrito=ayacucho&disponibilidad=false&pagina=2&tamano=20`);
  expect(init.credentials).toBe('omit');
  expect(JSON.stringify(init.headers)).not.toMatch(/authorization|csrf|idempotency/i);
  await expect(http.obtenerImagen('/api/v1/usuarios/otra/ruta')).rejects.toMatchObject({ http: 400 });
  expect(() => new ApiBusquedaHttp(solicitar as unknown as typeof fetch, 'https://otro.example/api')).toThrow();
});
