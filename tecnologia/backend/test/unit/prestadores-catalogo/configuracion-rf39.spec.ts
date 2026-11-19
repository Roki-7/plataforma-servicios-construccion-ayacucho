import { describe, expect, test } from '@jest/globals';
import { generateKeyPairSync } from 'node:crypto';
import { cargarConfiguracionRf39, leerConfiguracionRf39 } from '../../../src/composicion/configuracion-rf39.js';

const par = generateKeyPairSync('ed25519');
const publica = par.publicKey.export({ type: 'spki', format: 'pem' }) as string;
const privada = par.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const base = { entorno: 'prueba-002', clavePublicaFirmante: publica,
  identidades: [{ principal: 'po', rol: 'FIRMANTE' }, { principal: 'op', rol: 'EJECUTOR' }] };
const texto = (cambios: object = {}) => JSON.stringify({ ...base, ...cambios });

describe('configuración protegida de RF39', () => {
  test('acepta una clave pública Ed25519, un firmante y al menos un ejecutor', () => {
    const c = cargarConfiguracionRf39(texto());
    expect(c.entorno).toBe('prueba-002');
    expect(c.identidades.map(i => i.rol)).toEqual(['FIRMANTE', 'EJECUTOR']);
  });
  test('rechaza una clave privada, una clave que no es Ed25519 y una clave inválida', () => {
    expect(() => cargarConfiguracionRf39(texto({ clavePublicaFirmante: privada }))).toThrow('únicamente la clave pública');
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' }) as string;
    expect(() => cargarConfiguracionRf39(texto({ clavePublicaFirmante: rsa }))).toThrow('Ed25519');
    expect(() => cargarConfiguracionRf39(texto({ clavePublicaFirmante: 'no es una clave' }))).toThrow('no es válida');
  });
  test('exige un único firmante, ejecutores y principales distintos', () => {
    const f = { principal: 'po', rol: 'FIRMANTE' }; const o = { principal: 'op', rol: 'EJECUTOR' };
    expect(() => cargarConfiguracionRf39(texto({ identidades: [o] }))).toThrow('único firmante');
    expect(() => cargarConfiguracionRf39(texto({ identidades: [f, { principal: 'otro', rol: 'FIRMANTE' }, o] }))).toThrow('único firmante');
    expect(() => cargarConfiguracionRf39(texto({ identidades: [f] }))).toThrow('ejecutor');
    expect(() => cargarConfiguracionRf39(texto({ identidades: [f, o, { principal: 'po', rol: 'EJECUTOR' }] }))).toThrow('dos veces');
    expect(() => cargarConfiguracionRf39(texto({ identidades: [f, { principal: 'op', rol: 'EJECUTOR', cuentaId: 'x' }] }))).toThrow('cuenta asociada');
  });
  test('rechaza JSON inválido, entorno vacío y una ruta no absoluta', async () => {
    expect(() => cargarConfiguracionRf39('{')).toThrow('JSON');
    expect(() => cargarConfiguracionRf39(texto({ entorno: ' ' }))).toThrow('entorno');
    await expect(leerConfiguracionRf39({})).rejects.toThrow('RF39_CONFIGURACION_PROTEGIDA');
    await expect(leerConfiguracionRf39({ RF39_CONFIGURACION_PROTEGIDA: 'relativa.json' })).rejects.toThrow('ruta absoluta');
  });
});
