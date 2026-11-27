import { describe, expect, test } from '@jest/globals';
import { esFechaDeCalendario, hoyEnLima } from '../../../src/modulos/solicitudes/dominio/fechas.js';
import {
  advertenciasDeCobertura, camposFaltantesParaPublicar, distritosAdmitidos, exigirCompleta, exigirFechaNoAnterior, exigirInmutables, exigirPeriodoCoherente,
  normalizarEntrada, type Solicitud,
} from '../../../src/modulos/solicitudes/dominio/solicitud.js';

// T045 · parte de dominio de CA-SOL-02 a 04, CA-SOL-09 y 10 y CA-BOR-01 a 10.
const A = '123e4567-e89b-42d3-a456-426614174000'; const B = '223e4567-e89b-42d3-a456-426614174001'; const P = '323e4567-e89b-42d3-a456-426614174002';
const codigo = (accion: () => unknown) => { try { accion(); return undefined; } catch (e) { return (e as { codigo?: string }).codigo; } };
const detalles = (accion: () => unknown) => { try { accion(); return undefined; } catch (e) { return (e as { detalles?: { campo?: string }[] }).detalles?.map(d => d.campo); } };

const solicitud = (extra: Partial<Solicitud> = {}): Solicitud => ({
  id: A, clienteCuentaId: 'cliente', tipo: 'PUBLICADA', estado: 'ABIERTA', prestadorId: null, prestadorCuentaId: null, servicio: null, descripcion: 'Texto', medidas: null,
  categoriaId: A, distrito: 'ayacucho', fechaDesde: '2030-01-10', fechaHasta: null, compartirFotografias: false, version: 2, versionTrabajo: 1, creadaEn: new Date(), actualizadaEn: new Date(),
  publicadaEn: new Date(), cerradaEn: null, ...extra,
});

describe('fechas de calendario en America/Lima', () => {
  test('hoy se calcula en Lima (UTC-5), no en UTC', () => {
    expect(hoyEnLima(new Date('2026-11-26T04:59:59Z'))).toBe('2026-11-25');
    expect(hoyEnLima(new Date('2026-11-26T05:00:00Z'))).toBe('2026-11-26');
    expect(hoyEnLima(new Date('2026-01-01T03:00:00Z'))).toBe('2025-12-31');
    expect(hoyEnLima(new Date('2028-03-01T04:00:00Z'))).toBe('2028-02-29');
  });
  test('solo acepta fechas reales con forma AAAA-MM-DD', () => {
    for (const bien of ['2026-11-26', '2028-02-29']) expect(esFechaDeCalendario(bien)).toBe(true);
    for (const mal of ['2026-02-30', '2027-02-29', '2026-13-01', '26-11-2026', '2026-11-26T10:00:00Z', '', null, 20261126, '2026-1-1']) expect(esFechaDeCalendario(mal)).toBe(false);
  });
  test('la fecha deseada no puede ser anterior a hoy y el periodo debe ser coherente (FR-302)', () => {
    expect(codigo(() => exigirFechaNoAnterior('2026-11-26', '2026-11-25', null))).toBe('FECHA_NO_VALIDA');
    expect(codigo(() => exigirFechaNoAnterior('2026-11-26', '2026-11-26', null))).toBeUndefined();
    expect(codigo(() => exigirFechaNoAnterior('2026-11-26', '2026-12-01', '2026-11-30'))).toBe('FECHA_NO_VALIDA');
    expect(detalles(() => exigirFechaNoAnterior('2026-11-26', '2026-12-01', '2026-11-30'))).toEqual(['fechaHasta']);
    expect(codigo(() => exigirFechaNoAnterior('2026-11-26', '2026-12-01', '2026-12-01'))).toBeUndefined();
    expect(codigo(() => exigirPeriodoCoherente(null, '2026-12-01'))).toBe('FECHA_NO_VALIDA');
    expect(codigo(() => exigirPeriodoCoherente(null, null))).toBeUndefined();
  });
});

describe('formato de la entrada: 400 DATOS_INVALIDOS (CA-SOL-10 y CA-BOR-01)', () => {
  test('la descripción admite hasta 2 000 caracteres y las medidas hasta 500', () => {
    expect(codigo(() => normalizarEntrada({ descripcion: 'x'.repeat(2000) }))).toBeUndefined();
    expect(codigo(() => normalizarEntrada({ descripcion: 'x'.repeat(2001) }))).toBe('DATOS_INVALIDOS');
    expect(codigo(() => normalizarEntrada({ medidas: 'x'.repeat(500) }))).toBeUndefined();
    expect(codigo(() => normalizarEntrada({ medidas: 'x'.repeat(501) }))).toBe('DATOS_INVALIDOS');
    expect(detalles(() => normalizarEntrada({ descripcion: 'x'.repeat(2001), medidas: 'y'.repeat(501) }))).toEqual(['descripcion', 'medidas']);
  });
  test('un texto en blanco no es un valor, y el texto se recorta', () => {
    expect(codigo(() => normalizarEntrada({ descripcion: '    ' }))).toBe('DATOS_INVALIDOS');
    expect(normalizarEntrada({ descripcion: '  hola  ', medidas: ' 2 m ' })).toMatchObject({ descripcion: 'hola', medidas: '2 m' });
  });
  test('la longitud se mide después de recortar y rechaza texto con sustitutos sueltos', () => {
    expect(codigo(() => normalizarEntrada({ descripcion: ` ${'x'.repeat(2000)} ` }))).toBeUndefined();
    expect(codigo(() => normalizarEntrada({ descripcion: 'a\ud800' }))).toBe('DATOS_INVALIDOS');
  });
  test('el distrito debe estar en el catálogo de cinco (CA-SOL-04)', () => {
    expect(distritosAdmitidos).toHaveLength(5);
    for (const d of distritosAdmitidos) expect(codigo(() => normalizarEntrada({ distrito: d }))).toBeUndefined();
    for (const d of ['huanta', 'Ayacucho', 'lima', '']) expect(codigo(() => normalizarEntrada({ distrito: d }))).toBe('DATOS_INVALIDOS');
  });
  test('las fechas deben ser de calendario y el tipo, uno de los dos admitidos', () => {
    expect(codigo(() => normalizarEntrada({ fechaDesde: '2026-02-30' }))).toBe('DATOS_INVALIDOS');
    expect(codigo(() => normalizarEntrada({ fechaHasta: 'mañana' }))).toBe('DATOS_INVALIDOS');
    expect(codigo(() => normalizarEntrada({ tipo: 'OTRA' as never }))).toBe('DATOS_INVALIDOS');
    expect(normalizarEntrada({ tipo: 'PUBLICADA', fechaDesde: '2030-01-01' })).toMatchObject({ tipo: 'PUBLICADA', fechaDesde: '2030-01-01' });
  });
  test('un borrador puede guardarse con solo el tipo (CA-BOR-01)', () => {
    expect(normalizarEntrada({ tipo: 'PUBLICADA' })).toEqual({ tipo: 'PUBLICADA' });
  });
  test('no existe campo de título ni de dirección exacta: la entrada no los define', () => {
    expect(Object.keys(normalizarEntrada({ tipo: 'PUBLICADA', descripcion: 'x' }))).not.toEqual(expect.arrayContaining(['titulo', 'direccion']));
  });
});

describe('datos obligatorios al publicar: 422 SOLICITUD_INCOMPLETA (CA-BOR-02)', () => {
  const vacio = { tipo: 'PUBLICADA' as const, prestadorId: null, descripcion: null, categoriaId: null, distrito: null, fechaDesde: null };
  test('indica todos los campos que faltan, en orden estable', () => {
    expect(camposFaltantesParaPublicar(vacio)).toEqual(['descripcion', 'categoriaId', 'distrito', 'fechaDesde']);
    expect(detalles(() => exigirCompleta(vacio))).toEqual(['descripcion', 'categoriaId', 'distrito', 'fechaDesde']);
    expect(codigo(() => exigirCompleta(vacio))).toBe('SOLICITUD_INCOMPLETA');
  });
  test('una dirigida exige además el prestador', () => {
    expect(camposFaltantesParaPublicar({ ...vacio, tipo: 'DIRIGIDA' })).toEqual(['prestadorId', 'descripcion', 'categoriaId', 'distrito', 'fechaDesde']);
  });
  test('una solicitud completa no devuelve faltantes y la fecha hasta es opcional', () => {
    expect(camposFaltantesParaPublicar({ tipo: 'DIRIGIDA', prestadorId: P, descripcion: 'x', categoriaId: A, distrito: 'ayacucho', fechaDesde: '2030-01-01' })).toEqual([]);
    expect(codigo(() => exigirCompleta({ tipo: 'PUBLICADA', prestadorId: null, descripcion: 'x', categoriaId: A, distrito: 'ayacucho', fechaDesde: '2030-01-01' }))).toBeUndefined();
  });
});

describe('campos inmutables tras publicar: 422 CAMPO_NO_MODIFICABLE (CA-SOL-09)', () => {
  const conServicio = solicitud({ tipo: 'DIRIGIDA', prestadorId: P, prestadorCuentaId: 'cuenta-p', servicio: { servicioId: B, titulo: 'Servicio', categoriaId: A } });
  test('cambiar el tipo, el prestador, el servicio o, con servicio, la categoría se rechaza e indica el campo', () => {
    expect([codigo(() => exigirInmutables(conServicio, { tipo: 'PUBLICADA' })), detalles(() => exigirInmutables(conServicio, { tipo: 'PUBLICADA' }))]).toEqual(['CAMPO_NO_MODIFICABLE', ['tipo']]);
    expect(detalles(() => exigirInmutables(conServicio, { prestadorId: A }))).toEqual(['prestadorId']);
    expect(detalles(() => exigirInmutables(conServicio, { servicioId: A }))).toEqual(['servicioId']);
    expect(detalles(() => exigirInmutables(conServicio, { categoriaId: B }))).toEqual(['categoriaId']);
  });
  test('enviar el mismo valor no es un cambio, aunque cambie la capitalización del identificador', () => {
    expect(codigo(() => exigirInmutables(conServicio, { tipo: 'DIRIGIDA', prestadorId: P.toUpperCase(), servicioId: B, categoriaId: A }))).toBeUndefined();
  });
  test('sin servicio, la categoría sí puede cambiar', () => {
    expect(codigo(() => exigirInmutables(solicitud(), { categoriaId: B }))).toBeUndefined();
    expect(codigo(() => exigirInmutables(solicitud(), { tipo: 'DIRIGIDA' }))).toBe('CAMPO_NO_MODIFICABLE');
  });
  test('antes de publicar nada es inmutable', () => {
    const borrador = solicitud({ estado: 'BORRADOR', publicadaEn: null, versionTrabajo: 0 });
    expect(codigo(() => exigirInmutables(borrador, { tipo: 'DIRIGIDA', prestadorId: P, servicioId: B, categoriaId: B }))).toBeUndefined();
  });
  test('los demás datos siguen editables en una publicada', () => {
    expect(codigo(() => exigirInmutables(conServicio, { descripcion: 'Nueva', medidas: 'x', distrito: 'carmen-alto', fechaDesde: '2031-01-01', compartirFotografias: true }))).toBeUndefined();
  });
});

describe('advertencias de cobertura no bloqueantes (CA-BOR-08 y CA-BOR-09)', () => {
  test('una dirigida sin servicio advierte del distrito y de la especialidad', () => {
    const w = advertenciasDeCobertura({ distrito: 'jesus-nazareno', categoriaId: A, tieneServicio: false, distritosDelPrestador: ['ayacucho'], especialidadesDelPrestador: [B] });
    expect(w.map(x => x.codigo)).toEqual(['DISTRITO_FUERA_DE_COBERTURA', 'CATEGORIA_FUERA_DE_ESPECIALIDADES']);
    expect(w.every(x => /igualmente/.test(x.mensaje))).toBe(true);
  });
  test('con servicio solo advierte del distrito: la categoría sale del servicio', () => {
    expect(advertenciasDeCobertura({ distrito: 'jesus-nazareno', categoriaId: A, tieneServicio: true, distritosDelPrestador: ['ayacucho'], especialidadesDelPrestador: [] }).map(x => x.codigo)).toEqual(['DISTRITO_FUERA_DE_COBERTURA']);
  });
  test('si el prestador cubre el distrito y declara la categoría, no hay advertencias', () => {
    expect(advertenciasDeCobertura({ distrito: 'ayacucho', categoriaId: A, tieneServicio: false, distritosDelPrestador: ['ayacucho'], especialidadesDelPrestador: [A] })).toEqual([]);
  });
  test('sin distrito ni categoría todavía (borrador) no advierte', () => {
    expect(advertenciasDeCobertura({ distrito: null, categoriaId: null, tieneServicio: false, distritosDelPrestador: [], especialidadesDelPrestador: [] })).toEqual([]);
  });
});
