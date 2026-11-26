import { describe, expect, test } from '@jest/globals';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import {
  codigoPostgres, conReintentoDeConcurrencia, ConflictoReintentable, esReintentable, traducirConflictoReintentable,
} from '../../../src/compartido/aplicacion/reintento-concurrencia.js';

// FR-346 y CA-ERR-02. Los errores de PostgreSQL se simulan con la forma que exponen `pg` y TypeORM; no se necesita base de datos.
const pg = (code: string) => Object.assign(new Error(`fallo ${code}`), { code });
const typeorm = (code: string) => Object.assign(new Error('QueryFailedError'), { driverError: pg(code) });
const sinEspera = { dormir: async () => undefined };

describe('codigoPostgres y esReintentable', () => {
  test('reconoce el código directo, el de driverError y el de cause', () => {
    expect(codigoPostgres(pg('40P01'))).toBe('40P01');
    expect(codigoPostgres(typeorm('40001'))).toBe('40001');
    expect(codigoPostgres(Object.assign(new Error('x'), { cause: pg('23505') }))).toBe('23505');
  });
  test('ignora códigos que no son SQLSTATE y valores que no son errores', () => {
    for (const valor of [new Error('x'), pg('ECONNRESET'), null, undefined, 'texto', 42, { code: 40001 }]) expect(codigoPostgres(valor)).toBeUndefined();
  });
  test('solo 40P01 y 40001 son reintentables', () => {
    expect([pg('40P01'), typeorm('40001'), new ConflictoReintentable()].every(esReintentable)).toBe(true);
    for (const e of [pg('23505'), pg('55P03'), pg('23514'), new Error('x'), new ErrorAplicacion(409, 'CONFLICTO_CONCURRENTE', 'x')]) expect(esReintentable(e)).toBe(false);
  });
});

describe('traducirConflictoReintentable', () => {
  test('convierte interbloqueo y serialización y deja intacto cualquier otro error', () => {
    expect(traducirConflictoReintentable(pg('40P01'))).toBeInstanceOf(ConflictoReintentable);
    expect(traducirConflictoReintentable(typeorm('40001'))).toBeInstanceOf(ConflictoReintentable);
    const otro = pg('23505');
    expect(traducirConflictoReintentable(otro)).toBe(otro);
    const inesperado = new TypeError('boom');
    expect(traducirConflictoReintentable(inesperado)).toBe(inesperado);
  });
});

describe('conReintentoDeConcurrencia', () => {
  test('sin conflicto ejecuta el trabajo una sola vez y devuelve su resultado', async () => {
    let llamadas = 0;
    expect(await conReintentoDeConcurrencia(async () => { llamadas += 1; return 'listo'; }, sinEspera)).toBe('listo');
    expect(llamadas).toBe(1);
  });

  test('un interbloqueo se reintenta y el trabajo se completa en el segundo intento', async () => {
    const intentos: number[] = [];
    const r = await conReintentoDeConcurrencia(async (intento) => { intentos.push(intento); if (intento === 0) throw pg('40P01'); return 'ok'; }, sinEspera);
    expect(r).toBe('ok');
    expect(intentos).toEqual([0, 1]);
  });

  test('admite hasta dos reintentos: el tercer intento todavía puede completarse', async () => {
    let llamadas = 0;
    const r = await conReintentoDeConcurrencia(async () => { llamadas += 1; if (llamadas < 3) throw typeorm('40001'); return 'ok'; }, sinEspera);
    expect(r).toBe('ok');
    expect(llamadas).toBe(3);
  });

  test('si el conflicto persiste tras los reintentos responde 409 CONFLICTO_CONCURRENTE y no intenta más', async () => {
    let llamadas = 0;
    const error = await conReintentoDeConcurrencia(async () => { llamadas += 1; throw pg('40P01'); }, sinEspera).catch((e: unknown) => e);
    expect(llamadas).toBe(3);
    expect(error).toBeInstanceOf(ErrorAplicacion);
    expect(error).toMatchObject({ http: 409, codigo: 'CONFLICTO_CONCURRENTE' });
    expect(String((error as Error).message)).not.toMatch(/40P01|deadlock|fallo/i);
  });

  test('un conflicto reintentable ya traducido también se reintenta', async () => {
    let llamadas = 0;
    await expect(conReintentoDeConcurrencia(async () => { llamadas += 1; throw new ConflictoReintentable(); }, sinEspera)).rejects.toMatchObject({ codigo: 'CONFLICTO_CONCURRENTE' });
    expect(llamadas).toBe(3);
  });

  test('un error inesperado no se reintenta, no se oculta y conserva su identidad', async () => {
    const inesperado = new TypeError('fallo de infraestructura');
    let llamadas = 0;
    await expect(conReintentoDeConcurrencia(async () => { llamadas += 1; throw inesperado; }, sinEspera)).rejects.toBe(inesperado);
    expect(llamadas).toBe(1);
  });

  test('un error esperado de la aplicación y otros errores de PostgreSQL pasan sin reintento', async () => {
    for (const error of [new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', 'x'), pg('23505'), pg('55P03'), pg('23514')]) {
      let llamadas = 0;
      await expect(conReintentoDeConcurrencia(async () => { llamadas += 1; throw error; }, sinEspera)).rejects.toBe(error);
      expect(llamadas).toBe(1);
    }
  });

  test('si tras un conflicto aparece un error inesperado, ese error es el que se informa', async () => {
    const inesperado = new RangeError('otro');
    let llamadas = 0;
    await expect(conReintentoDeConcurrencia(async () => { llamadas += 1; if (llamadas === 1) throw pg('40P01'); throw inesperado; }, sinEspera)).rejects.toBe(inesperado);
    expect(llamadas).toBe(2);
  });

  test('espera entre intentos: breve y aleatoria por omisión, y configurable', async () => {
    const esperas: number[] = [];
    await conReintentoDeConcurrencia(async () => { throw pg('40P01'); }, { dormir: async (ms) => { esperas.push(ms); } }).catch(() => undefined);
    expect(esperas).toHaveLength(2);
    for (const ms of esperas) { expect(ms).toBeGreaterThanOrEqual(10); expect(ms).toBeLessThan(50); }
    const fijas: number[] = [];
    await conReintentoDeConcurrencia(async () => { throw pg('40001'); }, { reintentos: 1, esperaMs: (n) => n * 7, dormir: async (ms) => { fijas.push(ms); } }).catch(() => undefined);
    expect(fijas).toEqual([7]);
  });

  test('sin reintentos configurados falla en el primer conflicto', async () => {
    let llamadas = 0;
    await expect(conReintentoDeConcurrencia(async () => { llamadas += 1; throw pg('40P01'); }, { reintentos: 0, ...sinEspera })).rejects.toMatchObject({ codigo: 'CONFLICTO_CONCURRENTE' });
    expect(llamadas).toBe(1);
  });
});
