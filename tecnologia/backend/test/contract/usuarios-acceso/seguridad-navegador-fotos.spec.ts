import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { entornoPerfil, imagenPerfil } from '../../soporte/perfil.js';
import { origen, registroValido } from '../../soporte/registro.js';
import { cuentaFicticia } from '../../soporte/fixtures.js';
import { emitirEnlace } from '../../soporte/recuperacion.js';
import { limpiarTemporales } from '../../../src/modulos/usuarios-acceso/infraestructura/almacenamiento/limpiar-temporales.js';
import { eventoPeticion } from '../../../src/compartido/infraestructura/http/logs-seguros.js';

let e: Awaited<ReturnType<typeof entornoPerfil>>;
beforeAll(async () => { e = await entornoPerfil(); });
afterAll(async () => { await e?.cerrar(); });

test('X-06 cookie exacta, bootstrap y rechazos CSRF/origen sin mutación', async () => {
  const c = await cuentaFicticia(e.db);
  const login = await e.post('/sesiones', {correo: c.correo, contrasena: c.contrasena}).expect(200);
  const set = String(login.headers['set-cookie']);
  const atributos = set.split('; ').slice(1).sort();
  expect(atributos).toEqual(['Path=/api/v1/sesiones', 'Expires=' + new Date(login.body.renovacionVenceEn).toUTCString(), 'HttpOnly', 'Secure', 'SameSite=Lax'].sort());
  const cookie = set.split(';')[0]!;
  const leer = () => request(e.app.getHttpServer()).get('/api/v1/sesiones/csrf').set('Cookie', cookie);
  const renovar = () => request(e.app.getHttpServer()).post('/api/v1/sesiones/renovacion').set('Cookie', cookie);
  const filas = () => e.db.query('SELECT * FROM sesiones WHERE usuario_id=$1 ORDER BY id', [c.id]);
  const antes = JSON.stringify(await filas());
  await leer().set('Sec-Fetch-Site', 'cross-site').expect(403);
  const bootstrap = await leer().set('Sec-Fetch-Site', 'same-origin').expect(200);
  expect(bootstrap.headers['set-cookie']).toBeUndefined();
  expect(bootstrap.body.csrfToken === login.body.csrfToken).toBe(true);
  for (const csrf of [undefined, 'incorrecto']) {
    const consulta = renovar().set('Origin', origen);
    if (csrf) consulta.set('X-CSRF-Token', csrf);
    const r = await consulta.expect(403);
    expect(r.body.codigo).toBe('CSRF_NO_VALIDO');
    expect(r.headers['set-cookie']).toBeUndefined();
  }
  const ajeno = await renovar().set('Origin', 'https://ajeno.example.invalid').set('X-CSRF-Token', login.body.csrfToken).expect(403);
  expect(ajeno.body.codigo).toBe('ORIGEN_NO_ADMITIDO');
  expect(JSON.stringify(await filas()) === antes).toBe(true);
});

test('X-06 GET sobre desafío no consume y el registro usa el patrón redactado', async () => {
  const c = await cuentaFicticia(e.db);
  const enlace = await emitirEnlace(e, c.correo);
  const consultar = () => e.db.query('SELECT version,consumida_en,invalidada_en FROM recuperaciones_acceso WHERE id=$1', [enlace.id]);
  const antes = await consultar();
  const r = await request(e.app.getHttpServer()).get('/api/v1/recuperaciones/' + enlace.token).expect(404);
  expect(r.headers['referrer-policy']).toBe('no-referrer');
  expect(r.headers['set-cookie']).toBeUndefined();
  expect(await consultar()).toEqual(antes);
  const evento = eventoPeticion('POST', '/recuperaciones/{token}', 200);
  expect(evento).toContain('/recuperaciones/:redactado');
  expect(evento.includes(enlace.token)).toBe(false);
});

test('X-07 rechaza MIME disfrazado, PDF, base64 inválido, exceso y objeto ajeno', async () => {
  const c = await cuentaFicticia(e.db);
  const otro = await cuentaFicticia(e.db);
  const subir = (data: object) => e.post('/perfil/fotografias', data, randomUUID(), c.acceso);
  for (const data of [
    {tipoContenido: 'image/png', contenidoBase64: Buffer.from('%PDF-1.7').toString('base64')},
    {tipoContenido: 'application/pdf', contenidoBase64: Buffer.from('%PDF-1.7').toString('base64')},
    {tipoContenido: 'image/png', contenidoBase64: '**=='},
  ]) await subir(data).expect(400);
  const exceso = await subir({tipoContenido: 'image/png', contenidoBase64: Buffer.alloc(10000001).toString('base64')}).expect(413);
  expect(exceso.body.codigo).toBe('ARCHIVO_DEMASIADO_GRANDE');
  const foto = await subir(await imagenPerfil()).expect(201);
  await e.get(otro.acceso, '/perfil/fotografias/' + foto.body.fotografiaId).expect(404);
  await e.patch(otro.acceso, {version: 1, fotografiaId: foto.body.fotografiaId}).expect(404);
  expect((await e.get(otro.acceso).expect(200)).body.fotografiaId).toBeNull();
});

test('X-07 alta con foto y reemplazo seguro aun con rollback o fallo del objeto', async () => {
  const cuenta = registroValido();
  const imagen = await imagenPerfil();
  await e.post('/cuentas', {...cuenta, fotografia: imagen}).expect(201);
  const sesion = await e.post('/sesiones', {correo: cuenta.correo, contrasena: cuenta.contrasena}).expect(200);
  const acceso = sesion.body.tokenAcceso;
  const perfil = (await e.get(acceso).expect(200)).body;
  expect(perfil.fotografiaId).toEqual(expect.any(String));
  const vieja = (await e.db.query('SELECT objeto_clave FROM fotografias_perfil WHERE id=$1', [perfil.fotografiaId]))[0].objeto_clave;
  const objetos = async () => (await e.fotos.cliente.send(new ListObjectsV2Command({Bucket: e.fotos.bucket, Prefix: e.fotosPrueba.prefijo}))).KeyCount;
  const inicial = await objetos();
  await e.db.query(`CREATE FUNCTION fallo_foto_t111() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fallo controlado T111'; END $$;
    CREATE TRIGGER fallo_foto_t111 BEFORE INSERT ON claves_idempotencia FOR EACH ROW EXECUTE FUNCTION fallo_foto_t111()`);
  try {
    await e.post('/cuentas', {...registroValido(), fotografia: imagen}).expect(503);
    await e.post('/perfil/fotografias', imagen, randomUUID(), acceso).expect(503);
    expect(await objetos()).toBe(inicial);
    expect((await e.get(acceso).expect(200)).body).toEqual(perfil);
  } finally { await e.db.query('DROP TRIGGER fallo_foto_t111 ON claves_idempotencia; DROP FUNCTION fallo_foto_t111()'); }
  const nueva = await e.post('/perfil/fotografias', imagen, randomUUID(), acceso).expect(201);
  const cambio = await e.patch(acceso, {version: perfil.version, fotografiaId: nueva.body.fotografiaId}).expect(200);
  expect(cambio.body.fotografiaId).toBe(nueva.body.fotografiaId);
  await limpiarTemporales(e.db, e.fotosPrueba);
  await expect(e.fotos.cliente.send(new GetObjectCommand({Bucket: e.fotos.bucket, Key: vieja}))).rejects.toBeDefined();
  await e.get(acceso, '/perfil/fotografias/' + nueva.body.fotografiaId).expect(200);
});
