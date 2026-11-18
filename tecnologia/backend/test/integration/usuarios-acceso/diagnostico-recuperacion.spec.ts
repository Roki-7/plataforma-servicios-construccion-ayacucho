import { randomBytes, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { entornoRegistro } from '../../soporte/registro.js';
import { cuentaFicticia } from '../../soporte/fixtures.js';
import { datosRecuperacion, emitirEnlace, nuevaContrasena } from '../../soporte/recuperacion.js';
import { validarRespuesta } from '../../soporte/contrato.js';

let e: Awaited<ReturnType<typeof entornoRegistro>>;
const eventos: string[] = [], archivo: string[] = [];
beforeAll(async () => { e = await entornoRegistro({ registrarDiagnostico: (linea: string) => eventos.push(linea) }); });
beforeEach(() => { eventos.length = 0; });
afterEach(() => { archivo.push(...eventos); });
afterAll(async () => {
  await e?.cerrar();
  if (process.env['T099_EVENTOS']) await writeFile(process.env['T099_EVENTOS'], archivo.join('\n') + '\n');
});
function sinDatosPrivados(valores: string[]) {
  const texto = eventos.join('\n');
  for (const valor of valores) expect(texto.includes(valor)).toBe(false);
  for (const campo of ['message', 'stack', 'query', 'parameters', 'body', 'headers', 'usuarioId', 'correo', 'token']) expect(eventos.some(v => Object.hasOwn(JSON.parse(v), campo))).toBe(false);
}
test('T099 diagnóstico HTTP conserva clase/código fuera de transacción sin divulgar la excepción', async () => {
  const ejecutar = e.serviciosRecuperacion.consumir.ejecutar;
  const token = randomBytes(32).toString('base64url'), secreto = 'contraseña ficticia que nunca se registra', correo = 'privado@example.invalid';
  e.serviciosRecuperacion.consumir.ejecutar = async () => { throw Object.assign(new Error(`${secreto} https://localhost:8443/recuperar#token=${token} ${correo}`), { code: 'ECONNRESET', query: 'SQL privado', parameters: [secreto] }); };
  try {
    const r = await e.post('/recuperaciones/' + token, datosRecuperacion()).set('X-Request-ID', correo).expect(503);
    await validarRespuesta('Error', r.body);
    expect(r.body).toEqual({ codigo: 'DEPENDENCIA_NO_DISPONIBLE', mensaje: 'Servicio temporalmente no disponible.', detalles: [] });
    expect(r.headers['set-cookie']).toBeUndefined();
    const fallos = eventos.map(v => JSON.parse(v));
    expect(fallos).toHaveLength(1);
    expect(fallos[0]).toMatchObject({ evento: 'fallo_interno', etapa: 'http.respuesta', metodo: 'POST', ruta: '/recuperaciones/:redactado', excepcion: { clase: 'Error', codigo: 'ECONNRESET' } });
    expect(fallos[0].peticionId).toMatch(/^[a-f0-9-]{36}$/);
    sinDatosPrivados([token, secreto, correo, 'SQL privado', 'https://localhost']);
  } finally { e.serviciosRecuperacion.consumir.ejecutar = ejecutar; }
});

test('T099 CA-REC-08 bloqueo real provoca 503 diagnosticable en carrera reset/login; rollback y retry', async () => {
  const c = await cuentaFicticia(e.db), enlace = await emitirEnlace(e, c.correo), clave = randomUUID();
  const verificar = e.hash.verificar.bind(e.hash);
  let llegada!: () => void, liberar!: () => void;
  const vista = new Promise<void>(ok => { llegada = ok; }), pausa = new Promise<void>(ok => { liberar = ok; });
  e.hash.verificar = async (...args) => { const correcta = await verificar(...args); llegada(); await pausa; return correcta; };
  const login = e.post('/sesiones', { correo: c.correo, contrasena: c.contrasena }).then(r => r);
  const bloqueo = e.db.createQueryRunner();
  try {
    await vista; await bloqueo.connect(); await bloqueo.startTransaction();
    await bloqueo.query('SELECT id FROM usuarios WHERE id=$1 FOR UPDATE', [c.id]);
    eventos.length = 0;
    const r = await e.post('/recuperaciones/' + enlace.token, datosRecuperacion(), clave).expect(503);
    await validarRespuesta('Error', r.body);
    expect((await e.db.query('SELECT version_credencial FROM usuarios WHERE id=$1', [c.id]))[0].version_credencial).toBe('1');
    expect((await e.db.query('SELECT consumida_en FROM recuperaciones_acceso WHERE id=$1', [enlace.id]))[0].consumida_en).toBeNull();
    expect((await e.db.query('SELECT count(*) FROM claves_idempotencia WHERE clave=$1', [clave]))[0].count).toBe('0');
    expect((await e.db.query("SELECT count(*) FROM avisos_pendientes WHERE tipo='contraseña_recuperada' AND destinatario=$1", [c.correo]))[0].count).toBe('0');
    expect(await e.lector.leer(c.acceso)).not.toBeNull();
    const fallos = eventos.map(v => JSON.parse(v));
    expect(fallos.some(v => v.etapa === 'db.trabajo' && v.excepcion.clase === 'QueryFailedError' && v.excepcion.codigo === '55P03')).toBe(true);
    expect(fallos.some(v => v.etapa === 'http.respuesta')).toBe(true);
    expect(new Set(fallos.map(v => v.peticionId)).size).toBe(1);
    expect(fallos.every(v => v.ruta === '/recuperaciones/:redactado')).toBe(true);
    sinDatosPrivados([c.correo, c.contrasena, c.acceso, enlace.token, clave, c.id, nuevaContrasena, 'SELECT id', 'UPDATE usuarios']);
  } finally {
    if (bloqueo.isTransactionActive) await bloqueo.rollbackTransaction();
    await bloqueo.release(); liberar(); e.hash.verificar = verificar;
  }
  const iniciada = await login; expect(iniciada.status).toBe(200);
  await e.post('/recuperaciones/' + enlace.token, datosRecuperacion(), clave).expect(200);
  expect(await e.lector.leer(c.acceso)).toBeNull();
  expect(await e.lector.leer(iniciada.body.tokenAcceso)).toBeNull();
  await e.post('/sesiones', { correo: c.correo, contrasena: nuevaContrasena }).expect(200);
});
