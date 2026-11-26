import { beforeAll, afterAll, expect, test } from '@jest/globals';
import { entornoPerfil } from '../../soporte/perfil.js';
import { registroValido } from '../../soporte/registro.js';
import { cuentaFicticia } from '../../soporte/fixtures.js';
import { cargarContrato, validarRespuesta } from '../../soporte/contrato.js';

/**
 * Contrato de la enmienda controlada de 001 (T080) sobre PATCH /perfil y POST /cuentas:
 * una entrada inválida responde 400 `DATOS_INVALIDOS` con el cuerpo `Error` del contrato (motivo por campo en `detalles`, sin reflejar el valor enviado),
 * una entrada válida o normalizable responde con `Perfil`, y las reglas quedan documentadas en el esquema. CA-PER-07 a CA-PER-10, FR-033.
 */
let e: Awaited<ReturnType<typeof entornoPerfil>>;
beforeAll(async () => { e = await entornoPerfil(); });
afterAll(async () => { await e?.cerrar(); });

type Esquema = { properties: Record<string, { type: unknown; description?: string; maxLength?: number; minLength?: number }> };
const esquemas = async () => (await cargarContrato() as unknown as { components: { schemas: Record<string, Esquema> } }).components.schemas;

test('CA-PER-07 CA-PER-09 CA-PER-10 el esquema documenta las reglas y conserva los límites de 200, 32 y 100 caracteres', async () => {
  const s = await esquemas();
  for (const nombre of ['Registro', 'ActualizarPerfil']) {
    const p = s[nombre]!.properties;
    expect([p['nombreMostrar']!.minLength, p['nombreMostrar']!.maxLength, p['telefono']!.maxLength, p['distrito']!.maxLength]).toEqual([1, 200, 32, 100]);
    expect(p['telefono']!.type).toEqual(['string', 'null']); expect(p['distrito']!.type).toEqual(['string', 'null']);
    expect(p['telefono']!.description).toMatch(/entre 6 y 15 d.gitos/); expect(p['telefono']!.description).toMatch(/sin formato nacional/); expect(p['telefono']!.description).toMatch(/null/);
    expect(p['nombreMostrar']!.description).toMatch(/caracteres de control/); expect(p['distrito']!.description).toMatch(/caracteres de control/);
  }
});

test.each([
  ['telefono', 'abc123456'], ['telefono', '12345'], ['telefono', '984\n123456'], ['nombreMostrar', 'Ana\nPérez'], ['distrito', 'Ayacucho\t'],
] as const)('CA-PER-07 CA-PER-09 PATCH /perfil con %s=%j responde 400 con el cuerpo Error del contrato, el motivo por campo y sin reflejar el valor', async (campo, valor) => {
  const c = await cuentaFicticia(e.db);
  const r = await e.patch(c.acceso, { version: 1, [campo]: valor });
  expect(r.status).toBe(400);
  await validarRespuesta('Error', r.body);
  expect(r.body.codigo).toBe('DATOS_INVALIDOS');
  expect(r.body.detalles).toEqual([{ campo, motivo: expect.any(String) }]);
  expect(JSON.stringify(r.body)).not.toContain(valor.trim());
  expect(r.headers['cache-control']).toBe('no-store');
});

test('CA-PER-08 CA-PER-10 PATCH /perfil con vacíos o solo espacios responde 200 con Perfil y null; distrito libre se conserva', async () => {
  const c = await cuentaFicticia(e.db);
  const a = await e.patch(c.acceso, { version: 1, telefono: '984 123 456', distrito: 'Cualquier distrito 123' }).expect(200);
  await validarRespuesta('Perfil', a.body);
  expect(a.body).toMatchObject({ telefono: '984 123 456', distrito: 'Cualquier distrito 123' });
  const b = await e.patch(c.acceso, { version: a.body.version, telefono: '   ', distrito: '' }).expect(200);
  await validarRespuesta('Perfil', b.body);
  expect(b.body).toMatchObject({ telefono: null, distrito: null, telefonoCompartible: false });
});

test('CA-PER-07 CA-PER-08 CA-PER-09 POST /cuentas aplica las mismas reglas: inválidos 400 Error; vacíos crean la cuenta con null', async () => {
  const invalido = await e.post('/cuentas', { ...registroValido(), telefono: 'sin números' });
  expect(invalido.status).toBe(400); await validarRespuesta('Error', invalido.body);
  expect(invalido.body.detalles).toEqual([{ campo: 'telefono', motivo: expect.any(String) }]);
  const control = await e.post('/cuentas', { ...registroValido(), nombreMostrar: 'Ana Pérez' });
  expect(control.status).toBe(400); expect(control.body.codigo).toBe('DATOS_INVALIDOS');
  const vacio = await e.post('/cuentas', { ...registroValido(), telefono: '  ', distrito: '' }).expect(201);
  await validarRespuesta('RegistroResultado', vacio.body);
});
