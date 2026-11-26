import { describe, expect, test } from '@jest/globals';
import { normalizarEdicionPerfil, validarEdicionPerfil } from '../../../src/modulos/usuarios-acceso/dominio/consentimiento-telefono.js';
import { normalizarRegistro, validarCuentaNueva } from '../../../src/modulos/usuarios-acceso/dominio/cuenta.js';

/**
 * Enmienda controlada de 001 (T080, revisión manual): validación de nombre, teléfono y distrito de cuenta, en el servidor y sin depender del navegador.
 * CA-PER-07 teléfono · CA-PER-08 vacíos a null · CA-PER-09 caracteres de control · CA-PER-10 distrito libre. FR-033.
 */
const NUL = String.fromCharCode(0);
const registro = () => ({ nombreMostrar: 'Constructora de prueba', correo: 'persona@example.invalid', contrasena: ' valor completo sin mezclar ', confirmacionContrasena: ' valor completo sin mezclar ', perfiles: ['cliente'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: '001-v1' });
const detalle = (accion: () => void) => { try { accion(); } catch (e) { return (e as { codigo: string; detalles: { campo: string; motivo: string }[] }); } return undefined; };

describe('CA-PER-07 teléfono: caracteres permitidos, 6 a 15 dígitos y hasta 32 caracteres, sin formato nacional', () => {
  test.each(['984123456', '+51 984 123 456', '(01) 234-5678', '+51-984.123.456', '123456', '123456789012345', '123456789012345'.padEnd(32), ' 984 123 456 '])('acepta %j', (telefono) => {
    expect(() => validarEdicionPerfil({ version: 1, telefono })).not.toThrow();
    expect(() => validarCuentaNueva({ ...registro(), telefono })).not.toThrow();
  });
  test.each(['abc123xyz', '984-ABC-1234', '+51 libre', '12345a', '984#123456', '984_123456', '984/123456', '<script>1234567', '984 123 456 ext', '٩٨٤١٢٣٤٥٦', '１２３４５６'])('rechaza %j por caracteres no permitidos, con el motivo en el campo telefono', (telefono) => {
    const e = detalle(() => validarEdicionPerfil({ version: 1, telefono }));
    expect(e?.codigo).toBe('DATOS_INVALIDOS');
    expect(e?.detalles).toEqual([{ campo: 'telefono', motivo: 'Use solo dígitos, espacios y los signos + - . ( ).' }]);
    expect(() => validarCuentaNueva({ ...registro(), telefono })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
  });
  test.each(['1', '12345', '+51 (1) 2 3', '1234567890123456', '+51 984 123 456 789 012'])('rechaza %j por cantidad de dígitos', (telefono) => {
    expect(detalle(() => validarEdicionPerfil({ version: 1, telefono }))?.detalles).toEqual([{ campo: 'telefono', motivo: 'Ingrese entre 6 y 15 dígitos.' }]);
  });
  test('rechaza más de 32 caracteres en total aunque tenga pocos dígitos', () => {
    expect(detalle(() => validarEdicionPerfil({ version: 1, telefono: '123456'.padEnd(33) }))?.detalles).toEqual([{ campo: 'telefono', motivo: 'Use hasta 32 caracteres.' }]);
  });
  test('informa todos los campos inválidos a la vez, uno por campo', () => {
    const e = detalle(() => validarEdicionPerfil({ version: 1, nombreMostrar: ' ', telefono: 'abc', distrito: 'a'.repeat(101) }));
    expect(e?.detalles.map((d) => d.campo)).toEqual(['nombreMostrar', 'telefono', 'distrito']);
  });
});

describe('CA-PER-08 teléfono y distrito vacíos o de solo espacios se normalizan a null y siguen siendo opcionales', () => {
  test('la validación admite vacío, solo espacios y null', () => {
    for (const valor of ['', '   ', null]) expect(() => validarEdicionPerfil({ version: 1, telefono: valor, distrito: valor })).not.toThrow();
    expect(() => validarEdicionPerfil({ version: 1 })).not.toThrow();
    expect(() => validarCuentaNueva({ ...registro(), telefono: '  ', distrito: '' })).not.toThrow();
  });
  test('la normalización convierte a null, conserva lo no enviado y no altera los valores con contenido', () => {
    expect(normalizarEdicionPerfil({ version: 1, telefono: '   ', distrito: '' })).toEqual({ version: 1, telefono: null, distrito: null });
    expect(normalizarEdicionPerfil({ version: 1, nombreMostrar: 'Ana' })).toEqual({ version: 1, nombreMostrar: 'Ana' });
    expect(normalizarEdicionPerfil({ version: 1, telefono: null })).toEqual({ version: 1, telefono: null });
    expect(normalizarEdicionPerfil({ version: 1, telefono: ' 984 123 456 ', distrito: ' Huamanga ' })).toEqual({ version: 1, telefono: ' 984 123 456 ', distrito: ' Huamanga ' });
    expect(normalizarRegistro({ ...registro(), telefono: ' ', distrito: '  ' } as never)).toMatchObject({ telefono: null, distrito: null });
    expect(normalizarRegistro(registro() as never)).not.toHaveProperty('telefono');
  });
  test('el nombre vacío o de solo espacios sigue rechazándose: es obligatorio', () => {
    for (const nombreMostrar of ['', '   ', ' ']) expect(detalle(() => validarEdicionPerfil({ version: 1, nombreMostrar }))?.detalles).toEqual([{ campo: 'nombreMostrar', motivo: 'Ingrese su nombre para mostrar.' }]);
  });
});

describe('CA-PER-09 caracteres de control en nombre, teléfono y distrito', () => {
  const controles = [NUL, '\n', '\r', '\t', '\u001f', '\u007f', '\u0085', '\u009f', ' ', ' '];
  test.each(controles)('rechaza el carácter de control U+%#x en cada campo, con el motivo del campo', (c) => {
    for (const campo of ['nombreMostrar', 'telefono', 'distrito'] as const) {
      const valor = campo === 'telefono' ? `984${c}123456` : `Valor${c}prueba`;
      const e = detalle(() => validarEdicionPerfil({ version: 1, [campo]: valor }));
      expect(e?.codigo).toBe('DATOS_INVALIDOS');
      expect(e?.detalles).toEqual([{ campo, motivo: expect.stringContaining('no puede incluir saltos de línea, tabuladores ni otros caracteres de control') }]);
      expect(() => validarCuentaNueva({ ...registro(), [campo]: valor })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
    }
  });
  test('un valor con solo caracteres de control (por ejemplo, un salto de línea) se rechaza: no equivale a vacío', () => {
    expect(detalle(() => validarEdicionPerfil({ version: 1, telefono: '\n' }))?.detalles?.[0]?.campo).toBe('telefono');
    expect(detalle(() => validarEdicionPerfil({ version: 1, distrito: '\t ' }))?.detalles?.[0]?.campo).toBe('distrito');
  });
  test.each(['María Ñañez-Quispe', "Constructora O'Brien & Hijos S.A.C.", 'Ferretería "Los Andes" (2024)', 'Ingeniería Civil — Ayacucho', '𠮷野家 建設', 'Ana López, Arq.', 'ÁÉÍÓÚ üñ'])('sigue admitiendo el nombre de persona o empresa %j', (nombreMostrar) => {
    expect(() => validarEdicionPerfil({ version: 1, nombreMostrar })).not.toThrow();
    expect(() => validarCuentaNueva({ ...registro(), nombreMostrar })).not.toThrow();
  });
  test('el límite de 200 puntos de código del nombre se conserva (inclusivo) y no se recorta', () => {
    expect(() => validarEdicionPerfil({ version: 1, nombreMostrar: '𠮷'.repeat(200) })).not.toThrow();
    expect(detalle(() => validarEdicionPerfil({ version: 1, nombreMostrar: '𠮷'.repeat(201) }))?.detalles).toEqual([{ campo: 'nombreMostrar', motivo: 'Use hasta 200 caracteres.' }]);
  });
});

describe('CA-PER-10 distrito de cuenta: texto libre de hasta 100 caracteres, sin lista cerrada', () => {
  test.each(['Huamanga', 'San Juan Bautista', 'Distrito que no existe 123 !@#$%', 'Ñuñoa', 'a', '𠮷'.repeat(100)])('acepta %j', (distrito) => {
    expect(() => validarEdicionPerfil({ version: 1, distrito })).not.toThrow();
    expect(() => validarCuentaNueva({ ...registro(), distrito })).not.toThrow();
  });
  test('rechaza más de 100 caracteres, sin recortarlo', () => {
    expect(detalle(() => validarEdicionPerfil({ version: 1, distrito: 'a'.repeat(101) }))?.detalles).toEqual([{ campo: 'distrito', motivo: 'Use hasta 100 caracteres.' }]);
  });
});

describe('reglas no modificadas por la enmienda', () => {
  test('foto, versión y campos no editables se validan como antes', () => {
    for (const mal of [{ fotografiaId: 'no-es-uuid' }, { version: 0 }, { autorizarCompartirTelefono: 'si' }]) expect(() => validarEdicionPerfil({ version: 1, ...mal })).toThrow();
    for (const extra of [{ correo: 'otro@example.invalid' }, { contrasena: 'x'.repeat(20) }, { cuentaId: 'ajena' }]) expect(() => validarEdicionPerfil({ version: 1, ...extra })).toThrow(expect.objectContaining({ codigo: 'PROPIEDAD_NO_ADMITIDA' }));
    expect(() => validarEdicionPerfil({ version: 1, fotografiaId: '00000000-0000-4000-8000-000000000001' })).not.toThrow();
  });
  test('el carácter NUL en el correo del registro también se rechaza', () => {
    expect(() => validarCuentaNueva({ ...registro(), correo: `a${NUL}b@example.invalid` })).toThrow(expect.objectContaining({ codigo: 'DATOS_INVALIDOS' }));
  });
});
