import { expect, test, vi } from 'vitest';
import { ErrorApi } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';
import {
  buscarMiCotizacion, centimosAPrecio, datosDeFormulario, explicacionDeEstado, falloDeCotizacion, formatoSoles, formularioDe, formularioVacio, instanteAFechaLima, precioACentimos,
  validarFormulario, vigenciaAInstante, type FormularioCotizacion,
} from '../../../src/features/solicitudes-cotizaciones/aplicacion/cotizacion.js';
import type { Cotizacion, VersionDeCotizacion } from '../../../src/features/solicitudes-cotizaciones/modelos/cotizaciones.js';

const hoy = '2026-11-27';
const completa = (extra: Partial<FormularioCotizacion> = {}): FormularioCotizacion => ({ ...formularioVacio(), alcance: 'Levantar el muro', vigenteHasta: '2026-12-31', formaCalculo: 'S/ 85 por m2', ...extra });
const version = (extra: Partial<VersionDeCotizacion> = {}): VersionDeCotizacion => ({
  numero: 1, versionTrabajoSolicitud: 1, tipo: 'ESTIMADA', alcance: 'Levantar el muro', vigenteHasta: '2026-12-31T00:00:00.000Z', creadaEn: '2026-11-26T18:00:00Z', reemplazada: false, ...extra,
});
const cotizacion = (extra: Partial<Cotizacion> = {}): Cotizacion => ({
  cotizacionId: 'c1', solicitudId: 's1', prestadorId: 'p1', estado: 'VIGENTE', vencida: false, requiereRevision: false, solicitudCerrada: false, motivosNoAceptable: [], version: 1,
  versionVigente: version(), creadaEn: '2026-11-26T18:00:00Z', ...extra,
});

test('el precio en soles se convierte a céntimos sin errores de coma flotante', () => {
  expect(precioACentimos('2500')).toBe(250000);
  expect(precioACentimos('2 500,50')).toBe(250050);
  expect(precioACentimos('2,500.50')).toBe(250050);
  expect(precioACentimos('0.1')).toBe(10);
  expect(precioACentimos('19.99')).toBe(1999);
  expect(precioACentimos('1.005')).toBeNull();
  expect(precioACentimos('')).toBeUndefined();
  for (const malo of ['0', '0,00', '-5', 'abc', '12.3.4', 'S/ 5']) expect(precioACentimos(malo), malo).toBeNull();
  expect(precioACentimos('999999999999999999')).toBeNull();
  expect(centimosAPrecio(250050)).toBe('2500.50');
  expect(centimosAPrecio(250000)).toBe('2500');
  expect(formatoSoles(250050)).toMatch(/2[\s,.]?500[.,]50/);
});

test('la vigencia es el final del día elegido en la hora de Lima y se recupera igual', () => {
  expect(vigenciaAInstante('2026-12-31')).toBe('2027-01-01T04:59:59.000Z');
  expect(instanteAFechaLima('2027-01-01T04:59:59.000Z')).toBe('2026-12-31');
});

test('validación por tipo: estimada pide precio o forma de cálculo; definitiva, precio, plazo y condiciones de pago', () => {
  expect(validarFormulario(completa(), hoy)).toEqual({});
  expect(validarFormulario(completa({ formaCalculo: '', precio: '1500' }), hoy)).toEqual({});
  expect(Object.keys(validarFormulario(completa({ formaCalculo: '' }), hoy)).sort()).toEqual(['formaCalculo', 'precio']);
  const definitiva = completa({ tipo: 'DEFINITIVA', formaCalculo: '' });
  expect(Object.keys(validarFormulario(definitiva, hoy)).sort()).toEqual(['condicionesPago', 'plazoDias', 'precio']);
  expect(validarFormulario({ ...definitiva, precio: '2500', plazoDias: '6', condicionesPago: '50 % al inicio' }, hoy)).toEqual({});
});

test('validación de alcance, importe, plazo y vigencia', () => {
  expect(validarFormulario(completa({ alcance: '   ' }), hoy).alcance).toMatch(/alcance/i);
  expect(validarFormulario(completa({ precio: 'cero' }), hoy).precio).toMatch(/importe/i);
  expect(validarFormulario(completa({ plazoDias: '0' }), hoy).plazoDias).toBeDefined();
  expect(validarFormulario(completa({ plazoDias: '2.5' }), hoy).plazoDias).toBeDefined();
  expect(validarFormulario(completa({ vigenteHasta: '' }), hoy).vigenteHasta).toBeDefined();
  expect(validarFormulario(completa({ vigenteHasta: '2026-11-26' }), hoy).vigenteHasta).toMatch(/anterior a hoy/);
  expect(validarFormulario(completa({ vigenteHasta: hoy }), hoy).vigenteHasta).toBeUndefined();
});

test('el cuerpo enviado omite lo no informado, recorta textos y expresa el precio en céntimos', () => {
  const datos = datosDeFormulario(completa({ alcance: '  Muro  ', exclusiones: '   ', materiales: ' Ladrillo ', precio: '2 500,50', plazoDias: ' 6 ' }));
  expect(datos).toEqual({ tipo: 'ESTIMADA', alcance: 'Muro', materiales: 'Ladrillo', formaCalculo: 'S/ 85 por m2', precioCentimos: 250050, plazoDias: 6, vigenteHasta: '2027-01-01T04:59:59.000Z' });
  expect(Object.keys(datos)).not.toContain('exclusiones');
});

test('al actualizar, el formulario parte de la versión vigente', () => {
  const f = formularioDe(version({ tipo: 'DEFINITIVA', precioCentimos: 250050, plazoDias: 6, condicionesPago: '50 %', vigenteHasta: '2027-01-01T04:59:59.000Z' }));
  expect(f).toMatchObject({ tipo: 'DEFINITIVA', precio: '2500.50', plazoDias: '6', condicionesPago: '50 %', vigenteHasta: '2026-12-31', exclusiones: '', materiales: '' });
});

test('los textos de estado nunca afirman que se avisó, notificó o envió algo, y explican qué hacer', () => {
  const casos = [
    cotizacion(), cotizacion({ estado: 'VENCIDA', vencida: true }), cotizacion({ estado: 'PENDIENTE_REVISION', requiereRevision: true }),
    cotizacion({ estado: 'RETIRADA' }), cotizacion({ solicitudCerrada: true }),
  ];
  for (const c of casos) expect(explicacionDeEstado(c)).not.toMatch(/avis|notific|enviamos|entregad|le[ií]d/i);
  expect(explicacionDeEstado(casos[1]!)).toMatch(/Actualízala/);
  expect(explicacionDeEstado(casos[2]!)).toMatch(/Revisa el trabajo y actualiza/);
  expect(explicacionDeEstado(casos[4]!)).toMatch(/cerrada/);
});

test('los errores del servidor se traducen a mensajes comprensibles y se asocian al campo (precio incluido)', () => {
  const f = falloDeCotizacion(new ErrorApi(422, 'COTIZACION_INCOMPLETA', 'Faltan datos.', [{ campo: 'precioCentimos', motivo: 'Campo obligatorio.' }, { campo: 'plazoDias', motivo: 'Campo obligatorio.' }]));
  expect(f.campos).toEqual({ precio: 'Campo obligatorio.', plazoDias: 'Campo obligatorio.' });
  expect(f.mensaje).toMatch(/Faltan datos obligatorios/);
  expect(falloDeCotizacion(new ErrorApi(409, 'SOLICITUD_MODIFICADA', 'x'))).toMatchObject({ solicitudCambio: true });
  expect(falloDeCotizacion(new ErrorApi(409, 'VERSION_DESACTUALIZADA', 'x'))).toMatchObject({ versionVieja: true });
  expect(falloDeCotizacion(new ErrorApi(409, 'COTIZACION_EXISTENTE', 'x')).mensaje).toMatch(/Actualízala/);
  expect(falloDeCotizacion(new ErrorApi(404, 'RECURSO_NO_DISPONIBLE', 'x')).mensaje).toMatch(/no está disponible/);
  expect(falloDeCotizacion(new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Reintente.')).mensaje).toBe('Reintente.');
});

test('buscar la cotización propia recorre las páginas y descarta las retiradas', async () => {
  const mias = vi.fn(async (pagina: number) => pagina === 1
    ? { elementos: [cotizacion({ cotizacionId: 'a', solicitudId: 's0' }), cotizacion({ cotizacionId: 'r', estado: 'RETIRADA' })], total: 3, pagina: 1, tamano: 2 }
    : { elementos: [cotizacion({ cotizacionId: 'b' })], total: 3, pagina: 2, tamano: 2 });
  expect((await buscarMiCotizacion({ mias }, 's1'))?.cotizacionId).toBe('b');
  expect(mias).toHaveBeenCalledTimes(2);
  const vacia = vi.fn(async () => ({ elementos: [], total: 0, pagina: 1, tamano: 20 }));
  expect(await buscarMiCotizacion({ mias: vacia }, 's1')).toBeUndefined();
  expect(vacia).toHaveBeenCalledTimes(1);
});
