import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ErrorApi } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';
import type { ApiServicios } from '../../../src/features/prestadores-catalogo/aplicacion/puertos.js';
import { ServiciosWeb, accionesDe, validarServicioWeb } from '../../../src/features/prestadores-catalogo/aplicacion/servicios.js';
import type { EstadoServicio, ServicioPrivado } from '../../../src/features/prestadores-catalogo/modelos/contratos.js';
import { ServiciosPropios } from '../../../src/features/prestadores-catalogo/presentacion/ServiciosPropios.js';

afterEach(cleanup);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const categorias = [{ id: uuid(500), nombre: 'Electricidad' }, { id: uuid(501), nombre: 'Albañilería' }];
const servicio = (n: number, estado: EstadoServicio = 'PUBLICADO', version = 3): ServicioPrivado => ({ servicioId: uuid(n), prestadorId: uuid(1), titulo: `Servicio ${n}`, descripcion: `Descripción ${n}`, categoriaId: uuid(500), estado, version });
type Falsa = ApiServicios & { [K in keyof ApiServicios]: ReturnType<typeof vi.fn> };
const api = (elementos: ServicioPrivado[], extra: Partial<ApiServicios> = {}) => ({
  listarMios: vi.fn(async (pagina: number, tamano: number) => ({ elementos, total: elementos.length, pagina, tamano })),
  publicar: vi.fn(async (e: { titulo: string; descripcion: string; categoriaId: string }) => ({ ...servicio(90, 'PUBLICADO', 1), ...e })),
  editar: vi.fn(async (id: string, v: number, c: object) => ({ ...elementos.find(s => s.servicioId === id)!, ...c, version: v + 1 })),
  cambiarEstado: vi.fn(async (id: string, v: number, destino: EstadoServicio) => ({ ...elementos.find(s => s.servicioId === id)!, estado: destino, version: v + 1 })), ...extra,
}) as unknown as Falsa;
const montar = async (a: Falsa, opciones: { categorias?: typeof categorias } = {}) => {
  const web = new ServiciosWeb(a, () => 'clave-de-prueba-fija');
  render(<ServiciosPropios servicio={web} categorias={opciones.categorias ?? categorias} />);
  await screen.findByRole('heading', { name: 'Mis servicios' });
  return web;
};
const tarjeta = (titulo: string) => screen.getByRole('article', { name: `Servicio: ${titulo}` });

test('CA-SER-01 el titular ve el inventario con estado y versión vigentes, y los retirados en modo lectura (CA-SER-07)', async () => {
  await montar(api([servicio(10, 'PUBLICADO'), servicio(11, 'PAUSADO', 5), servicio(12, 'RETIRADO', 7)]));
  expect(within(tarjeta('Servicio 10')).getByText('Estado: Publicado · versión 3')).toBeInTheDocument();
  expect(within(tarjeta('Servicio 11')).getByText('Estado: Pausado · versión 5')).toBeInTheDocument();
  const retirado = tarjeta('Servicio 12');
  expect(within(retirado).getByText('Estado: Retirado · versión 7')).toBeInTheDocument();
  expect(within(retirado).getByText(/solo lectura/)).toBeInTheDocument();
  expect(within(retirado).queryAllByRole('button')).toHaveLength(0);
  expect(within(tarjeta('Servicio 10')).getByRole('button', { name: 'Pausar Servicio 10' })).toBeInTheDocument();
  expect(within(tarjeta('Servicio 11')).getByRole('button', { name: 'Reactivar Servicio 11' })).toBeInTheDocument();
  expect(accionesDe('RETIRADO')).toEqual({ editar: false, destinos: [] });
});

test('CA-SER-01 publicar valida los datos, envía la categoría elegida y muestra el servicio PUBLICADO', async () => {
  const a = api([]);
  await montar(a);
  expect(screen.getByText('Aún no ha publicado servicios.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
  expect(await screen.findByText('Indique el título del servicio.')).toBeInTheDocument();
  expect(screen.getByText('Describa el servicio.')).toBeInTheDocument();
  expect(a.publicar).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Título del servicio'), { target: { value: ' Instalación eléctrica ' } });
  fireEvent.change(screen.getByLabelText('Descripción del servicio'), { target: { value: 'Cableado residencial' } });
  fireEvent.change(screen.getByLabelText('Categoría del servicio'), { target: { value: uuid(501) } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
  await screen.findByRole('article', { name: 'Servicio: Instalación eléctrica' });
  expect(a.publicar).toHaveBeenCalledWith({ titulo: 'Instalación eléctrica', descripcion: 'Cableado residencial', categoriaId: uuid(501) }, 'clave-de-prueba-fija');
  expect(screen.getByText('Estado: Publicado · versión 1')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Servicio publicado.');
});

test('CA-SER-04 una clasificación que no admite publicaciones se informa y no se muestra un servicio nuevo', async () => {
  const a = api([servicio(10)], { publicar: vi.fn(async () => { throw new ErrorApi(422, 'CATEGORIA_NO_ACTIVA', 'La clasificación no admite nuevas publicaciones.', [{ campo: 'categoriaId', motivo: 'La clasificación no está activa.' }]); }) });
  await montar(a);
  fireEvent.change(screen.getByLabelText('Título del servicio'), { target: { value: 'Nuevo' } });
  fireEvent.change(screen.getByLabelText('Descripción del servicio'), { target: { value: 'Detalle' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publicar servicio' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('La clasificación no admite nuevas publicaciones.');
  expect(screen.queryByRole('article', { name: 'Servicio: Nuevo' })).toBeNull();
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByLabelText('Título del servicio')).toHaveValue('Nuevo');
});

test('CA-SER-02 pausar y reactivar actualizan el estado y la versión que devuelve el servidor', async () => {
  const a = api([servicio(10, 'PUBLICADO', 3)]);
  await montar(a);
  fireEvent.click(screen.getByRole('button', { name: 'Pausar Servicio 10' }));
  await waitFor(() => expect(screen.getByText('Estado: Pausado · versión 4')).toBeInTheDocument());
  expect(a.cambiarEstado).toHaveBeenCalledWith(uuid(10), 3, 'PAUSADO', 'clave-de-prueba-fija');
  a.cambiarEstado.mockImplementationOnce(async (_id: string, v: number, destino: EstadoServicio) => ({ ...servicio(10), estado: destino, version: v + 1 }));
  fireEvent.click(screen.getByRole('button', { name: 'Reactivar Servicio 10' }));
  await waitFor(() => expect(screen.getByText('Estado: Publicado · versión 5')).toBeInTheDocument());
});

test('CA-SER-02 el retiro exige confirmación y deja el servicio en modo lectura', async () => {
  const a = api([servicio(10, 'PAUSADO', 2)]);
  await montar(a);
  fireEvent.click(screen.getByRole('button', { name: 'Retirar Servicio 10' }));
  expect(a.cambiarEstado).not.toHaveBeenCalled();
  expect(screen.getByText(/El retiro es definitivo/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar retiro' }));
  expect(screen.queryByText(/El retiro es definitivo/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retirar Servicio 10' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar retiro de Servicio 10' }));
  await waitFor(() => expect(screen.getByText('Estado: Retirado · versión 3')).toBeInTheDocument());
  expect(within(tarjeta('Servicio 10')).queryAllByRole('button')).toHaveLength(0);
});

test('CA-SER-06 una reactivación rechazada conserva el estado PAUSADO, la versión y el mensaje de causa', async () => {
  const a = api([servicio(10, 'PAUSADO', 4)], { cambiarEstado: vi.fn(async () => { throw new ErrorApi(422, 'CATEGORIA_NO_ACTIVA', 'La clasificación no admite nuevas publicaciones.', []); }) });
  await montar(a);
  fireEvent.click(screen.getByRole('button', { name: 'Reactivar Servicio 10' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('La clasificación no admite nuevas publicaciones.');
  expect(screen.getByText('Estado: Pausado · versión 4')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reactivar Servicio 10' })).toBeEnabled();
});

test('CA-SER-05 editar un servicio pausado conserva su estado y valida lo escrito', async () => {
  const a = api([servicio(10, 'PAUSADO', 4)]);
  await montar(a);
  fireEvent.click(screen.getByRole('button', { name: 'Editar Servicio 10' }));
  const formulario = screen.getByRole('form', { name: 'Edición de Servicio 10' });
  fireEvent.change(within(formulario).getByLabelText('Título'), { target: { value: '   ' } });
  fireEvent.click(within(formulario).getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByText('Indique el título del servicio.')).toBeInTheDocument();
  expect(a.editar).not.toHaveBeenCalled();
  fireEvent.change(within(formulario).getByLabelText('Título'), { target: { value: 'Título editado' } });
  fireEvent.click(within(formulario).getByRole('button', { name: 'Guardar cambios' }));
  await screen.findByRole('article', { name: 'Servicio: Título editado' });
  expect(a.editar).toHaveBeenCalledWith(uuid(10), 4, { titulo: 'Título editado' }, 'clave-de-prueba-fija');
  expect(screen.getByText('Estado: Pausado · versión 5')).toBeInTheDocument();
});

test('un conflicto de versión indica recargar, conserva lo mostrado y permite recargar el inventario', async () => {
  const a = api([servicio(10, 'PUBLICADO', 3)], { cambiarEstado: vi.fn(async () => { throw new ErrorApi(409, 'VERSION_DESACTUALIZADA', 'La versión enviada ya no es la vigente.', []); }) });
  await montar(a);
  fireEvent.click(screen.getByRole('button', { name: 'Pausar Servicio 10' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Recargue su perfil antes de continuar.');
  expect(screen.getByText('Estado: Publicado · versión 3')).toBeInTheDocument();
  a.listarMios.mockResolvedValueOnce({ elementos: [servicio(10, 'PAUSADO', 4)], total: 1, pagina: 1, tamano: 50 });
  fireEvent.click(screen.getByRole('button', { name: 'Recargar servicios' }));
  await waitFor(() => expect(screen.getByText('Estado: Pausado · versión 4')).toBeInTheDocument());
});

test('sin categorías disponibles no se puede publicar y se explica el motivo', async () => {
  await montar(api([]), { categorias: [] });
  expect(screen.getByRole('button', { name: 'Publicar servicio' })).toBeDisabled();
  expect(screen.getByText('Aún no hay categorías disponibles para publicar.')).toBeInTheDocument();
});

test('un fallo de red conserva la clave de idempotencia y el reintento exacto la reutiliza', async () => {
  const claves: string[] = []; let n = 0;
  const a = api([servicio(10)], { cambiarEstado: vi.fn(async (id: string, v: number, destino: EstadoServicio, clave: string) => {
    claves.push(clave);
    if (claves.length === 1) throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'No fue posible comunicarse con el servidor.', []);
    return { ...servicio(10), estado: destino, version: v + 1, servicioId: id };
  }) });
  const web = new ServiciosWeb(a, () => `clave-${++n}`);
  await expect(web.cambiarEstado(uuid(10), 3, 'PAUSADO')).rejects.toBeInstanceOf(ErrorApi);
  await web.cambiarEstado(uuid(10), 3, 'PAUSADO');
  await web.cambiarEstado(uuid(10), 3, 'PAUSADO');
  expect(claves).toEqual(['clave-1', 'clave-1', 'clave-2']);
  expect(validarServicioWeb({ titulo: 'x', descripcion: 'y', categoriaId: '' })).toEqual({ categoriaId: 'Elija la categoría del servicio.' });
});

test('el inventario se pide por páginas y "Cargar más" agrega la siguiente', async () => {
  const primera = [servicio(10), servicio(11)];
  const a = api(primera, { listarMios: vi.fn(async (pagina: number, tamano: number) => (pagina === 1 ? { elementos: primera, total: 3, pagina, tamano } : { elementos: [servicio(12)], total: 3, pagina, tamano })) });
  await montar(a);
  expect(screen.getAllByRole('article')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Cargar más servicios' }));
  await screen.findByRole('article', { name: 'Servicio: Servicio 12' });
  expect(screen.queryByRole('button', { name: 'Cargar más servicios' })).toBeNull();
  expect(a.listarMios).toHaveBeenLastCalledWith(2, 50);
});
