import { randomBytes, randomUUID } from 'node:crypto';
import { cuentaFicticia } from '../../soporte/fixtures.js';
import { entornoPerfil } from '../../soporte/perfil.js';
import { datosRecuperacion, emitirEnlace } from '../../soporte/recuperacion.js';
import { WorkerCorreo } from '../../../src/modulos/notificaciones/infraestructura/worker-correo.js';

let e: Awaited<ReturnType<typeof entornoPerfil>>;
beforeAll(async () => { e = await entornoPerfil(); });
afterAll(async () => { await e?.cerrar(); });

test('X-01 Argon2id procesa Unicode suplementario íntegro y usa sales independientes', async () => {
  const prefijo = ' ' + '𠮷'.repeat(126);
  const entrada = prefijo + 'a';
  const otro = prefijo + 'b';
  const phc = await e.hash.crear(entrada);
  const segundo = await e.hash.crear(entrada);
  expect([...entrada]).toHaveLength(128);
  expect(phc.startsWith('$argon2id$')).toBe(true);
  expect(phc.split('$')[4] !== segundo.split('$')[4]).toBe(true);
  expect(await e.hash.verificar(entrada, phc)).toBe(true);
  expect(await e.hash.verificar(otro, phc)).toBe(false);
  await expect(e.hash.crear('\ud800' + entrada.slice(1))).rejects.toMatchObject({http: 400});
  await expect(e.hash.verificar(entrada + 'z', phc)).rejects.toMatchObject({http: 400});
});

const escrituras = [
  ['credencial', 'usuarios', 'UPDATE', 'NEW.version_credencial > OLD.version_credencial'],
  ['consumo', 'recuperaciones_acceso', 'UPDATE', 'NEW.consumida_en IS NOT NULL AND OLD.consumida_en IS NULL'],
  ['invalidación', 'recuperaciones_acceso', 'UPDATE', 'NEW.invalidada_en IS NOT NULL AND OLD.invalidada_en IS NULL'],
  ['revocación', 'sesiones', 'UPDATE', 'NEW.revocada_en IS NOT NULL AND OLD.revocada_en IS NULL'],
  ['aviso', 'avisos_pendientes', 'INSERT', null],
  ['resultado', 'claves_idempotencia', 'INSERT', null],
] as const;

test.each(escrituras)('X-02 rollback al fallar la escritura de %s', async (_etapa, tabla, evento, condicion) => {
  const cuenta = await cuentaFicticia(e.db);
  const uno = await emitirEnlace(e, cuenta.correo);
  await emitirEnlace(e, cuenta.correo);
  const clave = randomUUID();
  const estado = async () => {
    const cuentaActual = await e.db.query('SELECT * FROM usuarios WHERE id=$1', [cuenta.id]);
    const sesiones = await e.db.query('SELECT * FROM sesiones WHERE usuario_id=$1 ORDER BY id', [cuenta.id]);
    const enlaces = await e.db.query('SELECT * FROM recuperaciones_acceso WHERE usuario_id=$1 ORDER BY id', [cuenta.id]);
    const avisos = await e.db.query('SELECT id,estado FROM avisos_pendientes WHERE destinatario=$1 ORDER BY id', [cuenta.correo]);
    const resultados = await e.db.query('SELECT http FROM claves_idempotencia WHERE clave=$1', [clave]);
    return JSON.stringify({cuentaActual, sesiones, enlaces, avisos, resultados});
  };
  const previo = await estado();
  await e.db.query(`CREATE FUNCTION fallo_t110() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Inyección controlada T110'; END $$;
    CREATE TRIGGER fallo_t110 BEFORE ${evento} ON ${tabla} FOR EACH ROW ${condicion ? 'WHEN (' + condicion + ')' : ''} EXECUTE FUNCTION fallo_t110()`);
  try {
    await e.post('/recuperaciones/' + uno.token, datosRecuperacion(), clave).expect(503);
    expect((await estado()) === previo).toBe(true);
    await e.get(cuenta.acceso).expect(200);
  } finally {
    await e.db.query('DROP TRIGGER fallo_t110 ON ' + tabla + '; DROP FUNCTION fallo_t110()');
  }
  await e.post('/recuperaciones/' + uno.token, datosRecuperacion(), clave).expect(200);
  await e.get(cuenta.acceso).expect(401);
});

test('X-04 replay exacto sobre enlace vencido, cuerpo distinto y token de otro ámbito', async () => {
  const a = await cuentaFicticia(e.db);
  const b = await cuentaFicticia(e.db);
  const enlaceA = await emitirEnlace(e, a.correo);
  const enlaceB = await emitirEnlace(e, b.correo);
  const clave = randomUUID();
  const consumir = (token: string, cuerpo = datosRecuperacion(), idempotencia = clave) => e.post('/recuperaciones/' + token, cuerpo, idempotencia);
  const resultado = await consumir(enlaceA.token).expect(200);
  const ahora = e.reloj.ahora;
  const preparada = e.catalogo.preparada;
  try {
    e.reloj.ahora = () => new Date(Date.now() + 3600000);
    e.catalogo.preparada = async () => false;
    expect((await consumir(enlaceA.token).expect(200)).body).toEqual(resultado.body);
    await consumir(enlaceA.token, {...datosRecuperacion(), version: 2}).expect(409);
    await consumir(enlaceA.token, datosRecuperacion(), randomUUID()).expect(422);
    await consumir(enlaceB.token).expect(422);
    await consumir(randomBytes(32).toString('base64url')).expect(422);
  } finally {
    e.reloj.ahora = ahora;
    e.catalogo.preparada = preparada;
  }
  await e.get(a.acceso).expect(401);
  await e.get(b.acceso).expect(200);
  expect((await e.db.query("SELECT count(*) FROM avisos_pendientes WHERE tipo='contraseña_recuperada' AND destinatario=$1", [a.correo]))[0].count).toBe('1');
});

test('X-05 conexión PostgreSQL cerrada impide autorización y escrituras', async () => {
  const cuenta = await cuentaFicticia(e.db);
  await e.get(cuenta.acceso).expect(200);
  await e.db.destroy();
  try {
    await e.get(cuenta.acceso).expect(503);
    const rechazo = await e.patch(cuenta.acceso, {version: 1, nombreMostrar: 'No persistir'}).expect(503);
    expect(rechazo.body.codigo).toBe('DEPENDENCIA_NO_DISPONIBLE');
  } finally { await e.db.initialize(); }
  expect((await e.get(cuenta.acceso).expect(200)).body.version).toBe(1);
});

test('X-05 fallo después de entrega conserva un aviso lógico, reintenta y limpia', async () => {
  const cuenta = await cuentaFicticia(e.db);
  const enlace = await emitirEnlace(e, cuenta.correo);
  await e.db.query("UPDATE avisos_pendientes SET proximo_intento_en=clock_timestamp()+interval '1 day'");
  await e.post('/recuperaciones/' + enlace.token, datosRecuperacion()).expect(200);
  const entregas: string[] = [];
  const worker = new WorkerCorreo(e.db, e.cifrado, {enviar: async aviso => { entregas.push(aviso.id); }});
  await e.db.query(`CREATE FUNCTION fallo_entrega_t110() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Inyección tras entrega'; END $$;
    CREATE TRIGGER fallo_entrega_t110 BEFORE UPDATE ON avisos_pendientes FOR EACH ROW WHEN (NEW.estado='enviado') EXECUTE FUNCTION fallo_entrega_t110()`);
  try {
    await worker.paso();
  } finally { await e.db.query('DROP TRIGGER fallo_entrega_t110 ON avisos_pendientes; DROP FUNCTION fallo_entrega_t110()'); }
  expect(entregas).toHaveLength(1);
  const consulta = () => e.db.query("SELECT estado,payload_cifrado,intentos FROM avisos_pendientes WHERE tipo='contraseña_recuperada' AND destinatario=$1", [cuenta.correo]);
  expect((await consulta())[0].estado).toBe('pendiente');
  await e.get(cuenta.acceso).expect(401);
  await e.db.query("UPDATE avisos_pendientes SET proximo_intento_en=clock_timestamp() WHERE id=$1", [entregas[0]]);
  await worker.paso();
  await worker.paso();
  expect(entregas).toEqual([entregas[0], entregas[0]]);
  expect(await consulta()).toEqual([{estado: 'enviado', payload_cifrado: null, intentos: 2}]);

  const vencida = await emitirEnlace(e, cuenta.correo);
  await e.db.query("UPDATE avisos_pendientes SET vence_en=clock_timestamp()-interval '1 second' WHERE desafio_id=$1", [vencida.id]);
  await worker.paso();
  expect(entregas).toHaveLength(2);
  expect(await e.db.query('SELECT estado,payload_cifrado FROM avisos_pendientes WHERE desafio_id=$1', [vencida.id])).toEqual([{estado: 'vencido', payload_cifrado: null}]);
});
