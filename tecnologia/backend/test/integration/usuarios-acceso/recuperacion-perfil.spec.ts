import { randomUUID } from 'node:crypto';
import { entornoPerfil, imagenPerfil } from '../../soporte/perfil.js';
import { cuentaFicticia } from '../../soporte/fixtures.js';
import { datosRecuperacion, emitirEnlace, nuevaContrasena } from '../../soporte/recuperacion.js';

let e: Awaited<ReturnType<typeof entornoPerfil>>;
beforeAll(async () => { e = await entornoPerfil(); });
afterAll(async () => { await e?.cerrar(); });

test('CA-REC-08 CA-PER-02 CA-AUT-01 el reset preserva perfil, invalida accesos previos y permite continuar como titular', async () => {
  const cuenta = await cuentaFicticia(e.db, ['cliente', 'prestador']);
  const otra = await e.post('/sesiones', {correo: cuenta.correo, contrasena: cuenta.contrasena}).expect(200);
  const foto = await e.post('/perfil/fotografias', await imagenPerfil(), randomUUID(), cuenta.acceso).expect(201);
  const cambios = {nombreMostrar: 'Titular de regresión', telefono: '123', distrito: 'Ayacucho', fotografiaId: foto.body.fotografiaId, autorizarCompartirTelefono: true};
  const {body: perfil} = await e.patch(cuenta.acceso, {version: 1, ...cambios}).expect(200);
  const enlace = await emitirEnlace(e, cuenta.correo);
  await e.post('/recuperaciones/' + enlace.token, datosRecuperacion()).expect(200);

  for (const acceso of [cuenta.acceso, otra.body.tokenAcceso]) {
    await e.get(acceso).expect(401);
    await e.patch(acceso, {version: perfil.version + 1, nombreMostrar: 'Mutación rechazada'}).expect(401);
  }
  await e.post('/sesiones/renovacion', undefined)
    .set('Cookie', String(otra.headers['set-cookie']).split(';')[0]!)
    .set('X-CSRF-Token', otra.body.csrfToken).expect(401);
  const nueva = await e.post('/sesiones', {correo: cuenta.correo, contrasena: nuevaContrasena}).expect(200);
  const acceso = nueva.body.tokenAcceso;
  const {body: recuperado} = await e.get(acceso).expect(200);
  expect(recuperado).toEqual({...perfil, version: perfil.version + 1});
  await e.get(acceso, '/perfil/fotografias/' + cambios.fotografiaId).expect(200);
  const final = await e.patch(acceso, {version: recuperado.version, distrito: 'Carmen Alto'}).expect(200);
  expect(final.body).toEqual({...recuperado, distrito: 'Carmen Alto', version: recuperado.version + 1});
});
