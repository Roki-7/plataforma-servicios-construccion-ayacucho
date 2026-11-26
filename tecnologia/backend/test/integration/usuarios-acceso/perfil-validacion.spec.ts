import { beforeAll, afterAll, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { entornoPerfil } from '../../soporte/perfil.js';
import { registroValido } from '../../soporte/registro.js';
import { cuentaFicticia } from '../../soporte/fixtures.js';

/**
 * Enmienda controlada de 001 (T080): el servidor valida nombre, teléfono y distrito con PostgreSQL real, sin depender del navegador.
 * Un dato inválido responde 400 con el motivo por campo y NO guarda nada (ni versión, ni auditoría de cambio); los vacíos se guardan como NULL.
 * CA-PER-07 teléfono · CA-PER-08 vacíos a NULL · CA-PER-09 caracteres de control · CA-PER-10 distrito libre. FR-033.
 */
let e: Awaited<ReturnType<typeof entornoPerfil>>;
beforeAll(async () => { e = await entornoPerfil(); });
afterAll(async () => { await e?.cerrar(); });

const NUL = String.fromCharCode(0);
const fila = async (id: string) => (await e.db.query('SELECT nombre_mostrar, telefono, distrito, version FROM usuarios WHERE id=$1', [id]))[0];

test.each([
  ['abc123xyz', 'Use solo dígitos, espacios y los signos + - . ( ).'], ['+51 libre', 'Use solo dígitos, espacios y los signos + - . ( ).'], ['<script>1234567', 'Use solo dígitos, espacios y los signos + - . ( ).'],
  ['12345', 'Ingrese entre 6 y 15 dígitos.'], ['1234567890123456', 'Ingrese entre 6 y 15 dígitos.'],
])('CA-PER-07 el teléfono %j se rechaza con 400, el motivo en el campo y sin guardar nada', async (telefono, motivo) => {
  const c = await cuentaFicticia(e.db);
  const antes = await fila(c.id);
  const r = await e.patch(c.acceso, { version: 1, nombreMostrar: 'Nombre que no debe guardarse', telefono });
  expect(r.status).toBe(400);
  expect(r.body.codigo).toBe('DATOS_INVALIDOS');
  expect(r.body.detalles).toEqual([{ campo: 'telefono', motivo }]);
  expect(await fila(c.id)).toEqual(antes);
  expect((await e.get(c.acceso)).body).toMatchObject({ nombreMostrar: antes.nombre_mostrar, version: 1 });
});

test('CA-PER-07 más de 32 caracteres: el contrato (maxLength) lo rechaza con 400 antes de llegar al caso de uso y no guarda nada', async () => {
  const c = await cuentaFicticia(e.db);
  const antes = await fila(c.id);
  const r = await e.patch(c.acceso, { version: 1, telefono: '123456'.padEnd(33) });
  expect(r.status).toBe(400);
  expect(r.body.codigo).toBe('DATOS_INVALIDOS');
  expect(await fila(c.id)).toEqual(antes);
  await e.patch(c.acceso, { version: 1, telefono: '123456'.padEnd(32) }).expect(200);
});

test('CA-PER-07 un teléfono válido con formato internacional se guarda tal como se envió y se lee igual', async () => {
  const c = await cuentaFicticia(e.db);
  const r = await e.patch(c.acceso, { version: 1, telefono: '+51 (984) 123-456' }).expect(200);
  expect(r.body).toMatchObject({ telefono: '+51 (984) 123-456', version: 2 });
  expect((await fila(c.id)).telefono).toBe('+51 (984) 123-456');
});

test('CA-PER-07 registro: un teléfono con letras se rechaza con 400 y no crea la cuenta', async () => {
  const cuerpo = { ...registroValido(), telefono: 'abc123456' };
  const r = await e.post('/cuentas', cuerpo);
  expect(r.status).toBe(400);
  expect(r.body.detalles).toEqual([{ campo: 'telefono', motivo: 'Use solo dígitos, espacios y los signos + - . ( ).' }]);
  expect(await e.db.query('SELECT 1 FROM usuarios WHERE correo=$1', [cuerpo.correo])).toHaveLength(0);
});

test('CA-PER-08 teléfono y distrito vacíos o de solo espacios se guardan como NULL en PostgreSQL y siguen siendo opcionales', async () => {
  const c = await cuentaFicticia(e.db);
  await e.patch(c.acceso, { version: 1, telefono: '984 123 456', distrito: 'Huamanga' }).expect(200);
  expect(await fila(c.id)).toMatchObject({ telefono: '984 123 456', distrito: 'Huamanga', version: '2' });
  const r = await e.patch(c.acceso, { version: 2, telefono: '   ', distrito: '' }).expect(200);
  expect(r.body).toMatchObject({ telefono: null, distrito: null, telefonoCompartible: false, version: 3 });
  expect(await e.db.query('SELECT telefono IS NULL AS t, distrito IS NULL AS d FROM usuarios WHERE id=$1', [c.id])).toEqual([{ t: true, d: true }]);
  expect((await e.get(c.acceso)).body).toMatchObject({ telefono: null, distrito: null });
  // No enviar los campos no los modifica; enviar vacío cuando ya es NULL no cambia nada ni sube la versión.
  await e.patch(c.acceso, { version: 3, nombreMostrar: 'Solo nombre' }).expect(200);
  const igual = await e.patch(c.acceso, { version: 4, telefono: '  ', distrito: '   ' }).expect(200);
  expect(igual.body.version).toBe(4);
});

test('CA-PER-08 registro: teléfono y distrito vacíos o de solo espacios crean la cuenta con NULL', async () => {
  for (const vacio of ['', '    ']) {
    const cuerpo = { ...registroValido(), telefono: vacio, distrito: vacio };
    const r = await e.post('/cuentas', cuerpo).expect(201);
    expect(await e.db.query('SELECT telefono IS NULL AS t, distrito IS NULL AS d FROM usuarios WHERE id=$1', [r.body.cuentaId])).toEqual([{ t: true, d: true }]);
  }
});

test('CA-PER-08 la repetición exacta con la misma clave devuelve el resultado guardado aunque el cuerpo se haya normalizado', async () => {
  const c = await cuentaFicticia(e.db); const clave = randomUUID();
  const primero = await e.patch(c.acceso, { version: 1, telefono: '  ', distrito: 'Wanchaq' }, clave).expect(200);
  const segundo = await e.patch(c.acceso, { version: 1, telefono: '  ', distrito: 'Wanchaq' }, clave).expect(200);
  expect(segundo.body).toEqual(primero.body);
});

test.each([
  ['nombreMostrar', 'Ana\nPérez'], ['nombreMostrar', `Ana${NUL}`], ['nombreMostrar', 'Ana\tPérez'], ['nombreMostrar', 'Ana Pérez'],
  ['telefono', '984\n123456'], ['telefono', `984${NUL}123456`], ['telefono', '984\t123456'],
  ['distrito', 'Ayacucho\r\nPeru'], ['distrito', `Ayacucho${NUL}`], ['distrito', 'Ayacucho\u007f'], ['distrito', 'Ayacucho\u0085'],
] as const)('CA-PER-09 %s con carácter de control %j: 400, motivo en el campo y sin guardar nada', async (campo, valor) => {
  const c = await cuentaFicticia(e.db);
  const antes = await fila(c.id);
  const r = await e.patch(c.acceso, { version: 1, [campo]: valor });
  expect(r.status).toBe(400);
  expect(r.body.codigo).toBe('DATOS_INVALIDOS');
  expect(r.body.detalles).toEqual([{ campo, motivo: expect.stringContaining('caracteres de control') }]);
  expect(await fila(c.id)).toEqual(antes);
});

test('CA-PER-09 registro: un nombre con salto de línea o NUL se rechaza y no crea la cuenta; los nombres de personas y empresas con tildes y signos se admiten', async () => {
  for (const nombreMostrar of ['Ana\nPérez', `Ana${NUL}`]) {
    const cuerpo = { ...registroValido(), nombreMostrar };
    await e.post('/cuentas', cuerpo).expect(400);
    expect(await e.db.query('SELECT 1 FROM usuarios WHERE correo=$1', [cuerpo.correo])).toHaveLength(0);
  }
  for (const nombreMostrar of ['María Ñañez-Quispe', "Constructora O'Brien & Hijos S.A.C.", 'Ferretería "Los Andes" (2024)']) {
    const r = await e.post('/cuentas', { ...registroValido(), nombreMostrar }).expect(201);
    expect((await e.db.query('SELECT nombre_mostrar FROM usuarios WHERE id=$1', [r.body.cuentaId]))[0].nombre_mostrar).toBe(nombreMostrar);
  }
});

test('CA-PER-10 el distrito es texto libre: se guarda cualquier valor de hasta 100 caracteres y 101 se rechaza', async () => {
  const c = await cuentaFicticia(e.db);
  let version = 1;
  for (const distrito of ['Huamanga', 'Distrito que no existe 123 !@#', 'Ñuñoa', '𠮷'.repeat(100)]) {
    const r = await e.patch(c.acceso, { version, distrito }).expect(200);
    expect(r.body.distrito).toBe(distrito); version = r.body.version;
    expect((await fila(c.id)).distrito).toBe(distrito);
  }
  const antes = await fila(c.id);
  const r = await e.patch(c.acceso, { version, distrito: 'a'.repeat(101) });
  expect(r.status).toBe(400);
  expect(r.body.codigo).toBe('DATOS_INVALIDOS');
  expect(await fila(c.id)).toEqual(antes);
});

test('CA-PER-03 CA-PER-07 un campo inválido entre varios válidos no guarda ninguno (sin cambios parciales)', async () => {
  const c = await cuentaFicticia(e.db);
  const antes = await fila(c.id);
  const r = await e.patch(c.acceso, { version: 1, nombreMostrar: 'Nombre válido', telefono: 'sin números', distrito: 'Distrito válido' });
  expect(r.status).toBe(400);
  expect(r.body.detalles).toEqual([{ campo: 'telefono', motivo: 'Use solo dígitos, espacios y los signos + - . ( ).' }]);
  expect(await fila(c.id)).toEqual(antes);
});
