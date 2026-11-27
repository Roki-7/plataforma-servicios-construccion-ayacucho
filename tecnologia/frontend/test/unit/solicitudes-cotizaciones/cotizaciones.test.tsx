import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CategoriasWeb } from '../../../src/features/prestadores-catalogo/aplicacion/categorias.js';
import { ErrorApi } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';
import { crearApiCotizaciones } from '../../../src/features/solicitudes-cotizaciones/infraestructura/api-cotizaciones.js';
import type { ApiSolicitudes, SolicitudVisible } from '../../../src/features/solicitudes-cotizaciones/modelos/contratos.js';
import type { ApiCotizaciones, Cotizacion, CotizacionDetalle, VersionDeCotizacion } from '../../../src/features/solicitudes-cotizaciones/modelos/cotizaciones.js';
import { DetalleCotizacion } from '../../../src/features/solicitudes-cotizaciones/presentacion/DetalleCotizacion.js';
import { FormularioDeCotizacion } from '../../../src/features/solicitudes-cotizaciones/presentacion/FormularioCotizacion.js';
import { MisCotizaciones } from '../../../src/features/solicitudes-cotizaciones/presentacion/MisCotizaciones.js';
import { PanelCotizacion } from '../../../src/features/solicitudes-cotizaciones/presentacion/PanelCotizacion.js';
import { PantallaActualizar, PantallaCotizar } from '../../../src/features/solicitudes-cotizaciones/presentacion/PantallasDeCotizacion.js';
import { formularioVacio } from '../../../src/features/solicitudes-cotizaciones/aplicacion/cotizacion.js';

const solicitudId = '12345678-1234-4321-8123-123456789123';
const cotizacionId = 'abcdef12-1234-4321-8123-123456789123';
const categoriaId = 'aaaaaaaa-1234-4321-8123-123456789123';
const categorias = new CategoriasWeb({ listar: async () => [{ categoriaId, nombre: 'Construcción y obra', categoriaPadreId: null }] } as never);
const solicitud: SolicitudVisible = {
  solicitudId, tipo: 'PUBLICADA', estado: 'ABIERTA', descripcion: 'Levantar un muro de ladrillo de 3 x 2 m', categoriaId, distrito: 'ayacucho', fechaDesde: '2031-03-10',
  fotografias: { hay: false, compartidas: false, archivos: [] }, versionTrabajo: 2, titulos: ['COMPATIBLE'],
};
const version = (extra: Partial<VersionDeCotizacion> = {}): VersionDeCotizacion => ({
  numero: 1, versionTrabajoSolicitud: 2, tipo: 'ESTIMADA', alcance: 'Levantar el muro con acabado pulido', formaCalculo: 'S/ 85 por m2', vigenteHasta: '2031-12-31T00:00:00.000Z',
  creadaEn: '2026-11-26T18:00:00Z', reemplazada: false, ...extra,
});
const cotizacion = (extra: Partial<Cotizacion> = {}): Cotizacion => ({
  cotizacionId, solicitudId, prestadorId: 'p1', estado: 'VIGENTE', vencida: false, requiereRevision: false, solicitudCerrada: false, motivosNoAceptable: [], version: 1,
  versionVigente: version(), creadaEn: '2026-11-26T18:00:00Z', ...extra,
});
const detalle = (extra: Partial<CotizacionDetalle> = {}): CotizacionDetalle => ({ ...cotizacion(), versiones: [version()], ...extra });
const vacia = { elementos: [], total: 0, pagina: 1, tamano: 20 };
const crearApi = () => ({
  enviar: vi.fn<ApiCotizaciones['enviar']>(async () => cotizacion()), actualizar: vi.fn<ApiCotizaciones['actualizar']>(async () => cotizacion({ version: 2 })),
  retirar: vi.fn<ApiCotizaciones['retirar']>(async () => cotizacion({ estado: 'RETIRADA' })), obtener: vi.fn<ApiCotizaciones['obtener']>(async () => detalle()),
  mias: vi.fn<ApiCotizaciones['mias']>(async () => vacia),
});
const navegar = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
const solicitudes = (s: SolicitudVisible = solicitud) => ({ obtenerVisible: vi.fn(async () => s) }) as unknown as ApiSolicitudes;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

function formulario(props: Partial<Parameters<typeof FormularioDeCotizacion>[0]> = {}) {
  const enviar = vi.fn<Parameters<typeof FormularioDeCotizacion>[0]['enviar']>(async () => cotizacion());
  const alExito = vi.fn(); const alRecargarSolicitud = vi.fn();
  render(<FormularioDeCotizacion titulo="Enviar cotización" introduccion="Detalla tu propuesta." etiquetaBoton="Enviar cotización" inicial={formularioVacio()} solicitud={solicitud}
    categoria="Construcción y obra" enviar={enviar} alExito={alExito} alRecargarSolicitud={alRecargarSolicitud} volverA={{ href: '/x', texto: 'Volver' }} alNavegar={navegar} {...props} />);
  return { enviar, alExito, alRecargarSolicitud };
}
const escribir = (etiqueta: string | RegExp, valor: string) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
function llenarEstimada() {
  escribir(/Alcance del trabajo/, 'Levantar el muro con acabado pulido'); escribir(/Forma de cálculo/, 'S/ 85 por m2'); escribir(/Válida hasta/, '2031-12-31');
}

test('el formulario valida antes de enviar, muestra cada error junto a su campo y enfoca el primero', async () => {
  const { enviar } = formulario();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar cotización' }));
  const alcance = screen.getByLabelText(/Alcance del trabajo/);
  expect(alcance).toHaveAttribute('aria-invalid', 'true');
  expect(alcance).toHaveAccessibleDescription(/Describe el alcance/);
  expect(screen.getByLabelText(/Válida hasta/)).toHaveAttribute('aria-invalid', 'true');
  await waitFor(() => expect(alcance).toHaveFocus());
  expect(enviar).not.toHaveBeenCalled();
});

test('los requisitos cambian con el tipo: una definitiva marca precio, plazo y condiciones de pago como obligatorios', () => {
  formulario();
  expect(screen.getByLabelText(/Precio total en soles/).closest('div.sol-campo')).toHaveTextContent('(opcional)');
  fireEvent.click(screen.getByRole('radio', { name: /Definitiva/ }));
  for (const nombre of [/Precio total en soles/, /Plazo de ejecución en días/, /Condiciones de pago/]) expect(screen.getByLabelText(nombre).closest('div.sol-campo')).not.toHaveTextContent('(opcional)');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar cotización' }));
  expect(screen.getByLabelText(/Plazo de ejecución en días/)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText(/Condiciones de pago/)).toHaveAttribute('aria-invalid', 'true');
});

test('envía una estimada con la forma de cálculo y el precio en céntimos, y avisa del éxito', async () => {
  const { enviar, alExito } = formulario();
  llenarEstimada(); escribir(/Precio total en soles/, '2 500,50');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar cotización' }));
  await waitFor(() => expect(alExito).toHaveBeenCalledOnce());
  expect(enviar).toHaveBeenCalledWith({ tipo: 'ESTIMADA', alcance: 'Levantar el muro con acabado pulido', formaCalculo: 'S/ 85 por m2', precioCentimos: 250050, vigenteHasta: '2032-01-01T04:59:59.000Z' }, expect.any(String));
});

test('evita el doble envío mientras la operación está en curso', async () => {
  let resolver: (c: Cotizacion) => void = () => undefined;
  const enviar = vi.fn<Parameters<typeof FormularioDeCotizacion>[0]['enviar']>(() => new Promise<Cotizacion>(r => { resolver = r; }));
  formulario({ enviar });
  llenarEstimada();
  const boton = screen.getByRole('button', { name: 'Enviar cotización' });
  fireEvent.click(boton); fireEvent.click(boton);
  expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  expect(enviar).toHaveBeenCalledTimes(1);
  resolver(cotizacion());
});

test('ante un fallo de red conserva lo escrito y reintenta con la misma clave; tras un rechazo definitivo, con otra', async () => {
  const enviar = vi.fn<Parameters<typeof FormularioDeCotizacion>[0]['enviar']>();
  enviar.mockRejectedValueOnce(new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Reintente en unos momentos.'));
  enviar.mockRejectedValueOnce(new ErrorApi(409, 'COTIZACION_EXISTENTE', 'x'));
  enviar.mockResolvedValue(cotizacion());
  formulario({ enviar });
  llenarEstimada();
  const boton = screen.getByRole('button', { name: 'Enviar cotización' });
  fireEvent.click(boton);
  expect(await screen.findByRole('alert')).toHaveTextContent('Reintente en unos momentos.');
  expect(screen.getByLabelText(/Alcance del trabajo/)).toHaveValue('Levantar el muro con acabado pulido');
  fireEvent.click(boton);
  expect(await screen.findByRole('alert')).toHaveTextContent('Ya tienes una cotización sin retirar');
  expect(enviar.mock.calls[1]![1]).toBe(enviar.mock.calls[0]![1]);
  fireEvent.click(boton);
  await waitFor(() => expect(enviar).toHaveBeenCalledTimes(3));
  expect(enviar.mock.calls[2]![1]).not.toBe(enviar.mock.calls[1]![1]);
});

test('los errores de campo del servidor se muestran junto al campo y SOLICITUD_MODIFICADA ofrece recargar la solicitud', async () => {
  const enviar = vi.fn<Parameters<typeof FormularioDeCotizacion>[0]['enviar']>();
  enviar.mockRejectedValueOnce(new ErrorApi(422, 'COTIZACION_INCOMPLETA', 'Faltan.', [{ campo: 'precio', motivo: 'Campo obligatorio.' }]));
  enviar.mockRejectedValueOnce(new ErrorApi(409, 'SOLICITUD_MODIFICADA', 'x'));
  const { alRecargarSolicitud } = formulario({ enviar });
  llenarEstimada();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar cotización' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText(/Precio total en soles/)).toHaveAccessibleDescription(/Campo obligatorio/);
  fireEvent.click(screen.getByRole('button', { name: 'Enviar cotización' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Ver la solicitud actualizada' }));
  expect(alRecargarSolicitud).toHaveBeenCalledOnce();
  expect(screen.getByLabelText(/Alcance del trabajo/)).toHaveValue('Levantar el muro con acabado pulido');
});

test('el resumen de la solicitud indica la versión de trabajo sobre la que se cotiza', () => {
  formulario();
  const resumen = screen.getByRole('region', { name: 'Solicitud que cotizas' });
  expect(within(resumen).getByText(/Versión de trabajo 2/)).toBeVisible();
  expect(within(resumen).getByText('Levantar un muro de ladrillo de 3 x 2 m')).toBeVisible();
  expect(document.body.textContent).not.toMatch(/correo|teléfono/i);
});

test('mis cotizaciones muestra «Requiere revisión» y «Vencida» sin afirmar que se avisó a nadie', async () => {
  const api = crearApi();
  api.mias.mockResolvedValue({ ...vacia, total: 4, elementos: [
    cotizacion({ cotizacionId: 'a1', estado: 'PENDIENTE_REVISION', requiereRevision: true }), cotizacion({ cotizacionId: 'a2', estado: 'VENCIDA', vencida: true }),
    cotizacion({ cotizacionId: 'a3', solicitudCerrada: true }), cotizacion({ cotizacionId: 'a4', estado: 'RETIRADA' }),
  ] });
  render(<MisCotizaciones api={api} alNavegar={navegar} />);
  const lista = await screen.findByRole('list', { name: 'Mis cotizaciones' });
  for (const texto of ['Requiere revisión', 'Vencida', 'Vigente', 'Retirada', 'Solicitud cerrada']) expect(within(lista).getAllByText(texto).length).toBeGreaterThan(0);
  expect(document.body.textContent).not.toMatch(/avis|notific|enviamos|entregad/i);
  expect(within(lista).getAllByRole('link', { name: /Ver cotización/ })[0]).toHaveAttribute('href', '/prestador/cotizaciones/a1');
});

test('mis cotizaciones sin datos explica cómo empezar y un fallo se anuncia con reintento', async () => {
  const api = crearApi();
  api.mias.mockRejectedValueOnce(new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio no disponible.'));
  render(<MisCotizaciones api={api} alNavegar={navegar} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible.');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('heading', { name: 'Aún no enviaste cotizaciones' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Ver oportunidades' })).toHaveAttribute('href', '/prestador/oportunidades');
});

test('el detalle de una cotización pendiente de revisión explica qué hacer y ofrece revisar y actualizar', async () => {
  const api = crearApi();
  api.obtener.mockResolvedValue(detalle({ estado: 'PENDIENTE_REVISION', requiereRevision: true, motivosNoAceptable: ['PENDIENTE_REVISION'] }));
  render(<DetalleCotizacion api={api} id={cotizacionId} alNavegar={navegar} ir={vi.fn()} />);
  expect(await screen.findByText(/La solicitud cambió después de tu última versión/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Revisar y actualizar' })).toHaveAttribute('href', `/prestador/cotizaciones/${cotizacionId}/actualizar`);
  expect(screen.getByText('Hay cambios en la solicitud que aún no revisaste.')).toBeVisible();
  expect(screen.getAllByText('No indicado').length).toBeGreaterThan(0);
  expect(document.body.textContent).not.toMatch(/avis|notific|enviamos|entregad/i);
});

test('retirar pide confirmación, usa la versión de control y repite la misma clave tras un fallo de red', async () => {
  const api = crearApi();
  const ir = vi.fn();
  api.retirar.mockRejectedValueOnce(new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Reintente.'));
  render(<DetalleCotizacion api={api} id={cotizacionId} alNavegar={navegar} ir={ir} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retirar cotización' }));
  expect(api.retirar).not.toHaveBeenCalled();
  expect(screen.getByText(/Retirar es definitivo/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reintente.');
  fireEvent.click(screen.getByRole('button', { name: 'Retirar cotización' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }));
  await waitFor(() => expect(ir).toHaveBeenCalledWith('/prestador/cotizaciones', expect.stringContaining('retirada')));
  expect(api.retirar).toHaveBeenCalledTimes(2);
  expect(api.retirar.mock.calls[0]).toEqual([cotizacionId, 1, expect.any(String)]);
  expect(api.retirar.mock.calls[1]![2]).toBe(api.retirar.mock.calls[0]![2]);
});

test('una cotización retirada o de una solicitud cerrada no ofrece actualizar ni retirar', async () => {
  const api = crearApi();
  api.obtener.mockResolvedValue(detalle({ estado: 'RETIRADA', motivosNoAceptable: ['RETIRADA'] }));
  const { unmount } = render(<DetalleCotizacion api={api} id={cotizacionId} alNavegar={navegar} ir={vi.fn()} />);
  expect(await screen.findByRole('link', { name: 'Enviar una cotización nueva' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Retirar cotización' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /actualizar/i })).not.toBeInTheDocument();
  unmount();
  api.obtener.mockResolvedValue(detalle({ solicitudCerrada: true, motivosNoAceptable: ['SOLICITUD_CERRADA'] }));
  render(<DetalleCotizacion api={api} id={cotizacionId} alNavegar={navegar} ir={vi.fn()} />);
  expect(await screen.findByText(/La solicitud está cerrada: la cotización ya no admite cambios/)).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Retirar cotización' })).not.toBeInTheDocument();
});

test('las versiones anteriores se conservan y se pueden consultar', async () => {
  const api = crearApi();
  api.obtener.mockResolvedValue(detalle({ versionVigente: version({ numero: 2 }), versiones: [version({ numero: 2 }), version({ numero: 1, reemplazada: true, alcance: 'Alcance anterior' })] }));
  render(<DetalleCotizacion api={api} id={cotizacionId} alNavegar={navegar} ir={vi.fn()} />);
  const resumen = await screen.findByText(/Versión 1 ·.*reemplazada/);
  fireEvent.click(resumen);
  expect(screen.getByText('Alcance anterior')).toBeVisible();
});

test('el panel de la solicitud ofrece cotizar solo a quien puede, y enlaza a la cotización existente en lugar de ofrecer otra', async () => {
  const api = crearApi();
  const { unmount } = render(<PanelCotizacion api={api} solicitud={solicitud} alNavegar={navegar} />);
  expect(await screen.findByRole('link', { name: 'Enviar cotización' })).toHaveAttribute('href', `/prestador/solicitudes/${solicitudId}/cotizar`);
  unmount();
  render(<PanelCotizacion api={api} solicitud={{ ...solicitud, estado: 'CERRADA' }} alNavegar={navegar} />);
  expect(await screen.findByText(/está cerrada y no admite cotizaciones nuevas/)).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Enviar cotización' })).not.toBeInTheDocument();
  cleanup();
  render(<PanelCotizacion api={api} solicitud={{ ...solicitud, titulos: ['AUTOR_DE_COTIZACION'] }} alNavegar={navegar} />);
  expect(await screen.findByText(/No puedes enviar una cotización nueva/)).toBeVisible();
  cleanup();
  api.mias.mockResolvedValue({ ...vacia, total: 1, elementos: [cotizacion()] });
  render(<PanelCotizacion api={api} solicitud={solicitud} alNavegar={navegar} />);
  expect(await screen.findByRole('link', { name: 'Ver mi cotización' })).toHaveAttribute('href', `/prestador/cotizaciones/${cotizacionId}`);
  expect(screen.queryByRole('link', { name: 'Enviar cotización' })).not.toBeInTheDocument();
});

test('cotizar una solicitud cerrada, o sin título, no muestra el formulario', async () => {
  const api = crearApi();
  const { unmount } = render(<PantallaCotizar api={api} solicitudes={solicitudes({ ...solicitud, estado: 'CERRADA' })} categorias={categorias} alNavegar={navegar} ir={vi.fn()} solicitudId={solicitudId} />);
  expect(await screen.findByRole('heading', { name: 'La solicitud ya no está abierta' })).toBeVisible();
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  unmount();
  render(<PantallaCotizar api={api} solicitudes={solicitudes({ ...solicitud, titulos: ['AUTOR_DE_COTIZACION'] })} categorias={categorias} alNavegar={navegar} ir={vi.fn()} solicitudId={solicitudId} />);
  expect(await screen.findByRole('heading', { name: 'No puedes enviar una cotización nueva' })).toBeVisible();
});

test('cotizar usa la versión de trabajo vigente y navega a la cotización creada con un aviso de éxito', async () => {
  const api = crearApi();
  const ir = vi.fn();
  render(<PantallaCotizar api={api} solicitudes={solicitudes()} categorias={categorias} alNavegar={navegar} ir={ir} solicitudId={solicitudId} />);
  await screen.findByRole('heading', { name: 'Enviar cotización' });
  llenarEstimada();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar cotización' }));
  await waitFor(() => expect(ir).toHaveBeenCalledWith(`/prestador/cotizaciones/${cotizacionId}`, 'Cotización enviada.'));
  expect(api.enviar).toHaveBeenCalledWith(solicitudId, expect.objectContaining({ versionTrabajoSolicitud: 2, tipo: 'ESTIMADA' }), expect.any(String));
});

test('actualizar parte de la versión vigente, avisa si requiere revisión y envía la versión de control', async () => {
  const api = crearApi();
  api.obtener.mockResolvedValue(detalle({ estado: 'PENDIENTE_REVISION', requiereRevision: true, version: 3, versionVigente: version({ numero: 2 }) }));
  const ir = vi.fn();
  render(<PantallaActualizar api={api} solicitudes={solicitudes()} categorias={categorias} alNavegar={navegar} ir={ir} cotizacionId={cotizacionId} />);
  expect(await screen.findByText(/La solicitud cambió después de tu última versión/)).toBeVisible();
  expect(screen.getByLabelText(/Alcance del trabajo/)).toHaveValue('Levantar el muro con acabado pulido');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar nueva versión' }));
  await waitFor(() => expect(ir).toHaveBeenCalledWith(`/prestador/cotizaciones/${cotizacionId}`, 'Cotización actualizada.'));
  expect(api.actualizar).toHaveBeenCalledWith(cotizacionId, expect.objectContaining({ versionTrabajoSolicitud: 2, versionCotizacion: 3 }), expect.any(String));
});

test('el cliente HTTP usa las rutas del contrato, la clave de idempotencia y la versión de control', async () => {
  const fetchSimulado = vi.fn(async () => Response.json(cotizacion()));
  vi.stubGlobal('fetch', fetchSimulado);
  const api = crearApiCotizaciones(() => 'token-de-prueba', vi.fn());
  const datos = { tipo: 'ESTIMADA' as const, alcance: 'x', vigenteHasta: '2031-12-31T00:00:00.000Z', formaCalculo: 'y', versionTrabajoSolicitud: 2 };
  await api.enviar(solicitudId, datos, 'clave-1'); await api.actualizar(cotizacionId, { ...datos, versionCotizacion: 3 }, 'clave-2');
  await api.retirar(cotizacionId, 4, 'clave-3'); await api.obtener(cotizacionId); await api.mias(2);
  const llamadas = fetchSimulado.mock.calls as unknown as [string, RequestInit][];
  expect(llamadas.map(([url, o]) => `${o.method} ${url}`)).toEqual([
    `POST /api/v1/solicitudes/${solicitudId}/cotizaciones`, `POST /api/v1/cotizaciones/${cotizacionId}/versiones`, `POST /api/v1/cotizaciones/${cotizacionId}/retiro`,
    `GET /api/v1/cotizaciones/${cotizacionId}`, 'GET /api/v1/cotizaciones?pagina=2']);
  expect((llamadas[0]![1].headers as Headers).get('Idempotency-Key')).toBe('clave-1');
  expect((llamadas[0]![1].headers as Headers).get('Authorization')).toBe('Bearer token-de-prueba');
  expect(JSON.parse(String(llamadas[2]![1].body))).toEqual({ versionCotizacion: 4 });
  expect(llamadas.every(([, o]) => o.cache === 'no-store' && o.credentials === 'same-origin')).toBe(true);
});
