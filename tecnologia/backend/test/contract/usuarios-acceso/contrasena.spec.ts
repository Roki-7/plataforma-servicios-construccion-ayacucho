import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { entornoPerfil } from '../../soporte/perfil.js';
import { origen } from '../../soporte/registro.js';
import { cuentaFicticia } from '../../soporte/fixtures.js';
import { validarRespuesta } from '../../soporte/contrato.js';
import { datosCambioContrasena, rutaContrasena } from '../../soporte/contrasena.js';

let e: Awaited<ReturnType<typeof entornoPerfil>>;
beforeAll(async () => { e = await entornoPerfil(); });
afterAll(async () => { await e?.cerrar(); });

test('CA-CLA-01 resultado contractual sin cookie ni secretos y sesión previa vigente', async () => {
  const c = await cuentaFicticia(e.db);
  const r = await e.post(rutaContrasena, datosCambioContrasena(c.contrasena), randomUUID(), c.acceso).expect(200);
  await validarRespuesta('OperacionResultado', r.body);
  expect(r.body.codigo).toBe('CONTRASENA_CAMBIADA');
  expect(r.headers['set-cookie']).toBeUndefined();
  expect(r.headers['cache-control']).toBe('no-store');
  await e.get(c.acceso).expect(200);
});
test('CA-CLA-02 actual incorrecta 422, versión obsoleta 409 y petición sin sesión 401', async () => {
  const c = await cuentaFicticia(e.db), datos = datosCambioContrasena(c.contrasena);
  const enviar = (d: object, token?: string) => e.post(rutaContrasena, d, randomUUID(), token);
  const invalida = await enviar({ ...datos, contrasenaActual: c.contrasena.trim() }, c.acceso).expect(422);
  expect(invalida.body.codigo).toBe('CONTRASENA_ACTUAL_INVALIDA');
  await validarRespuesta('Error', invalida.body);
  const version = await enviar({ ...datos, version: 2 }, c.acceso).expect(409);
  expect(version.body.codigo).toBe('VERSION_DESACTUALIZADA');
  await enviar(datos).expect(401);
  expect((await e.get(c.acceso).expect(200)).body.version).toBe(1);
});
test('CA-CLA-03 contrato rechaza común, comprometida, longitudes, Unicode y confirmación', async () => {
  const c = await cuentaFicticia(e.db), datos = datosCambioContrasena(c.contrasena);
  for (const valor of ['passwordpassword', 'comprometida ficticia 001']) {
    const r = await e.post(rutaContrasena, datosCambioContrasena(c.contrasena, valor), randomUUID(), c.acceso).expect(422);
    expect(r.body.codigo).toBe('CONTRASENA_NO_ADMITIDA');
  }
  for (const parcial of [{nuevaContrasena: '𠮷'.repeat(14)}, {nuevaContrasena: '𠮷'.repeat(129)}, {confirmacionContrasena: ' valor distinto válido '}, {contrasenaActual: '\ud800'}, {contrasenaActual: '𠮷'.repeat(129)}, {version: 0}]) {
    await e.post(rutaContrasena, { ...datos, ...parcial }, randomUUID(), c.acceso).expect(400);
  }
  await e.post('/sesiones', { correo: c.correo, contrasena: c.contrasena }).expect(200);
});
test('CA-CLA-04 PATCH rechaza contraseña; cambio específico exige origen, clave y allowlist', async () => {
  const c = await cuentaFicticia(e.db), datos = datosCambioContrasena(c.contrasena);
  const parche = await e.patch(c.acceso, {version: 1, nuevaContrasena: datos.nuevaContrasena}).expect(400);
  expect(parche.body.codigo).toBe('PROPIEDAD_NO_ADMITIDA');
  await e.post(rutaContrasena, { ...datos, cuentaId: randomUUID() }, randomUUID(), c.acceso).expect(400);
  const enviar = () => request(e.app.getHttpServer()).post('/api/v1' + rutaContrasena).set('Authorization', 'Bearer ' + c.acceso);
  await enviar().set('Origin', origen).send(datos).expect(400);
  await enviar().set('Origin', 'https://ajeno.example.invalid').set('Idempotency-Key', randomUUID()).send(datos).expect(403);
  await e.post('/sesiones', { correo: c.correo, contrasena: c.contrasena }).expect(200);
});
