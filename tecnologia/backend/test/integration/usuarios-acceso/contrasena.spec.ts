import { randomUUID } from 'node:crypto';
import { entornoPerfil } from '../../soporte/perfil.js';
import { cuentaCorreoFicticia, confirmarCorreo, solicitarCorreo } from '../../soporte/correo.js';
import { datosRecuperacion, emitirEnlace } from '../../soporte/recuperacion.js';
import { datosCambioContrasena, nuevaContrasenaCompleta, rutaContrasena } from '../../soporte/contrasena.js';
import { Barrera } from '../../soporte/postgres.js';

let e: Awaited<ReturnType<typeof entornoPerfil>>;
beforeAll(async () => { e = await entornoPerfil(); });
afterAll(async () => { await e?.cerrar(); });
const cuenta = () => cuentaCorreoFicticia(e.db);
const cambiar = (c: Awaited<ReturnType<typeof cuenta>>, datos = datosCambioContrasena(c.contrasena), clave = randomUUID()) => e.post(rutaContrasena, datos, clave, c.acceso);
const credencial = async (id: string) => (await e.db.query('SELECT contrasena_hash,version,version_credencial,correo FROM usuarios WHERE id=$1', [id]))[0];
const login = (correo: string, contrasena: string) => e.post('/sesiones', { correo, contrasena });

test('CA-CLA-01 Argon2 completo y versiones; sesiones, renovación y marca conservadas', async () => {
  const c = await cuenta(), antes = await credencial(c.id);
  const otra = await login(c.correo, c.contrasena).expect(200);
  const sesiones = () => e.db.query('SELECT * FROM sesiones WHERE usuario_id=$1 ORDER BY id', [c.id]);
  const previas = await sesiones();
  await cambiar(c).expect(200);
  const despues = await credencial(c.id);
  expect(despues.contrasena_hash.startsWith('$argon2id$')).toBe(true);
  expect(despues.contrasena_hash === antes.contrasena_hash).toBe(false);
  expect([despues.version, despues.version_credencial, despues.correo]).toEqual(['2', '2', c.correo]);
  expect(JSON.stringify(await sesiones()) === JSON.stringify(previas)).toBe(true);
  await login(c.correo, c.contrasena).expect(401);
  await login(c.correo, nuevaContrasenaCompleta.replace('a ', 'b ')).expect(401);
  await login(c.correo, nuevaContrasenaCompleta).expect(200);
  await e.get(c.acceso).expect(200);
  await e.post('/sesiones/renovacion', undefined).set('Cookie', String(otra.headers['set-cookie']).split(';')[0]!).set('X-CSRF-Token', otra.body.csrfToken).expect(200);
});
test('CA-CLA-01 los desafíos pendientes se conservan y siguen sus reglas de versión y revocación', async () => {
  const c = await cuenta(), reset = await emitirEnlace(e, c.correo), correo = await solicitarCorreo(e, c.acceso);
  await cambiar(c).expect(200);
  await confirmarCorreo(e, c.acceso, correo.token).expect(409);
  expect((await confirmarCorreo(e, c.acceso, correo.token, 2).expect(200)).body.correo).toBe(correo.nuevoCorreo);
  await e.post('/recuperaciones/' + reset.token, datosRecuperacion()).expect(200);
  await e.get(c.acceso).expect(401);
});
test('CA-CLA-02 actual incorrecta, versión obsoleta y rollback no cambian hash/versiones', async () => {
  const c = await cuenta(), antes = await credencial(c.id), clave = randomUUID();
  await cambiar(c, datosCambioContrasena(c.contrasena.trim())).expect(422);
  await cambiar(c, datosCambioContrasena(c.contrasena, nuevaContrasenaCompleta, 2)).expect(409);
  await e.db.query("CREATE FUNCTION fallo_us7() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Fallo controlado US7'; END $$; CREATE TRIGGER fallo_us7 BEFORE INSERT ON claves_idempotencia FOR EACH ROW EXECUTE FUNCTION fallo_us7()");
  try {
    await cambiar(c, datosCambioContrasena(c.contrasena), clave).expect(503);
    expect(JSON.stringify(await credencial(c.id)) === JSON.stringify(antes)).toBe(true);
    expect((await e.db.query('SELECT count(*) FROM claves_idempotencia WHERE clave=$1', [clave]))[0].count).toBe('0');
    await e.get(c.acceso).expect(200);
  } finally { await e.db.query('DROP TRIGGER fallo_us7 ON claves_idempotencia; DROP FUNCTION fallo_us7()'); }
  await cambiar(c, datosCambioContrasena(c.contrasena), clave).expect(200);
});
test('CA-CLA-01 replay exacto sin Argon2 ni catálogo; cambio de cuerpo 409 y sesión revocada 401', async () => {
  const c = await cuenta(), clave = randomUUID(), datos = datosCambioContrasena(c.contrasena);
  const inicial = await cambiar(c, datos, clave).expect(200);
  const verificar = e.hash.verificar, preparada = e.catalogo.preparada;
  const prohibido = async () => { throw new Error('Un replay no vuelve a preparar credenciales.'); };
  e.hash.verificar = prohibido; e.catalogo.preparada = prohibido;
  try {
    expect((await cambiar(c, datos, clave).expect(200)).body).toEqual(inicial.body);
    const conflicto = await cambiar(c, {...datos, version: 2}, clave).expect(409);
    expect(conflicto.body.codigo).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
    await cambiar(c, {...datos, confirmacionContrasena: 'otra confirmación ficticia'}, clave).expect(409);
    const [guardado] = await e.db.query('SELECT cuerpo_hmac, resultado FROM claves_idempotencia WHERE clave=$1', [clave]);
    expect(guardado.cuerpo_hmac.length).toBe(32);
    expect(guardado.resultado).toEqual(inicial.body);
    expect((await credencial(c.id)).version_credencial).toBe('2');
    await e.borrarSesion(c.acceso).expect(204);
    await cambiar(c, datos, clave).expect(401);
  } finally { e.hash.verificar = verificar; e.catalogo.preparada = preparada; }
});
test.each([false, true])('CA-CLA-01 concurrencia tras verificar actual con misma clave=%s', async misma => {
  const c = await cuenta(), clave = randomUUID(), datos = datosCambioContrasena(c.contrasena);
  const verificar = e.hash.verificar.bind(e.hash), barrera = new Barrera(2);
  e.hash.verificar = async (...args) => { const r = await verificar(...args); await barrera.esperar(); return r; };
  try {
    const resultados = await Promise.all([cambiar(c, datos, clave), cambiar(c, datos, misma ? clave : randomUUID())]);
    expect(resultados.map(r => r.status).sort()).toEqual(misma ? [200, 200] : [200, 409]);
    expect((await credencial(c.id)).version_credencial).toBe('2');
  } finally { e.hash.verificar = verificar; }
});
test('CA-CLA-01 carrera reset/cambio: la verificación anterior al reset no autoriza escritura', async () => {
  const c = await cuenta(), reset = await emitirEnlace(e, c.correo), verificar = e.hash.verificar.bind(e.hash);
  const vista = Promise.withResolvers<void>(), pausa = Promise.withResolvers<void>();
  e.hash.verificar = async (...args) => { const r = await verificar(...args); vista.resolve(); await pausa.promise; return r; };
  const pendiente = cambiar(c).then(r => r);
  try {
    await vista.promise;
    await e.post('/recuperaciones/' + reset.token, datosRecuperacion()).expect(200);
  } finally { pausa.resolve(); e.hash.verificar = verificar; }
  expect((await pendiente).status).toBe(401);
  expect((await credencial(c.id)).version_credencial).toBe('2');
});
