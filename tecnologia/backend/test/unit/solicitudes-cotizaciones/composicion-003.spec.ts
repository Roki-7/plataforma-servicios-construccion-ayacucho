import { describe, expect, test } from '@jest/globals';
import type { MigrationInterface } from 'typeorm';
import { persistencia002, persistencia003, ultimaMigracion001, ultimaMigracion002 } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { cargarConfiguracion003 } from '../../../src/composicion/configuracion-003.js';
import { cargarConfiguracion002 } from '../../../src/composicion/configuracion-002.js';

const URL_PRUEBA = 'postgresql://u:p@127.0.0.1:54331/ayacucho_003_validacion';
/** Crea una migración ficticia cuyo nombre termina en la fecha dada (el orden aditivo se deduce del sufijo de 13 dígitos). */
function migracion(fecha: number): new () => MigrationInterface {
  const nombre = `Prueba${fecha}`;
  return { [nombre]: class { async up(): Promise<void> {} async down(): Promise<void> {} } }[nombre] as unknown as new () => MigrationInterface;
}
const nombres = (db: { options: { migrations?: unknown } }) => (db.options.migrations as { name: string }[]).map(m => m.name);
const fechas = (db: { options: { migrations?: unknown } }) => nombres(db).map(n => Number(/\d{13}$/.exec(n)?.[0]));

describe('persistencia003: orden aditivo único y posterior a la 002', () => {
  test('las migraciones de la 003 van después de las de la 001 y la 002, en orden ascendente', () => {
    const db = persistencia003(URL_PRUEBA, persistenciaOferta002, [{ migraciones: [migracion(1796000000003), migracion(1796000000001), migracion(1796000000002)] }]);
    const orden = fechas(db);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
    expect(orden.slice(-3)).toEqual([1796000000001, 1796000000002, 1796000000003]);
    expect(orden.at(-4)).toBe(ultimaMigracion002);
  });

  test('sin migraciones de la 003 equivale a la persistencia de la 002', () => {
    expect(nombres(persistencia003(URL_PRUEBA, persistenciaOferta002, []))).toEqual(nombres(persistencia002(URL_PRUEBA, persistenciaOferta002)));
  });

  test.each([
    ['igual a la última de la 002', ultimaMigracion002],
    ['anterior a la última de la 002', 1795000000004],
    ['de la 001', ultimaMigracion001],
  ])('rechaza una migración de la 003 %s', (_nombre, fecha) => {
    expect(() => persistencia003(URL_PRUEBA, persistenciaOferta002, [{ migraciones: [migracion(fecha)] }])).toThrow('La migración 003 requiere un orden aditivo único y posterior');
  });

  test('rechaza una fecha repetida entre migraciones de la 003 o con una de la 002', () => {
    expect(() => persistencia003(URL_PRUEBA, persistenciaOferta002, [{ migraciones: [migracion(1796000000001), migracion(1796000000001)] }])).toThrow('orden aditivo único');
    expect(() => persistencia003(URL_PRUEBA, [{ migraciones: [migracion(1795000000010)] }], [{ migraciones: [migracion(1795000000010)] }])).toThrow('orden aditivo único');
  });

  test('rechaza un nombre sin sufijo de fecha', () => {
    class SinFecha implements MigrationInterface { async up(): Promise<void> {} async down(): Promise<void> {} }
    expect(() => persistencia003(URL_PRUEBA, persistenciaOferta002, [{ migraciones: [SinFecha] }])).toThrow('orden aditivo único');
  });

  test('el registro real de la 003 es único, posterior a la 002 y compatible con las migraciones de la 002', () => {
    const db = persistencia003(URL_PRUEBA, persistenciaOferta002, persistenciaOferta003);
    const orden = fechas(db);
    expect(new Set(orden).size).toBe(orden.length);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
    for (const registro of persistenciaOferta003) for (const m of registro.migraciones ?? []) expect(Number(/\d{13}$/.exec(m.name)?.[0])).toBeGreaterThan(ultimaMigracion002);
  });
});

describe('persistencia002: sin cambios de comportamiento', () => {
  test('rechaza fechas no posteriores a la 001 o repetidas, con el mensaje de siempre', () => {
    expect(() => persistencia002(URL_PRUEBA, [{ migraciones: [migracion(ultimaMigracion001)] }])).toThrow('La migración 002 requiere un orden aditivo único.');
    expect(() => persistencia002(URL_PRUEBA, [{ migraciones: [migracion(1795000000004), migracion(1795000000004)] }])).toThrow('La migración 002 requiere un orden aditivo único.');
  });
  test('con el registro real de la 002 conserva las nueve migraciones aditivas después de las ocho de la 001', () => {
    const db = persistencia002(URL_PRUEBA, persistenciaOferta002);
    expect(fechas(db)).toHaveLength(8 + 9);
    expect(fechas(db).at(-1)).toBe(ultimaMigracion002);
  });
});

describe('cargarConfiguracion003', () => {
  const env = { NODE_ENV: 'test', PUBLIC_ORIGIN: 'https://localhost:8447', PUBLIC_URL: 'https://localhost:8447', HMAC_KEY_ID: 'a', AEAD_KEY_ID: 'b',
    HMAC_KEYS_JSON: JSON.stringify({ a: Buffer.alloc(32, 1).toString('base64') }), AEAD_KEYS_JSON: JSON.stringify({ b: Buffer.alloc(32, 2).toString('base64') }),
    S3_ENDPOINT: 'http://127.0.0.1:3911', S3_REGION: 'garage', S3_BUCKET: 'x', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's', SMTP_HOST: '127.0.0.1', SMTP_FROM: 'a@example.invalid',
    CATALOGO_MANIFIESTO: 'x', VALIDATION_MODE: 'true' };
  const con = (url: string) => ({ ...env, DATABASE_URL: url });

  test.each([
    'postgresql://u:p@127.0.0.1:54331/ayacucho_003_validacion',
    'postgresql://u:p@127.0.0.1:54331/ayacucho_003_test_abc123',
    'postgresql://u:p@127.0.0.1:54330/ayacucho_002_validacion',
    'postgresql://u:p@127.0.0.1:54330/ayacucho_002_test_abc123',
    'postgresql://u:p@127.0.0.1:54341/ayacucho_002_restauracion_abc123',
  ])('acepta la base local %s', (url) => {
    expect(cargarConfiguracion003(con(url)).databaseUrl).toBe(url);
  });

  test.each([
    'postgresql://u:p@127.0.0.1:54329/ayacucho_001_validacion',
    'postgresql://u:p@127.0.0.1:54331/ayacucho_003_restauracion_abc',
    'postgresql://u:p@127.0.0.1:54331/ayacucho_003_test_',
    'postgresql://u:p@127.0.0.1:54331/ayacucho_003_test_ABC',
    'postgresql://u:p@127.0.0.1:54331/ayacucho_003_validacion_otra',
    'postgresql://u:p@127.0.0.1:54331/produccion',
    'postgresql://u:p@db.example.com:5432/ayacucho_003_validacion',
    'postgresql://u:p@localhost:54331/ayacucho_003_validacion',
    'mysql://u:p@127.0.0.1:3306/ayacucho_003_validacion',
    'no es una url',
  ])('rechaza %s', (url) => {
    expect(() => cargarConfiguracion003(con(url))).toThrow();
  });

  test('rechaza una base ausente en validación y no altera a la 002', () => {
    expect(() => cargarConfiguracion003({ ...env })).toThrow('base PostgreSQL local dedicada');
    expect(() => cargarConfiguracion002(con('postgresql://u:p@127.0.0.1:54331/ayacucho_003_validacion'))).toThrow();
  });

  test('fuera de validación delega por completo en el cargador existente', () => {
    const sinValidacion: Record<string, string> = { ...env };
    delete sinValidacion['VALIDATION_MODE'];
    expect(() => cargarConfiguracion003({ ...sinValidacion, DATABASE_URL: 'postgresql://u:p@db.example.com:5432/ayacucho', S3_ENDPOINT: 'http://insegura.example.com' })).toThrow('HTTPS');
  });
});
