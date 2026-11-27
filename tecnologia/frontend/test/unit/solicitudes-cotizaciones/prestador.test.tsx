import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CategoriasWeb } from '../../../src/features/prestadores-catalogo/aplicacion/categorias.js';
import { ErrorApi } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';
import { crearApiSolicitudes } from '../../../src/features/solicitudes-cotizaciones/infraestructura/api-solicitudes.js';
import type { ApiSolicitudes, Oportunidad, ResumenComoPrestador, SolicitudVisible } from '../../../src/features/solicitudes-cotizaciones/modelos/contratos.js';
import { DetalleSolicitudPrestador } from '../../../src/features/solicitudes-cotizaciones/presentacion/DetalleSolicitudPrestador.js';
import { Oportunidades, SolicitudesRecibidas } from '../../../src/features/solicitudes-cotizaciones/presentacion/ListasPrestador.js';

const id = '12345678-1234-4321-8123-123456789123';
const categoriaId = 'aaaaaaaa-1234-4321-8123-123456789123';
const archivoId = 'ad4b3004-ba7e-45f2-be02-f36285e3b8c1';
const categorias = new CategoriasWeb({ listar: async () => [{ categoriaId, nombre: 'Construcción y obra', categoriaPadreId: null }] } as never);
const vacia = { elementos: [], total: 0, pagina: 1, tamano: 20 };
const oportunidad: Oportunidad = {
  solicitudId: id, tipo: 'PUBLICADA', categoriaId, distrito: 'ayacucho', fechaDesde: '2031-03-10', descripcionCorta: 'Levantar un muro de ladrillo',
  hayFotografias: true, fotografiasCompartidas: false, versionTrabajo: 1, publicadaEn: '2026-11-26T18:00:00Z',
};
const visible: SolicitudVisible = {
  solicitudId: id, tipo: 'PUBLICADA', estado: 'ABIERTA', descripcion: 'Levantar un muro de ladrillo de 3 x 2 m', categoriaId, distrito: 'ayacucho',
  fechaDesde: '2031-03-10', fotografias: { hay: false, compartidas: false, archivos: [] }, versionTrabajo: 1, titulos: ['COMPATIBLE'],
};
const crearApi = () => ({
  oportunidades: vi.fn<ApiSolicitudes['oportunidades']>(async () => vacia),
  listarComoPrestador: vi.fn<ApiSolicitudes['listarComoPrestador']>(async () => vacia),
  obtenerVisible: vi.fn<ApiSolicitudes['obtenerVisible']>(async () => visible),
  foto: vi.fn<ApiSolicitudes['foto']>(async () => new Blob(['x'], { type: 'image/webp' })),
  versiones: vi.fn<ApiSolicitudes['versiones']>(async () => vacia),
}) as unknown as ApiSolicitudes & { oportunidades: ReturnType<typeof vi.fn>; listarComoPrestador: ReturnType<typeof vi.fn>; obtenerVisible: ReturnType<typeof vi.fn>; foto: ReturnType<typeof vi.fn>; versiones: ReturnType<typeof vi.fn> };
const navegar = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

test('las oportunidades indican compatibilidad, fotografías no compartidas y enlazan al detalle sin datos del cliente', async () => {
  const api = crearApi();
  api.oportunidades.mockResolvedValue({ ...vacia, total: 2, elementos: [oportunidad, { ...oportunidad, solicitudId: 'bbbbbbbb-1234-4321-8123-123456789123', tipo: 'DIRIGIDA', fotografiasCompartidas: true, descripcionCorta: 'Revestir la fachada' }] });
  render(<Oportunidades api={api} categorias={categorias} alNavegar={navegar} />);
  const lista = await screen.findByRole('list', { name: 'Oportunidades' });
  expect(within(lista).getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByText('Fotografías no compartidas por el cliente')).toBeVisible();
  expect(screen.getByText('Fotografías compartidas')).toBeVisible();
  expect(screen.getByText('Dirigida a ti')).toBeVisible();
  expect(await screen.findAllByText('Construcción y obra')).not.toHaveLength(0);
  expect(screen.getByRole('link', { name: /Ver detalle: Levantar un muro/ })).toHaveAttribute('href', `/prestador/solicitudes/${id}`);
  expect(document.body.textContent).not.toMatch(/correo|teléfono|clienteCuentaId/i);
});

test('sin oportunidades explica cómo aparecen y ofrece acciones reales', async () => {
  render(<Oportunidades api={crearApi()} categorias={categorias} alNavegar={navegar} />);
  expect(await screen.findByRole('heading', { name: 'Aún no hay oportunidades para ti' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Mis servicios' })).toHaveAttribute('href', '/prestador/servicios');
  expect(screen.getByRole('link', { name: 'Mi perfil profesional' })).toHaveAttribute('href', '/prestador/perfil');
});

test('un fallo de carga se anuncia y el reintento vuelve a consultar', async () => {
  const api = crearApi();
  api.oportunidades.mockRejectedValueOnce(new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio no disponible.'));
  render(<Oportunidades api={api} categorias={categorias} alNavegar={navegar} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible.');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('heading', { name: 'Aún no hay oportunidades para ti' })).toBeVisible();
  expect(api.oportunidades).toHaveBeenCalledTimes(2);
});

test('la paginación pide la página siguiente', async () => {
  const api = crearApi();
  api.oportunidades.mockResolvedValue({ elementos: [oportunidad], total: 45, pagina: 1, tamano: 20 });
  render(<Oportunidades api={api} categorias={categorias} alNavegar={navegar} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));
  await waitFor(() => expect(api.oportunidades).toHaveBeenLastCalledWith(2));
});

test('las solicitudes recibidas permiten localizar una dirigida cerrada, sin ofrecer borradores', async () => {
  const api = crearApi();
  const cerrada: ResumenComoPrestador = { solicitudId: id, tipo: 'DIRIGIDA', estado: 'CERRADA', descripcionCorta: 'Revestir la fachada', distrito: 'ayacucho', actualizadaEn: '2026-11-26T18:00:00Z', versionTrabajo: 1, titulos: ['DESTINATARIO'] };
  api.listarComoPrestador.mockImplementation(async (_p: number, estado?: string) => estado === 'CERRADA' ? { ...vacia, total: 1, elementos: [cerrada] } : vacia);
  render(<SolicitudesRecibidas api={api} categorias={categorias} alNavegar={navegar} />);
  expect(await screen.findByRole('heading', { name: 'Aún no has recibido solicitudes' })).toBeVisible();
  expect(screen.queryByRole('option', { name: 'Borrador' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'CERRADA' } });
  expect(await screen.findByRole('heading', { name: 'Revestir la fachada' })).toBeVisible();
  expect(screen.getByText('Dirigida a ti')).toBeVisible();
  expect(api.listarComoPrestador).toHaveBeenLastCalledWith(1, 'CERRADA');
});

test('el detalle de un compatible sin fotografías compartidas no las pide ni ofrece el historial', async () => {
  const api = crearApi();
  api.obtenerVisible.mockResolvedValue({ ...visible, fotografias: { hay: true, compartidas: false, archivos: [] } });
  render(<DetalleSolicitudPrestador api={api} categorias={categorias} id={id} alNavegar={navegar} />);
  expect(await screen.findByText('Levantar un muro de ladrillo de 3 x 2 m')).toBeVisible();
  expect(screen.getByText('El cliente no compartió las fotografías de esta solicitud.')).toBeVisible();
  expect(screen.getByText('Compatible con tus servicios')).toBeVisible();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ver versiones' })).not.toBeInTheDocument();
  expect(api.foto).not.toHaveBeenCalled();
  expect(api.versiones).not.toHaveBeenCalled();
});

test('el destinatario de una dirigida cerrada lee el detalle, ve la fotografía y consulta las versiones', async () => {
  const api = crearApi();
  api.obtenerVisible.mockResolvedValue({
    ...visible, tipo: 'DIRIGIDA', estado: 'CERRADA', titulos: ['DESTINATARIO'],
    fotografias: { hay: true, compartidas: true, archivos: [{ archivoId, estado: 'CONFIRMADO', bytes: 10, ancho: 5, alto: 5 }] },
  });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:foto'), revokeObjectURL: vi.fn() }));
  render(<DetalleSolicitudPrestador api={api} categorias={categorias} id={id} alNavegar={navegar} />);
  expect(await screen.findByText('Solicitud cerrada.')).toBeVisible();
  expect(await screen.findByRole('img', { name: 'Fotografía 1 de la solicitud' })).toBeVisible();
  expect(api.foto).toHaveBeenCalledWith(id, archivoId, expect.any(AbortSignal));
  fireEvent.click(screen.getByRole('button', { name: 'Ver versiones' }));
  await waitFor(() => expect(api.versiones).toHaveBeenCalledWith(id, 1));
});

test('una solicitud sin acceso se presenta como no disponible sin revelar su existencia', async () => {
  const api = crearApi();
  api.obtenerVisible.mockRejectedValue(new ErrorApi(404, 'RECURSO_NO_DISPONIBLE', 'No disponible.'));
  render(<DetalleSolicitudPrestador api={api} categorias={categorias} id={id} alNavegar={navegar} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta solicitud no está disponible.');
  expect(screen.queryByText('Levantar un muro de ladrillo de 3 x 2 m')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Volver a oportunidades' })).toHaveAttribute('href', '/prestador/oportunidades');
});

test('el cliente que abre su propia solicitud como prestador es dirigido a su editor', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ solicitudId: id, estado: 'ABIERTA', archivos: [], advertencias: [] })));
  const api = crearApiSolicitudes(() => 'token-de-prueba', vi.fn());
  render(<DetalleSolicitudPrestador api={api} categorias={categorias} id={id} alNavegar={navegar} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Esta solicitud es tuya.');
  expect(screen.getByRole('link', { name: 'Ir a mi solicitud' })).toHaveAttribute('href', `/solicitudes/${id}`);
});

test('el cliente HTTP usa la ruta literal de oportunidades y la perspectiva prestador, sin cookies ni caché', async () => {
  const fetchSimulado = vi.fn(async () => Response.json(vacia));
  vi.stubGlobal('fetch', fetchSimulado);
  const api = crearApiSolicitudes(() => 'token-de-prueba', vi.fn());
  await api.oportunidades(2);
  await api.listarComoPrestador(1, 'CERRADA');
  const [primera, segunda] = fetchSimulado.mock.calls as unknown as [string, RequestInit][][];
  expect(primera).toEqual(['/api/v1/solicitudes/oportunidades?pagina=2', expect.objectContaining({ method: 'GET', cache: 'no-store' })]);
  expect(segunda?.[0]).toBe('/api/v1/solicitudes?rol=prestador&pagina=1&estado=CERRADA');
});

test('las fechas de calendario no se desplazan un día por la zona horaria', async () => {
  const { fechaCalendario, periodo } = await import('../../../src/features/solicitudes-cotizaciones/aplicacion/oportunidades.js');
  expect(fechaCalendario('2031-03-10')).toMatch(/^10 mar/);
  expect(periodo('2031-03-10', '2031-03-20')).toMatch(/^Del 10 mar.* al 20 mar/);
  expect(periodo('2031-03-10', undefined)).toMatch(/^Desde el 10 mar/);
  expect(periodo('2031-03-10', '2031-03-10')).toMatch(/^Desde el 10 mar/);
});
