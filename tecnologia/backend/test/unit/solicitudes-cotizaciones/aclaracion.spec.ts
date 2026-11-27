import { describe, expect, test } from '@jest/globals';
import {
  autorDelHilo, exigirHiloAbierto, LIMITE_DE_TEXTO, LIMITE_POR_HILO, normalizarTextoDeAclaracion, numeroDelSiguienteMensaje,
} from '../../../src/modulos/cotizaciones/dominio/aclaracion.js';

// T083 · reglas del hilo de aclaraciones (FR-342, CA-ACL-02 a 04): 1 000 caracteres, 20 por hilo, sin adjuntos, participantes y solo lectura.
describe('texto del mensaje', () => {
  test('se recorta y admite de 1 a 1 000 caracteres', () => {
    expect(normalizarTextoDeAclaracion('  Hola  ')).toBe('Hola');
    expect(normalizarTextoDeAclaracion('x'.repeat(LIMITE_DE_TEXTO))).toHaveLength(1000);
  });
  test('un texto vacío, en blanco o de más de 1 000 caracteres es 400 DATOS_INVALIDOS y no reproduce el contenido', () => {
    for (const malo of ['', '   \n\t ', 'y'.repeat(LIMITE_DE_TEXTO + 1)]) expect(() => normalizarTextoDeAclaracion(malo)).toThrow(expect.objectContaining({ http: 400, codigo: 'DATOS_INVALIDOS' }));
    try { normalizarTextoDeAclaracion('secreto'.repeat(200)); } catch (e) { expect(JSON.stringify(e)).not.toContain('secreto'); }
  });
});

describe('numeración y límite por hilo', () => {
  test('los mensajes se numeran de forma consecutiva desde 1 y el 21.º se rechaza con 422 LIMITE_ACLARACIONES', () => {
    expect(numeroDelSiguienteMensaje(0)).toBe(1);
    expect(numeroDelSiguienteMensaje(LIMITE_POR_HILO - 1)).toBe(20);
    expect(() => numeroDelSiguienteMensaje(LIMITE_POR_HILO)).toThrow(expect.objectContaining({ http: 422, codigo: 'LIMITE_ACLARACIONES' }));
  });
});

describe('hilo de solo lectura y participantes', () => {
  test('con la cotización retirada o la solicitud cerrada el hilo no admite mensajes (409)', () => {
    expect(() => exigirHiloAbierto({ cotizacionRetirada: false, solicitudAbierta: true })).not.toThrow();
    expect(() => exigirHiloAbierto({ cotizacionRetirada: true, solicitudAbierta: true })).toThrow(expect.objectContaining({ http: 409, codigo: 'COTIZACION_RETIRADA' }));
    expect(() => exigirHiloAbierto({ cotizacionRetirada: false, solicitudAbierta: false })).toThrow(expect.objectContaining({ http: 409, codigo: 'SOLICITUD_NO_ABIERTA' }));
  });
  test('solo participan el cliente dueño y el prestador autor; cualquier otro, nadie', () => {
    expect(autorDelHilo({ esDuenoDeLaSolicitud: true, esAutorDeLaCotizacion: false })).toBe('CLIENTE');
    expect(autorDelHilo({ esDuenoDeLaSolicitud: false, esAutorDeLaCotizacion: true })).toBe('PRESTADOR');
    expect(autorDelHilo({ esDuenoDeLaSolicitud: false, esAutorDeLaCotizacion: false })).toBeNull();
  });
});
