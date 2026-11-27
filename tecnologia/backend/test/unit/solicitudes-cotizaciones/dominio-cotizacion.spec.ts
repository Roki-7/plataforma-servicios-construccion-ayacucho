import { describe, expect, test } from '@jest/globals';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import {
  estadoEfectivo, evaluarCotizacion, exigirCotizacionCompleta, normalizarDatosCotizacion, PRECIO_MAXIMO_CENTIMOS, type DatosCotizacion,
} from '../../../src/modulos/cotizaciones/dominio/cotizacion.js';

const ahora = new Date('2026-11-27T12:00:00.000Z');
const futuro = new Date('2026-12-31T00:00:00.000Z');
const estimada: DatosCotizacion = { tipo: 'ESTIMADA', alcance: 'Levantar un muro', vigenteHasta: futuro, formaCalculo: 'S/ 80 por m2' };
const definitiva: DatosCotizacion = { tipo: 'DEFINITIVA', alcance: 'Levantar un muro', vigenteHasta: futuro, precioCentimos: 250000, plazoDias: 5, condicionesPago: '50 % al inicio' };
const falla = (datos: DatosCotizacion) => { try { exigirCotizacionCompleta(datos, ahora); } catch (e) { return e as ErrorAplicacion; } return undefined; };
const campos = (e: ErrorAplicacion | undefined) => e?.detalles.map(d => d.campo);

describe('datos obligatorios por tipo (FR-337, CA-RF17-01 a 03)', () => {
  test('una estimada solo con forma de cálculo es válida (CA-RF17-01)', () => {
    expect(falla(estimada)).toBeUndefined();
    expect(falla({ ...estimada, formaCalculo: undefined, precioCentimos: 1 })).toBeUndefined();
  });
  test('una estimada sin precio ni forma de cálculo es incompleta (CA-RF17-03)', () => {
    const e = falla({ ...estimada, formaCalculo: undefined });
    expect(e).toMatchObject({ http: 422, codigo: 'COTIZACION_INCOMPLETA' });
    expect(campos(e)).toEqual(['precioCentimos', 'formaCalculo']);
  });
  test('una definitiva exige precio, plazo y condiciones de pago, y los informa todos a la vez (CA-RF17-02)', () => {
    expect(falla(definitiva)).toBeUndefined();
    expect(campos(falla({ ...definitiva, plazoDias: undefined }))).toEqual(['plazoDias']);
    expect(campos(falla({ ...definitiva, condicionesPago: undefined }))).toEqual(['condicionesPago']);
    expect(campos(falla({ tipo: 'DEFINITIVA', alcance: 'x', vigenteHasta: futuro }))).toEqual(['precioCentimos', 'plazoDias', 'condicionesPago']);
    expect(falla({ ...definitiva, plazoDias: undefined })).toMatchObject({ http: 422, codigo: 'COTIZACION_INCOMPLETA' });
  });
  test('el alcance es obligatorio y un texto en blanco cuenta como ausente', () => {
    expect(campos(falla({ ...estimada, alcance: '   ' }))).toEqual(['alcance']);
  });
  test('los campos opcionales no informados no se exigen', () => {
    expect(falla({ ...definitiva })).toBeUndefined();
  });
});

describe('precio en céntimos y vigencia', () => {
  test('el precio debe ser un entero mayor que cero, sin máximo de negocio hasta 2^53 - 1', () => {
    for (const precioCentimos of [0, -1, 1.5, Number.NaN, PRECIO_MAXIMO_CENTIMOS + 1]) {
      expect(falla({ ...definitiva, precioCentimos })).toMatchObject({ http: 400, codigo: 'DATOS_INVALIDOS' });
    }
    expect(falla({ ...definitiva, precioCentimos: PRECIO_MAXIMO_CENTIMOS })).toBeUndefined();
    expect(falla({ ...definitiva, precioCentimos: 1 })).toBeUndefined();
  });
  test('el plazo es un entero positivo', () => {
    expect(falla({ ...definitiva, plazoDias: 0 })).toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    expect(falla({ ...definitiva, plazoDias: 2.5 })).toMatchObject({ codigo: 'DATOS_INVALIDOS' });
  });
  test('la vigencia debe ser posterior a la hora oficial del sistema', () => {
    expect(falla({ ...estimada, vigenteHasta: ahora })).toMatchObject({ http: 422, codigo: 'FECHA_NO_VALIDA' });
    expect(falla({ ...estimada, vigenteHasta: new Date(ahora.getTime() - 1) })).toMatchObject({ codigo: 'FECHA_NO_VALIDA' });
    expect(falla({ ...estimada, vigenteHasta: new Date(ahora.getTime() + 1) })).toBeUndefined();
    expect(falla({ ...estimada, vigenteHasta: new Date('invalida') })).toMatchObject({ codigo: 'FECHA_NO_VALIDA' });
  });
  test('los errores no reproducen los valores recibidos', () => {
    const e = falla({ ...definitiva, precioCentimos: -987654321 });
    expect(JSON.stringify([e?.message, e?.detalles])).not.toContain('987654321');
  });
});

describe('normalización', () => {
  test('recorta los textos y trata los vacíos como no informados', () => {
    const n = normalizarDatosCotizacion({ tipo: 'ESTIMADA', alcance: '  Muro  ', exclusiones: '   ', materiales: ' Ladrillo ', vigenteHasta: futuro, formaCalculo: '' });
    expect(n).toEqual({ tipo: 'ESTIMADA', alcance: 'Muro', materiales: 'Ladrillo', vigenteHasta: futuro });
  });
});

describe('estado efectivo y prioridad (FR-339, CA-COT-07, CA-COT-04)', () => {
  const base = { retirada: false, vigenteHasta: futuro, versionTrabajoCotizada: 1, versionTrabajoSolicitud: 1, solicitudCerrada: false, ahora };
  test('vigente cuando nada la afecta', () => {
    expect(estadoEfectivo(base)).toBe('VIGENTE');
    expect(evaluarCotizacion(base)).toEqual({ estado: 'VIGENTE', vencida: false, requiereRevision: false, solicitudCerrada: false, motivosNoAceptable: [] });
  });
  test('un cambio relevante posterior la deja pendiente de revisión y no aceptable (CA-COT-04)', () => {
    const e = evaluarCotizacion({ ...base, versionTrabajoSolicitud: 2 });
    expect(e).toMatchObject({ estado: 'PENDIENTE_REVISION', requiereRevision: true, motivosNoAceptable: ['PENDIENTE_REVISION'] });
  });
  test('vence exactamente cuando la vigencia es menor o igual a la hora oficial', () => {
    expect(evaluarCotizacion({ ...base, vigenteHasta: ahora }).estado).toBe('VENCIDA');
    expect(evaluarCotizacion({ ...base, vigenteHasta: new Date(ahora.getTime() + 1) }).estado).toBe('VIGENTE');
  });
  test('la prioridad es RETIRADA, VENCIDA, PENDIENTE_REVISION y VIGENTE cuando coinciden varias', () => {
    const todo = { ...base, vigenteHasta: ahora, versionTrabajoSolicitud: 3, solicitudCerrada: true };
    expect(estadoEfectivo({ ...todo, retirada: true })).toBe('RETIRADA');
    expect(estadoEfectivo(todo)).toBe('VENCIDA');
    expect(estadoEfectivo({ ...todo, vigenteHasta: futuro })).toBe('PENDIENTE_REVISION');
    expect(estadoEfectivo({ ...base, solicitudCerrada: true })).toBe('VIGENTE');
  });
  test('los indicadores y los motivos de no aceptabilidad se informan todos, con la solicitud cerrada también', () => {
    const e = evaluarCotizacion({ ...base, retirada: true, vigenteHasta: ahora, versionTrabajoSolicitud: 2, solicitudCerrada: true });
    expect(e).toEqual({ estado: 'RETIRADA', vencida: true, requiereRevision: true, solicitudCerrada: true,
      motivosNoAceptable: ['RETIRADA', 'VENCIDA', 'PENDIENTE_REVISION', 'SOLICITUD_CERRADA'] });
    expect(evaluarCotizacion({ ...base, solicitudCerrada: true })).toMatchObject({ estado: 'VIGENTE', solicitudCerrada: true, motivosNoAceptable: ['SOLICITUD_CERRADA'] });
  });
  test('ningún estado de la 004 se produce', () => {
    const estados = new Set([true, false].flatMap(retirada => [ahora, futuro].flatMap(vigenteHasta => [1, 2].flatMap(versionTrabajoSolicitud =>
      [true, false].map(solicitudCerrada => estadoEfectivo({ ...base, retirada, vigenteHasta, versionTrabajoSolicitud, solicitudCerrada }))))));
    expect([...estados].sort()).toEqual(['PENDIENTE_REVISION', 'RETIRADA', 'VENCIDA', 'VIGENTE']);
  });
});
