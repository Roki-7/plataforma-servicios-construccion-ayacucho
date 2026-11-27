import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { alternarSeleccion, MAXIMO_COMPARACION, NO_INDICADO, vistaDeComparacion } from '../../../src/features/solicitudes-cotizaciones/aplicacion/comparacion.js';
import { explicacionParaCliente } from '../../../src/features/solicitudes-cotizaciones/aplicacion/cotizacion.js';
import { crearApiCotizaciones } from '../../../src/features/solicitudes-cotizaciones/infraestructura/api-cotizaciones.js';
import type { Aclaracion, ApiCotizaciones, Cotizacion, CotizacionDetalle, VersionDeCotizacion } from '../../../src/features/solicitudes-cotizaciones/modelos/cotizaciones.js';
import { ComparacionDeCotizaciones } from '../../../src/features/solicitudes-cotizaciones/presentacion/ComparacionDeCotizaciones.js';
import { CotizacionesRecibidas } from '../../../src/features/solicitudes-cotizaciones/presentacion/CotizacionesRecibidas.js';
import { DetalleCotizacionRecibida } from '../../../src/features/solicitudes-cotizaciones/presentacion/DetalleCotizacionRecibida.js';
import { HiloAclaraciones } from '../../../src/features/solicitudes-cotizaciones/presentacion/HiloAclaraciones.js';
import { ErrorApi } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';

const solicitudId = '12345678-1234-4321-8123-123456789123';
const idDe = (n: number) => `abcdef12-1234-4321-8123-${String(n).padStart(12, '0')}`;
/** Con `exactOptionalPropertyTypes`, un campo «no informado» se expresa con `undefined` y se omite del objeto, como lo hace el servidor. */
const version = (extra: { [K in keyof VersionDeCotizacion]?: VersionDeCotizacion[K] | undefined } = {}): VersionDeCotizacion => {
  const completo: Record<string, unknown> = {
    numero: 1, versionTrabajoSolicitud: 1, tipo: 'DEFINITIVA', alcance: 'Levantar el muro con acabado pulido', precioCentimos: 250050, plazoDias: 6, condicionesPago: '50 % al inicio',
    vigenteHasta: '2031-12-31T00:00:00.000Z', creadaEn: '2026-11-26T18:00:00Z', reemplazada: false, ...extra,
  };
  for (const [k, v] of Object.entries(completo)) if (v === undefined) delete completo[k];
  return completo as unknown as VersionDeCotizacion;
};
const cotizacion = (n: number, extra: Partial<Cotizacion> = {}, v: Parameters<typeof version>[0] = {}): Cotizacion => ({
  cotizacionId: idDe(n), solicitudId, prestadorId: `p${n}`, prestadorNombrePublico: `Prestador ${n}`, estado: 'VIGENTE', vencida: false, requiereRevision: false, solicitudCerrada: false,
  motivosNoAceptable: [], version: 1, versionVigente: version(v), creadaEn: '2026-11-26T18:00:00Z', ...extra,
});
const pagina = <T,>(elementos: T[]) => ({ elementos, total: elementos.length, pagina: 1, tamano: 20 });
const mensaje = (n: number, autor: 'CLIENTE' | 'PRESTADOR', texto: string): Aclaracion => ({ aclaracionId: `m${n}`, numero: n, autor, texto, versionCotizacion: 1, creadaEn: '2026-11-26T18:00:00Z' });
const crearApi = () => ({
  enviar: vi.fn(), actualizar: vi.fn(), retirar: vi.fn(), obtener: vi.fn<ApiCotizaciones['obtener']>(async () => ({ ...cotizacion(1), versiones: [version()] } as CotizacionDetalle)),
  mias: vi.fn(), deSolicitud: vi.fn<ApiCotizaciones['deSolicitud']>(async () => pagina([])),
  aclaraciones: vi.fn<ApiCotizaciones['aclaraciones']>(async () => pagina([])), enviarAclaracion: vi.fn<ApiCotizaciones['enviarAclaracion']>(),
}) as unknown as ApiCotizaciones & { deSolicitud: ReturnType<typeof vi.fn>; aclaraciones: ReturnType<typeof vi.fn>; enviarAclaracion: ReturnType<typeof vi.fn>; obtener: ReturnType<typeof vi.fn> };
const navegar = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

// ─── lógica de comparación ────────────────────────────────────────────────────────────────────────────────────────
test('la vista de comparación muestra «No indicado», rotula las estimadas, no suma, no ordena y señala los estados', () => {
  const entradas = [
    cotizacion(3, {}, { precioCentimos: 900000 }),
    cotizacion(1, { estado: 'VENCIDA', vencida: true, motivosNoAceptable: ['VENCIDA'] }, { tipo: 'ESTIMADA', precioCentimos: undefined, plazoDias: undefined, condicionesPago: undefined, formaCalculo: 'S/ 85 por m2' }),
    cotizacion(2, { estado: 'PENDIENTE_REVISION', requiereRevision: true, solicitudCerrada: true, motivosNoAceptable: ['PENDIENTE_REVISION', 'SOLICITUD_CERRADA'] }, { precioCentimos: 100 }),
  ];
  const vista = vistaDeComparacion(entradas);
  expect(vista.columnas.map(c => c.id)).toEqual([idDe(3), idDe(1), idDe(2)]);
  expect(vista.columnas[1]).toMatchObject({ rotuloDeTipo: 'Estimada', esEstimada: true, etiquetaDeEstado: 'Vencida' });
  const fila = (clave: string) => vista.filas.find(f => f.clave === clave)!.celdas;
  expect(fila('precio')[1]).toBe(NO_INDICADO); expect(fila('plazo')[1]).toBe(NO_INDICADO); expect(fila('condicionesPago')[1]).toBe(NO_INDICADO);
  expect(fila('exclusiones')).toEqual([NO_INDICADO, NO_INDICADO, NO_INDICADO]);
  expect(fila('formaCalculo')[1]).toBe('S/ 85 por m2');
  expect(vista.filas.map(f => f.clave)).toEqual(['precio', 'plazo', 'vigencia', 'alcance', 'exclusiones', 'materiales', 'manoDeObra', 'formaCalculo', 'condicionesPago']);
  expect(vista.columnas[2]!.senales.map(s => s.motivo)).toEqual(['PENDIENTE_REVISION', 'SOLICITUD_CERRADA']);
  expect(vista.advertencias).toEqual(['Las cotizaciones estimadas no son un precio final y no son comparables con las definitivas.']);
  expect(JSON.stringify(vista)).not.toMatch(/total|suma|mejor|ranking|puntaje|recomend/i);
  expect(Object.keys(vista).sort()).toEqual(['advertencias', 'columnas', 'filas']);
});

test('la selección admite como máximo 10 cotizaciones y se puede desmarcar', () => {
  let sel: string[] = [];
  for (let i = 1; i <= 12; i += 1) sel = alternarSeleccion(sel, idDe(i));
  expect(sel).toHaveLength(MAXIMO_COMPARACION);
  expect(sel).not.toContain(idDe(11));
  expect(alternarSeleccion(sel, idDe(3))).not.toContain(idDe(3));
});

test('las explicaciones para el cliente no afirman que se avisó, notificó o envió algo', () => {
  for (const c of [cotizacion(1), cotizacion(1, { estado: 'VENCIDA' }), cotizacion(1, { estado: 'PENDIENTE_REVISION' }), cotizacion(1, { estado: 'RETIRADA' }), cotizacion(1, { solicitudCerrada: true })]) {
    expect(explicacionParaCliente(c)).not.toMatch(/avis|notific|enviamos|entregad|le[ií]d/i);
  }
});

// ─── hilo de aclaraciones ─────────────────────────────────────────────────────────────────────────────────────────
test('el hilo muestra los mensajes en orden con su autor, la versión y el contador, sin acciones de edición ni adjuntos', async () => {
  const api = crearApi();
  api.aclaraciones.mockResolvedValue(pagina([mensaje(1, 'CLIENTE', '¿Incluye el desmonte?'), mensaje(2, 'PRESTADOR', 'No, se cotiza aparte.')]));
  render(<HiloAclaraciones api={api} cotizacionId={idDe(1)} miRol="CLIENTE" nombreDelPrestador="Beto Gasfitero" />);
  const lista = await screen.findByRole('list', { name: 'Mensajes del hilo' });
  const items = within(lista).getAllByRole('listitem');
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent('Tú'); expect(items[0]).toHaveTextContent('¿Incluye el desmonte?');
  expect(items[1]).toHaveTextContent('Beto Gasfitero'); expect(items[1]).toHaveTextContent('Mensaje 2 · sobre la versión 1');
  expect(screen.getByText('2 de 20 mensajes')).toBeVisible();
  expect(screen.queryByRole('button', { name: /editar|borrar|eliminar|adjuntar/i })).not.toBeInTheDocument();
  expect(document.querySelector('input[type="file"]')).toBeNull();
});

test('un hilo vacío invita a escribir y un fallo de carga se anuncia con reintento', async () => {
  const api = crearApi();
  api.aclaraciones.mockRejectedValueOnce(new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio no disponible.'));
  render(<HiloAclaraciones api={api} cotizacionId={idDe(1)} miRol="PRESTADOR" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible.');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(/Aún no hay mensajes/)).toBeVisible();
  expect(screen.getByLabelText('Tu mensaje')).toBeEnabled();
});

test('el contador es visible y valida un mensaje vacío o de más de 1 000 caracteres junto al campo, sin enviar', async () => {
  const api = crearApi();
  render(<HiloAclaraciones api={api} cotizacionId={idDe(1)} miRol="CLIENTE" />);
  const campo = await screen.findByLabelText('Tu mensaje');
  expect(screen.getByText('0 / 1000 caracteres')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  expect(campo).toHaveAttribute('aria-invalid', 'true');
  expect(campo).toHaveAccessibleDescription(/Escribe un mensaje antes de enviarlo/);
  fireEvent.change(campo, { target: { value: 'x'.repeat(1001) } });
  expect(screen.getByText('1001 / 1000 caracteres')).toHaveClass('error');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  expect(campo).toHaveAccessibleDescription(/sobran 1/);
  expect(api.enviarAclaracion).not.toHaveBeenCalled();
});

test('enviar agrega el mensaje real devuelto por el servidor, limpia el campo y no promete avisos', async () => {
  const api = crearApi();
  api.enviarAclaracion.mockResolvedValue(mensaje(1, 'CLIENTE', 'Hola, ¿cuándo empezarían?'));
  render(<HiloAclaraciones api={api} cotizacionId={idDe(1)} miRol="CLIENTE" />);
  const campo = await screen.findByLabelText('Tu mensaje');
  fireEvent.change(campo, { target: { value: '  Hola, ¿cuándo empezarían?  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  expect(await screen.findByRole('status', { name: '' })).toBeDefined();
  await waitFor(() => expect(screen.getByRole('list', { name: 'Mensajes del hilo' })).toHaveTextContent('Hola, ¿cuándo empezarían?'));
  expect(api.enviarAclaracion).toHaveBeenCalledWith(idDe(1), 'Hola, ¿cuándo empezarían?', expect.any(String));
  expect(campo).toHaveValue('');
  expect(screen.getByText('Tu mensaje quedó guardado en el hilo.')).toBeVisible();
  expect(document.body.textContent).not.toMatch(/avis|notific|entregad/i);
});

test('evita el doble envío y, ante un fallo de red, conserva el texto y reintenta con la misma clave', async () => {
  const api = crearApi();
  let resolver: (m: Aclaracion) => void = () => undefined;
  api.enviarAclaracion.mockImplementationOnce(() => new Promise<Aclaracion>(r => { resolver = r; }));
  const { unmount } = render(<HiloAclaraciones api={api} cotizacionId={idDe(1)} miRol="CLIENTE" />);
  fireEvent.change(await screen.findByLabelText('Tu mensaje'), { target: { value: 'Una consulta' } });
  const boton = screen.getByRole('button', { name: 'Enviar mensaje' });
  fireEvent.click(boton); fireEvent.click(boton);
  expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  expect(api.enviarAclaracion).toHaveBeenCalledTimes(1);
  resolver(mensaje(1, 'CLIENTE', 'Una consulta'));
  await screen.findByText('Tu mensaje quedó guardado en el hilo.');
  unmount();
  const api2 = crearApi();
  api2.enviarAclaracion.mockRejectedValueOnce(new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Reintente en unos momentos.')).mockResolvedValue(mensaje(1, 'CLIENTE', 'Otra consulta'));
  render(<HiloAclaraciones api={api2} cotizacionId={idDe(1)} miRol="CLIENTE" />);
  fireEvent.change(await screen.findByLabelText('Tu mensaje'), { target: { value: 'Otra consulta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reintente en unos momentos.');
  expect(screen.getByLabelText('Tu mensaje')).toHaveValue('Otra consulta');
  fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  await screen.findByText('Tu mensaje quedó guardado en el hilo.');
  expect(api2.enviarAclaracion.mock.calls[1]![2]).toBe(api2.enviarAclaracion.mock.calls[0]![2]);
});

test('con 20 mensajes el hilo no ofrece escribir; en solo lectura explica por qué', async () => {
  const api = crearApi();
  api.aclaraciones.mockResolvedValue(pagina(Array.from({ length: 20 }, (_, i) => mensaje(i + 1, i % 2 ? 'PRESTADOR' : 'CLIENTE', `Mensaje ${i + 1}`))));
  const { unmount } = render(<HiloAclaraciones api={api} cotizacionId={idDe(1)} miRol="CLIENTE" />);
  expect(await screen.findByText(/alcanzó el máximo de 20 mensajes/)).toBeVisible();
  expect(screen.queryByLabelText('Tu mensaje')).not.toBeInTheDocument();
  unmount();
  api.aclaraciones.mockResolvedValue(pagina([mensaje(1, 'CLIENTE', 'Antes de retirar')]));
  render(<HiloAclaraciones api={api} cotizacionId={idDe(1)} miRol="PRESTADOR" soloLectura="Retiraste esta cotización: el hilo queda en lectura." />);
  expect(await screen.findByText('Retiraste esta cotización: el hilo queda en lectura.')).toBeVisible();
  expect(screen.getByText('Antes de retirar')).toBeVisible();
  expect(screen.queryByLabelText('Tu mensaje')).not.toBeInTheDocument();
});

test('si el servidor responde que el hilo está lleno, se muestra el mensaje y se vuelve a leer el hilo', async () => {
  const api = crearApi();
  api.enviarAclaracion.mockRejectedValueOnce(new ErrorApi(422, 'LIMITE_ACLARACIONES', 'x'));
  render(<HiloAclaraciones api={api} cotizacionId={idDe(1)} miRol="CLIENTE" />);
  fireEvent.change(await screen.findByLabelText('Tu mensaje'), { target: { value: 'Uno más' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('máximo de 20 mensajes');
  await waitFor(() => expect(api.aclaraciones).toHaveBeenCalledTimes(2));
});

// ─── lista de cotizaciones recibidas ──────────────────────────────────────────────────────────────────────────────
test('la lista muestra autor, tipo, estado, importe y vigencia en orden de llegada, sin clasificar, y permite marcar para comparar', async () => {
  const api = crearApi();
  const alCambiar = vi.fn();
  api.deSolicitud.mockResolvedValue(pagina([cotizacion(1, {}, { precioCentimos: 900000 }), cotizacion(2, { estado: 'VENCIDA', vencida: true }, { tipo: 'ESTIMADA', precioCentimos: undefined, formaCalculo: 'S/ 85 por m2' }), cotizacion(3)]));
  render(<CotizacionesRecibidas api={api} solicitudId={solicitudId} seleccion={[]} alCambiarSeleccion={alCambiar} alNavegar={navegar} alComparar={vi.fn()} />);
  const lista = await screen.findByRole('list', { name: 'Cotizaciones recibidas' });
  const tarjetas = within(lista).getAllByRole('listitem');
  expect(tarjetas.map(t => within(t).getByRole('heading').textContent)).toEqual(['Prestador 1', 'Prestador 2', 'Prestador 3']);
  expect(within(tarjetas[1]!).getByText('Vencida')).toBeVisible();
  expect(within(tarjetas[1]!).getByText('Estimada')).toBeVisible();
  expect(within(tarjetas[1]!).getByText('Precio por definir')).toBeVisible();
  expect(screen.getByText(/sin clasificarlas/)).toBeVisible();
  expect(document.body.textContent).not.toMatch(/mejor cotizaci|recomendad|ranking/i);
  fireEvent.click(within(tarjetas[0]!).getByRole('checkbox', { name: /Comparar.*Prestador 1/ }));
  expect(alCambiar).toHaveBeenCalledWith([idDe(1)]);
  expect(within(tarjetas[2]!).getByRole('link', { name: /Ver detalle y aclaraciones de la cotización de Prestador 3/ })).toHaveAttribute('href', `/solicitudes/${solicitudId}/cotizaciones/${idDe(3)}`);
});

test('comparar exige al menos 2 y, con 10 marcadas, el resto no se puede marcar', async () => {
  const api = crearApi();
  api.deSolicitud.mockResolvedValue(pagina(Array.from({ length: 12 }, (_, i) => cotizacion(i + 1))));
  const alComparar = vi.fn();
  const { rerender } = render(<CotizacionesRecibidas api={api} solicitudId={solicitudId} seleccion={[idDe(1)]} alCambiarSeleccion={vi.fn()} alNavegar={navegar} alComparar={alComparar} />);
  await screen.findByRole('list', { name: 'Cotizaciones recibidas' });
  expect(screen.getByRole('button', { name: 'Comparar seleccionadas' })).toBeDisabled();
  expect(screen.getByText(/elige al menos una más/)).toBeVisible();
  rerender(<CotizacionesRecibidas api={api} solicitudId={solicitudId} seleccion={Array.from({ length: 10 }, (_, i) => idDe(i + 1))} alCambiarSeleccion={vi.fn()} alNavegar={navegar} alComparar={alComparar} />);
  expect(screen.getByRole('button', { name: 'Comparar seleccionadas' })).toBeEnabled();
  expect(screen.getByText(/alcanzaste el máximo/)).toBeVisible();
  expect(screen.getByRole('checkbox', { name: /Comparar.*Prestador 11/ })).toBeDisabled();
  expect(screen.getByRole('checkbox', { name: /Comparar.*Prestador 1$/ })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Comparar seleccionadas' }));
  expect(alComparar).toHaveBeenCalledOnce();
});

test('sin cotizaciones explica qué verá el cliente, y un fallo se anuncia con reintento', async () => {
  const api = crearApi();
  api.deSolicitud.mockRejectedValueOnce(new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio no disponible.'));
  render(<CotizacionesRecibidas api={api} solicitudId={solicitudId} seleccion={[]} alCambiarSeleccion={vi.fn()} alNavegar={navegar} alComparar={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible.');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByRole('heading', { name: 'Aún no recibiste cotizaciones' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Volver a mi solicitud' })).toHaveAttribute('href', `/solicitudes/${solicitudId}`);
});

// ─── comparación ──────────────────────────────────────────────────────────────────────────────────────────────────
test('la comparación consulta solo las cotizaciones elegidas y las muestra en tarjetas completas con «No indicado» y rótulos, sin clasificarlas', async () => {
  const api = crearApi();
  api.deSolicitud.mockResolvedValue(pagina([
    cotizacion(2, {}, { tipo: 'ESTIMADA', precioCentimos: undefined, plazoDias: undefined, condicionesPago: undefined, formaCalculo: 'S/ 85 por m2' }),
    cotizacion(1, { estado: 'PENDIENTE_REVISION', requiereRevision: true, motivosNoAceptable: ['PENDIENTE_REVISION'] }, { precioCentimos: 100 }),
  ]));
  render(<ComparacionDeCotizaciones api={api} solicitudId={solicitudId} ids={[idDe(2), idDe(1)]} alQuitar={vi.fn()} alNavegar={navegar} />);
  const lista = await screen.findByRole('list', { name: 'Cotizaciones comparadas' });
  expect(api.deSolicitud).toHaveBeenCalledWith(solicitudId, 1, [idDe(2), idDe(1)]);
  const [primera, segunda] = within(lista).getAllByRole('listitem');
  expect(within(primera!).getByText('Prestador 2')).toBeVisible();
  expect(within(primera!).getByText('Estimada')).toBeVisible();
  expect(within(primera!).getAllByText('No indicado').length).toBeGreaterThanOrEqual(4);
  expect(within(segunda!).getByText('Requiere revisión')).toBeVisible();
  for (const etiqueta of ['Precio', 'Plazo', 'Válida hasta', 'Alcance', 'Exclusiones', 'Materiales', 'Mano de obra', 'Forma de cálculo', 'Condiciones de pago']) expect(within(primera!).getByText(etiqueta)).toBeVisible();
  expect(screen.getByText(/no son un precio final/)).toBeVisible();
  expect(screen.getByText(/No hay una clasificación/)).toBeVisible();
  expect(document.body.textContent).not.toMatch(/mejor cotizaci|recomendad|ranking|total (de|general)/i);
});

test('quitar una cotización de la comparación es una acción real, y con menos de 2 se pide elegir más', async () => {
  const api = crearApi();
  api.deSolicitud.mockResolvedValue(pagina([cotizacion(1), cotizacion(2)]));
  const alQuitar = vi.fn();
  const { unmount } = render(<ComparacionDeCotizaciones api={api} solicitudId={solicitudId} ids={[idDe(1), idDe(2)]} alQuitar={alQuitar} alNavegar={navegar} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Quitar a Prestador 2 de la comparación' }));
  expect(alQuitar).toHaveBeenCalledWith(idDe(2));
  unmount();
  render(<ComparacionDeCotizaciones api={api} solicitudId={solicitudId} ids={[idDe(1)]} alQuitar={alQuitar} alNavegar={navegar} />);
  expect(screen.getByRole('heading', { name: 'Elige al menos dos cotizaciones' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Elegir cotizaciones' })).toHaveAttribute('href', `/solicitudes/${solicitudId}/cotizaciones`);
});

test('en pantalla amplia la comparación es una tabla accesible con encabezados de fila y columna dentro de un marco desplazable', async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('64rem'), media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  const api = crearApi();
  api.deSolicitud.mockResolvedValue(pagina([cotizacion(1), cotizacion(2, {}, { tipo: 'ESTIMADA', precioCentimos: undefined, formaCalculo: 'x' })]));
  render(<ComparacionDeCotizaciones api={api} solicitudId={solicitudId} ids={[idDe(1), idDe(2)]} alQuitar={vi.fn()} alNavegar={navegar} />);
  const tabla = await screen.findByRole('table', { name: /Comparación de 2 cotizaciones/ });
  expect(within(tabla).getAllByRole('columnheader')).toHaveLength(3);
  expect(within(tabla).getByRole('rowheader', { name: 'Precio' })).toBeVisible();
  expect(within(tabla).getAllByRole('row')).toHaveLength(1 + 9);
  expect(screen.getByRole('region', { name: /se desplaza horizontalmente/ })).toHaveAttribute('tabindex', '0');
});

// ─── detalle de una cotización recibida y cliente HTTP ───────────────────────────────────────────────────────────
test('el detalle de una cotización recibida muestra el autor, el estado y el hilo con el cliente como participante; retirada, en lectura', async () => {
  const api = crearApi();
  api.obtener.mockResolvedValue({ ...cotizacion(1, { estado: 'RETIRADA', motivosNoAceptable: ['RETIRADA'] }), versiones: [version()] });
  api.aclaraciones.mockResolvedValue(pagina([mensaje(1, 'PRESTADOR', 'Puedo empezar el lunes.')]));
  render(<DetalleCotizacionRecibida api={api} solicitudId={solicitudId} cotizacionId={idDe(1)} alNavegar={navegar} />);
  expect(await screen.findByRole('heading', { name: 'Cotización de Prestador 1' })).toBeVisible();
  expect(screen.getAllByText(/retiró esta cotización/).length).toBeGreaterThan(0);
  expect(await screen.findByText('Puedo empezar el lunes.')).toBeVisible();
  expect(screen.queryByLabelText('Tu mensaje')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /seleccionar|aceptar|contratar/i })).not.toBeInTheDocument();
});

test('el cliente HTTP usa las rutas del contrato para listar, comparar con ids y para las aclaraciones', async () => {
  const fetchSimulado = vi.fn(async () => Response.json(pagina([])));
  vi.stubGlobal('fetch', fetchSimulado);
  const api = crearApiCotizaciones(() => 'token-de-prueba', vi.fn());
  await api.deSolicitud(solicitudId, 2); await api.deSolicitud(solicitudId, 1, [idDe(1), idDe(2)]);
  await api.aclaraciones(idDe(1), 1); await api.enviarAclaracion(idDe(1), 'Hola', 'clave-1');
  const llamadas = fetchSimulado.mock.calls as unknown as [string, RequestInit][];
  expect(llamadas.map(([url, o]) => `${o.method} ${decodeURIComponent(url)}`)).toEqual([
    `GET /api/v1/solicitudes/${solicitudId}/cotizaciones?pagina=2`, `GET /api/v1/solicitudes/${solicitudId}/cotizaciones?pagina=1&ids=${idDe(1)},${idDe(2)}`,
    `GET /api/v1/cotizaciones/${idDe(1)}/aclaraciones?pagina=1`, `POST /api/v1/cotizaciones/${idDe(1)}/aclaraciones`]);
  expect((llamadas[3]![1].headers as Headers).get('Idempotency-Key')).toBe('clave-1');
  expect(JSON.parse(String(llamadas[3]![1].body))).toEqual({ texto: 'Hola' });
  expect(llamadas.every(([, o]) => o.cache === 'no-store' && o.credentials === 'same-origin')).toBe(true);
});
