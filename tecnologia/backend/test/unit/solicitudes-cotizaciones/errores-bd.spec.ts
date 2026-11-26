import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import { ConflictoReintentable } from '../../../src/compartido/aplicacion/reintento-concurrencia.js';
import { condicionDe, conTraduccionBd, traducirErrorBd } from '../../../src/compartido/infraestructura/postgres/traduccion-errores.js';
import * as erroresSolicitudes from '../../../src/modulos/solicitudes/dominio/errores.js';
import * as erroresCotizaciones from '../../../src/modulos/cotizaciones/dominio/errores.js';
import { restriccionesDeContadores, traducirCondicionSolicitudes } from '../../../src/modulos/solicitudes/dominio/errores.js';
import { restriccionesDeCotizaciones, traducirCondicionCotizaciones } from '../../../src/modulos/cotizaciones/dominio/errores.js';

// T025 · FR-346. Errores de contrato y traducción de condiciones de PostgreSQL. La traducción contra PostgreSQL real, con las restricciones
// de las migraciones, está en `traduccion-errores-bd.spec.ts` (integración).
const pg = (code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error('mensaje del servidor con datos internos'), { code, ...extra });
const envuelto = (code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error('QueryFailedError'), { driverError: pg(code, extra) });
const contrato = readFileSync('contracts/solicitudes-cotizaciones.openapi.json', 'utf8');

describe('errores de contrato', () => {
  const todas: [string, unknown][] = [...Object.entries(erroresSolicitudes), ...Object.entries(erroresCotizaciones)];
  const fabricas = todas.filter(([nombre, valor]) => typeof valor === 'function' && !nombre.startsWith('traducir')) as [string, (argumento?: string | string[]) => ErrorAplicacion][];
  test('cada fábrica produce un ErrorAplicacion cuyo código figura en el contrato de la 003 o en el catálogo de errores compartido', () => {
    const compartidos = new Set(['DEPENDENCIA_NO_DISPONIBLE', 'CONFLICTO_CONCURRENTE', 'RECURSO_NO_DISPONIBLE', 'VERSION_DESACTUALIZADA']);
    expect(fabricas.length).toBeGreaterThan(20);
    for (const [nombre, fabrica] of fabricas) {
      const e = fabrica.length === 0 ? fabrica() : fabrica(/Incompleta$/.test(nombre) ? ['campo'] : 'campo');
      expect(e).toBeInstanceOf(ErrorAplicacion);
      expect(e.codigo).toMatch(/^[A-Z_]+$/);
      expect(compartidos.has(e.codigo) || contrato.includes(e.codigo)).toBe(true);
    }
  });
  test('los estados HTTP siguen el contrato: 404, 409, 422 y 503', () => {
    expect(erroresSolicitudes.recursoNoDisponible().http).toBe(404);
    expect(erroresSolicitudes.versionDesactualizada().http).toBe(409);
    expect(erroresSolicitudes.solicitudNoAbierta().http).toBe(409);
    expect(erroresSolicitudes.limiteArchivos()).toMatchObject({ http: 422, codigo: 'LIMITE_ARCHIVOS' });
    expect(erroresSolicitudes.solicitudIncompleta(['descripcion']).detalles).toEqual([{ campo: 'descripcion', motivo: expect.any(String) }]);
    expect(erroresCotizaciones.cotizacionExistente()).toMatchObject({ http: 409, codigo: 'COTIZACION_EXISTENTE' });
    expect(erroresCotizaciones.limiteAclaraciones()).toMatchObject({ http: 422, codigo: 'LIMITE_ACLARACIONES' });
    expect(erroresCotizaciones.dependenciaNoDisponible()).toMatchObject({ http: 503, codigo: 'DEPENDENCIA_NO_DISPONIBLE' });
  });
  test('los mensajes no incluyen valores del cliente ni detalles internos', () => {
    for (const e of [erroresSolicitudes.datosPersonalesEnTexto('descripcion'), erroresSolicitudes.campoNoModificable('tipo'), erroresCotizaciones.cotizacionIncompleta(['precio'])]) {
      expect(JSON.stringify({ m: e.message, d: e.detalles })).not.toMatch(/SELECT|constraint|pg_|\d{9}/i);
    }
  });
});

describe('condicionDe', () => {
  test('lee SQLSTATE, restricción y tabla del error directo, de driverError y de cause', () => {
    const esperado = { sqlstate: '23505', restriccion: 'una_restriccion', tabla: 'una_tabla' };
    expect(condicionDe(pg('23505', { constraint: 'una_restriccion', table: 'una_tabla' }))).toEqual(esperado);
    expect(condicionDe(envuelto('23505', { constraint: 'una_restriccion', table: 'una_tabla' }))).toEqual(esperado);
    expect(condicionDe(Object.assign(new Error('x'), { cause: pg('23505', { constraint: 'una_restriccion', table: 'una_tabla' }) }))).toEqual(esperado);
  });
  test('sin restricción ni tabla solo devuelve el SQLSTATE, y lo que no es de PostgreSQL devuelve undefined', () => {
    expect(condicionDe(pg('55P03'))).toEqual({ sqlstate: '55P03' });
    for (const v of [new Error('x'), pg('ECONNRESET'), null, undefined, 'texto', 7]) expect(condicionDe(v)).toBeUndefined();
  });
  test('no copia el texto del servidor a la condición', () => {
    expect(JSON.stringify(condicionDe(pg('23514', { constraint: 'c', detail: 'Failing row contains (secreto)' })))).not.toContain('secreto');
  });
});

describe('Solicitudes: traducirCondicionSolicitudes', () => {
  test('23514 sobre cada contador de archivos → LIMITE_ARCHIVOS (422)', () => {
    for (const restriccion of restriccionesDeContadores) expect(traducirCondicionSolicitudes({ sqlstate: '23514', restriccion })).toMatchObject({ http: 422, codigo: 'LIMITE_ARCHIVOS' });
  });
  test('55P03 → CONFLICTO_CONCURRENTE (409)', () => {
    expect(traducirCondicionSolicitudes({ sqlstate: '55P03' })).toMatchObject({ http: 409, codigo: 'CONFLICTO_CONCURRENTE' });
  });
  test('un 23514 de otra restricción, un 23514 sin restricción y un 23505 NO se traducen', () => {
    for (const c of [{ sqlstate: '23514', restriccion: 'solicitudes_fechas_coherentes' }, { sqlstate: '23514' }, { sqlstate: '23505', restriccion: 'solicitudes_archivos_cantidad_rango' }, { sqlstate: '42P01' }]) {
      expect(traducirCondicionSolicitudes(c)).toBeUndefined();
    }
  });
});

describe('Cotizaciones: traducirCondicionCotizaciones', () => {
  test('23505 sobre el índice único de cotizaciones no retiradas → COTIZACION_EXISTENTE (409)', () => {
    expect(traducirCondicionCotizaciones({ sqlstate: '23505', restriccion: restriccionesDeCotizaciones.unicaNoRetirada })).toMatchObject({ http: 409, codigo: 'COTIZACION_EXISTENTE' });
  });
  test('23505 sobre el número de aclaración → CONFLICTO_CONCURRENTE; 23514 sobre su rango → LIMITE_ACLARACIONES; 55P03 → CONFLICTO_CONCURRENTE', () => {
    expect(traducirCondicionCotizaciones({ sqlstate: '23505', restriccion: restriccionesDeCotizaciones.numeroDeAclaracionUnico })).toMatchObject({ codigo: 'CONFLICTO_CONCURRENTE' });
    expect(traducirCondicionCotizaciones({ sqlstate: '23514', restriccion: restriccionesDeCotizaciones.numeroDeAclaracionRango })).toMatchObject({ http: 422, codigo: 'LIMITE_ACLARACIONES' });
    expect(traducirCondicionCotizaciones({ sqlstate: '55P03' })).toMatchObject({ http: 409, codigo: 'CONFLICTO_CONCURRENTE' });
  });
  test('una violación única de otra restricción no se disfraza de COTIZACION_EXISTENTE', () => {
    for (const c of [{ sqlstate: '23505', restriccion: 'cotizaciones_pkey' }, { sqlstate: '23505' }, { sqlstate: '23514', restriccion: 'cotizaciones_precio_positivo' }]) {
      expect(traducirCondicionCotizaciones(c)).toBeUndefined();
    }
  });
});

describe('traducirErrorBd y conTraduccionBd', () => {
  const traductor = traducirCondicionCotizaciones;
  test('un ErrorAplicacion ya traducido pasa con la misma identidad', () => {
    const e = new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', 'x');
    expect(traducirErrorBd(e, traductor)).toBe(e);
  });
  test('interbloqueo y fallo de serialización se vuelven conflictos reintentables, también envueltos', () => {
    expect(traducirErrorBd(pg('40P01'), traductor)).toBeInstanceOf(ConflictoReintentable);
    expect(traducirErrorBd(envuelto('40001'), traductor)).toBeInstanceOf(ConflictoReintentable);
  });
  test('una condición del módulo se traduce, también envuelta por TypeORM', () => {
    expect(traducirErrorBd(envuelto('23505', { constraint: restriccionesDeCotizaciones.unicaNoRetirada }), traductor)).toMatchObject({ codigo: 'COTIZACION_EXISTENTE' });
    expect(traducirErrorBd(pg('55P03'), traductor)).toMatchObject({ http: 409, codigo: 'CONFLICTO_CONCURRENTE' });
  });
  test('un fallo inesperado se devuelve sin cambios: no se oculta ni se reinterpreta', () => {
    const inesperados = [new TypeError('boom'), pg('42P01'), pg('23505', { constraint: 'otra' }), pg('23514', { constraint: 'otra' })];
    for (const e of inesperados) expect(traducirErrorBd(e, traductor)).toBe(e);
  });
  test('conTraduccionBd devuelve el resultado, o lanza el error traducido', async () => {
    expect(await conTraduccionBd(traductor, async () => 7)).toBe(7);
    await expect(conTraduccionBd(traductor, async () => { throw envuelto('23505', { constraint: restriccionesDeCotizaciones.unicaNoRetirada }); })).rejects.toMatchObject({ codigo: 'COTIZACION_EXISTENTE' });
    const inesperado = new RangeError('x');
    await expect(conTraduccionBd(traductor, async () => { throw inesperado; })).rejects.toBe(inesperado);
  });
});
