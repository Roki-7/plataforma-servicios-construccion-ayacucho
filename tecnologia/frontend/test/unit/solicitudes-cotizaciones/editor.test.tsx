import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { BusquedaWeb } from '../../../src/features/prestadores-catalogo/aplicacion/busqueda.js';
import { CategoriasWeb } from '../../../src/features/prestadores-catalogo/aplicacion/categorias.js';
import { ErrorApi } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';
import { crearApiSolicitudes } from '../../../src/features/solicitudes-cotizaciones/infraestructura/api-solicitudes.js';
import type { ApiSolicitudes, SolicitudPrivada } from '../../../src/features/solicitudes-cotizaciones/modelos/contratos.js';
import { EditorSolicitud } from '../../../src/features/solicitudes-cotizaciones/presentacion/EditorSolicitud.js';

const id = '12345678-1234-4321-8123-123456789123';
const borrador: SolicitudPrivada = {
  solicitudId: id, tipo: 'PUBLICADA', estado: 'BORRADOR', actualizadaEn: '2026-11-26T18:00:00Z',
  version: 1, versionTrabajo: 0, archivos: [], advertencias: [],
};
const categorias = new CategoriasWeb({ listar: async () => [] });
const pagina = { elementos: [], pagina: 1, tamano: 20, total: 0 };
const busqueda = new BusquedaWeb({
  buscarServicios: async () => pagina,
  buscarPrestadores: async () => pagina,
  obtenerPerfil: vi.fn(), obtenerServicio: vi.fn(), obtenerImagen: vi.fn(),
});
const crearApi = (s = borrador) => ({
  listar: vi.fn(async () => pagina), oportunidades: vi.fn(async () => pagina), listarComoPrestador: vi.fn(async () => pagina), obtenerVisible: vi.fn(), obtener: vi.fn(async () => s),
  crear: vi.fn<ApiSolicitudes['crear']>(async () => s),
  editar: vi.fn<ApiSolicitudes['editar']>(async () => ({ ...s, version: 2 })),
  publicar: vi.fn<ApiSolicitudes['publicar']>(async () => ({ ...s, estado: 'ABIERTA', version: 2, versionTrabajo: 1 })),
  cerrar: vi.fn<ApiSolicitudes['cerrar']>(async () => ({ ...s, estado: 'CERRADA' })),
  cargar: vi.fn<ApiSolicitudes['cargar']>(), foto: vi.fn<ApiSolicitudes['foto']>(), versiones: vi.fn(async () => pagina),
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('guarda un borrador sin datos de trabajo y conserva la clave si se repite tras un fallo de red', async () => {
  const api = crearApi();
  api.crear.mockRejectedValueOnce(new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Reintente el guardado.'));
  const alCrear = vi.fn();
  render(<EditorSolicitud api={api} busqueda={busqueda} categorias={categorias} alCrear={alCrear} />);
  const boton = screen.getByRole('button', { name: 'Guardar borrador' });
  fireEvent.click(boton);
  expect(await screen.findByRole('alert')).toHaveTextContent('Reintente el guardado.');
  fireEvent.click(boton);
  await waitFor(() => expect(alCrear).toHaveBeenCalledWith(id));
  expect(api.crear.mock.calls[0]?.[0]).toMatchObject({ tipo: 'PUBLICADA' });
  expect(api.crear.mock.calls[1]?.[1]).toBe(api.crear.mock.calls[0]?.[1]);
});

test('los errores de publicación se asocian al campo y el texto introducido se mantiene', async () => {
  const s = { ...borrador, descripcion: 'Contacto 981 234 567' };
  const api = crearApi(s);
  api.publicar.mockRejectedValueOnce(new ErrorApi(422, 'DATOS_PERSONALES_EN_TEXTO', 'Revisa el texto.', [{ campo: 'descripcion', motivo: 'Retira el teléfono.' }]));
  render(<EditorSolicitud id={id} api={api} busqueda={busqueda} categorias={categorias} alCrear={vi.fn()} />);
  const campo = await screen.findByLabelText('Descripción del trabajo *');
  fireEvent.click(screen.getByRole('button', { name: 'Publicar solicitud' }));
  await screen.findByRole('alert');
  expect(campo).toHaveValue(s.descripcion);
  expect(campo).toHaveAttribute('aria-invalid', 'true');
  expect(campo).toHaveAccessibleDescription(/Retira el teléfono/);
});

test('una carga rechazada conserva el archivo elegido y no aparece como fotografía cargada', async () => {
  const api = crearApi();
  api.cargar.mockRejectedValue(new ErrorApi(422, 'IMAGEN_FORMATO_NO_ADMITIDO', 'Formato real no admitido.'));
  render(<EditorSolicitud id={id} api={api} busqueda={busqueda} categorias={categorias} alCrear={vi.fn()} />);
  const campo = await screen.findByLabelText('Seleccionar fotografía');
  fireEvent.change(campo, { target: { files: [new File(['falso'], 'falso.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Cargar fotografía' }));
  expect(await screen.findByText('Formato real no admitido.')).toBeVisible();
  expect(screen.getByText('Aún no hay fotografías cargadas.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Cargar fotografía' })).toBeEnabled();
  expect(api.foto).not.toHaveBeenCalled();
});

test('publicar confirma la lista final en la publicación, conservando el borrador si falla', async () => {
  const archivoId = 'ad4b3004-ba7e-45f2-be02-f36285e3b8c1';
  const s: SolicitudPrivada = { ...borrador, archivos: [{ archivoId, estado: 'PREPARADO', bytes: 120, ancho: 10, alto: 10 }] };
  const api = crearApi(s);
  api.foto.mockRejectedValue(new Error('Vista no disponible'));
  api.publicar.mockRejectedValueOnce(new ErrorApi(422, 'SOLICITUD_INCOMPLETA', 'Completa el borrador.'));
  render(<EditorSolicitud id={id} api={api} busqueda={busqueda} categorias={categorias} alCrear={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Incluir foto 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Publicar solicitud' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Completa el borrador.');
  expect(api.editar).not.toHaveBeenCalled();
  expect(api.publicar).toHaveBeenCalledWith(id, { version: 1, archivosIds: [archivoId] }, expect.any(String));
  expect(screen.getByText('Por confirmar al guardar')).toBeVisible();
});

test('el detalle visible a un destinatario no abre el editor de titular', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ solicitudId: id, titulos: ['DESTINATARIO'] })));
  const api = crearApiSolicitudes(() => 'token-de-prueba', vi.fn());
  render(<EditorSolicitud id={id} api={api} busqueda={busqueda} categorias={categorias} alCrear={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Solo puedes gestionar tus propias solicitudes.');
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
});
