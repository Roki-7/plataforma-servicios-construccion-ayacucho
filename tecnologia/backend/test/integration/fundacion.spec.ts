import 'reflect-metadata';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import type { DataSource } from 'typeorm';
import sharp from 'sharp';
import { S3Client } from '@aws-sdk/client-s3';
import { cargarLocal } from '../../scripts/entorno.js';
import { cargarConfiguracion } from '../../src/composicion/configuracion.js';
import { persistenciaFundacional } from '../../src/composicion/persistencia.js';
import { baseAislada, Barrera } from '../soporte/postgres.js';
import { cuentaFicticia } from '../soporte/fixtures.js';
import { UnidadDeTrabajoPostgres } from '../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { IdempotenciaPostgres } from '../../src/compartido/infraestructura/idempotencia.js';
import { LectorSesionPostgres } from '../../src/modulos/usuarios-acceso/infraestructura/persistencia/lector-sesion.js';
import { idCuenta } from '../../src/modulos/usuarios-acceso/dominio/identificadores.js';
import { ErrorAplicacion } from '../../src/compartido/dominio/errores.js';
import { CifradoOutbox, OutboxPostgres } from '../../src/modulos/notificaciones/infraestructura/outbox.js';
import { WorkerCorreo } from '../../src/modulos/notificaciones/infraestructura/worker-correo.js';
import { SmtpNodemailer } from '../../src/modulos/notificaciones/infraestructura/smtp.js';
import { FotografiasS3 } from '../../src/modulos/usuarios-acceso/infraestructura/almacenamiento/fotografias-s3.js';
import { limpiarTemporales } from '../../src/modulos/usuarios-acceso/infraestructura/almacenamiento/limpiar-temporales.js';

describe('Fundación PostgreSQL real, Outbox y objetos; sin casos de uso de historias', () => {
  let db: DataSource; let cerrar: () => Promise<void>;
  beforeAll(async () => { cargarLocal(); const config = cargarConfiguracion(); const aislada = await baseAislada(persistenciaFundacional, config.databaseUrl); db = aislada.db; cerrar = aislada.cerrar; });
  afterAll(async () => { await cerrar?.(); });
  test('Migraciones sobre DB vacía y restricciones de identidad/perfiles', async () => {
    expect((await db.showMigrations())).toBe(false);
    const correo = `${randomUUID()}@example.invalid`;
    const barrera = new Barrera(2);
    const resultados = await Promise.allSettled([correo, correo.toUpperCase()].map(async (c) => { await barrera.esperar(); return cuentaFicticia(db, ['cliente'], c); }));
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const filas: { cantidad: string }[] = await db.query('SELECT count(*) AS cantidad FROM usuarios WHERE correo_canonico=lower($1::text COLLATE correo_001)', [correo]); expect(filas[0]?.cantidad).toBe('1');
    const propia = await cuentaFicticia(db, ['cliente', 'prestador']);
    await expect(db.query('UPDATE usuarios SET id=$1 WHERE id=$2', [randomUUID(), propia.id])).rejects.toBeDefined();
    await expect(cuentaFicticia(db, ['administrador'])).rejects.toBeDefined();
    await expect(cuentaFicticia(db, [])).rejects.toBeDefined();
  });
  test('El lector consulta vigencia y revocación actuales, sin fallback de DB', async () => {
    const cuenta = await cuentaFicticia(db, ['cliente', 'prestador']);
    const lector = new LectorSesionPostgres(db, { ahora: () => new Date() });
    expect((await lector.leer(cuenta.acceso))?.perfiles).toEqual(['cliente', 'prestador']);
    await db.query('UPDATE sesiones SET revocada_en=clock_timestamp() WHERE id=$1', [cuenta.sesionId]); expect(await lector.leer(cuenta.acceso)).toBeNull();
    const vacia = persistenciaFundacional(cargarConfiguracion().databaseUrl);
    await expect(new LectorSesionPostgres(vacia, { ahora: () => new Date() }).leer(cuenta.acceso)).rejects.toMatchObject({ codigo: 'DEPENDENCIA_NO_DISPONIBLE' });
  });
  test('Idempotencia serializa reintentos y conserva replay antes de volver a ejecutar', async () => {
    const uow = new UnidadDeTrabajoPostgres(db); const idempotencia = new IdempotenciaPostgres(uow, new Map([['v1', randomBytes(32)]]), 'v1');
    const token = randomBytes(32).toString('base64url'); const scope = createHash('sha256').update(token).digest('hex');
    const solicitud = { ambito: { tipo: 'recuperacion' as const, id: scope }, metodo: 'POST' as const, rutaLogica: '/recuperaciones/{token}', clave: randomUUID(), token, cuerpo: { version: 1, nuevaContrasena: 'valor ficticio de pruebas' } };
    let llamadas = 0; const trabajo = async () => { llamadas++; return { http: 200, cuerpo: { codigo: 'CONTROL_FUNDACIONAL', mensaje: 'Confirmado' } }; };
    const resultados = await Promise.all(Array.from({ length: 5 }, () => idempotencia.ejecutar(solicitud, trabajo)));
    expect(llamadas).toBe(1); expect(resultados.every((r) => r.http === 200)).toBe(true);
    await expect(idempotencia.ejecutar(solicitud, async () => { throw new Error('No debe recalcularse el trabajo confirmado.'); })).resolves.toMatchObject({ http: 200 });
    await expect(idempotencia.ejecutar({ ...solicitud, cuerpo: { version: 2 } }, trabajo)).rejects.toMatchObject({ codigo: 'CLAVE_IDEMPOTENCIA_REUTILIZADA' });
    await expect(idempotencia.ejecutar({ ...solicitud, clave: randomUUID() }, async () => { throw new ErrorAplicacion(422, 'RECUPERACION_NO_VALIDA', 'Control ficticio de desafío consumido.'); })).rejects.toMatchObject({ codigo: 'RECUPERACION_NO_VALIDA' });
    let trabajoAjeno = false;
    await expect(idempotencia.ejecutar({ ...solicitud, ambito: { tipo: 'usuario', id: randomUUID() }, autorizar: async () => { throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión ficticia revocada.'); } }, async () => { trabajoAjeno = true; return trabajo(); })).rejects.toMatchObject({ codigo: 'SESION_NO_VALIDA' });
    expect(trabajoAjeno).toBe(false);
  });
  test('Aviso y escritura participan en el mismo commit; rollback no deja aviso ni resultado', async () => {
    const uow = new UnidadDeTrabajoPostgres(db); const cifrado = new CifradoOutbox(new Map([['v1', randomBytes(32)]]), 'v1'); const api = new OutboxPostgres((tx) => uow.runner(tx), cifrado);
    const idempotencia = new IdempotenciaPostgres(uow, new Map([['v1', randomBytes(32)]]), 'v1'); const c = await cuentaFicticia(db); const clave = randomUUID();
    await expect(idempotencia.ejecutar({ ambito: { tipo: 'usuario', id: c.id }, autorizar: async () => c.id, metodo: 'PATCH', rutaLogica: '/control-fundacional', clave, cuerpo: { version: 1 } }, async (tx) => {
      await uow.runner(tx).query("UPDATE usuarios SET nombre_mostrar='No debe persistir' WHERE id=$1", [c.id]);
      await api.programar({ tipo: 'contraseña_recuperada', destinatario: c.correo, asunto: 'Control', texto: 'Control ficticio sin contraseña', claveLogica: clave }, tx);
      throw new Error('Fallo de escritura inyectado.');
    })).rejects.toBeDefined();
    const estado: { nombre_mostrar: string }[] = await db.query('SELECT nombre_mostrar FROM usuarios WHERE id=$1', [c.id]); expect(estado[0]?.nombre_mostrar).toBe('Cuenta ficticia');
    expect((await db.query('SELECT id FROM avisos_pendientes WHERE clave_logica=$1', [clave])) as unknown[]).toHaveLength(0);
    expect((await db.query('SELECT clave FROM claves_idempotencia WHERE clave=$1', [clave])) as unknown[]).toHaveLength(0);
  });
  test('Worker reintenta sin deshacer commit, expira secretos y entrega realmente en Mailpit', async () => {
    const uow = new UnidadDeTrabajoPostgres(db); const cifrado = new CifradoOutbox(new Map([['v1', randomBytes(32)]]), 'v1'); const api = new OutboxPostgres((tx) => uow.runner(tx), cifrado);
    const clave = randomUUID(); const destinatario = `${randomUUID()}@example.invalid`;
    await uow.ejecutar((tx) => api.programar({ tipo: 'contraseña_recuperada', destinatario, asunto: 'Control técnico de Outbox', texto: 'Mensaje ficticio de fundación, sin contraseña.', claveLogica: clave }, tx));
    const fallando = new WorkerCorreo(db, cifrado, { enviar: async () => { throw new Error('Falla ficticia SMTP'); } }); await fallando.paso();
    const pendiente: { estado: string; error_sanitizado: string }[] = await db.query('SELECT estado,error_sanitizado FROM avisos_pendientes WHERE clave_logica=$1', [clave]); expect(pendiente[0]?.estado).toBe('pendiente'); expect(pendiente[0]?.error_sanitizado).toBe('SMTP_NO_DISPONIBLE');
    await db.query('UPDATE avisos_pendientes SET proximo_intento_en=clock_timestamp() WHERE clave_logica=$1', [clave]);
    const smtp = new SmtpNodemailer(cargarConfiguracion().smtp); try { await new WorkerCorreo(db, cifrado, smtp).paso(); } finally { smtp.cerrar(); }
    const enviado: { estado: string; payload_cifrado: Buffer | null }[] = await db.query('SELECT estado,payload_cifrado FROM avisos_pendientes WHERE clave_logica=$1', [clave]); expect(enviado[0]?.estado).toBe('enviado'); expect(enviado[0]?.payload_cifrado).toBeNull();
    const bandeja = await fetch('http://127.0.0.1:8025/api/v1/search?query=' + encodeURIComponent('to:' + destinatario)); expect(bandeja.ok).toBe(true); const mensajes = await bandeja.json() as { total: number }; expect(mensajes.total > 0).toBe(true);
    const vencida = randomUUID(); await uow.ejecutar((tx) => api.programar({ tipo: 'recuperación', destinatario, asunto: 'Vencido', texto: 'No entregar', claveLogica: vencida, venceEn: new Date(Date.now() - 1000) }, tx));
    let intentos = 0; await new WorkerCorreo(db, cifrado, { enviar: async () => { intentos++; } }).paso(); expect(intentos).toBe(0);
    const expirada: { estado: string; payload_cifrado: Buffer | null }[] = await db.query('SELECT estado,payload_cifrado FROM avisos_pendientes WHERE clave_logica=$1', [vencida]); expect(expirada[0]?.estado).toBe('vencido'); expect(expirada[0]?.payload_cifrado).toBeNull();
  });
  test('S3 real conserva imagen privada, niega propietario ajeno y limpia temporales/objetos huérfanos', async () => {
    const config = cargarConfiguracion(); const uow = new UnidadDeTrabajoPostgres(db); const cliente = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey }, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED' });
    const fotos = new FotografiasS3(cliente, config.s3.bucket, db, uow, `pruebas/${randomUUID()}/usuarios/`); const c = await cuentaFicticia(db); const otro = await cuentaFicticia(db);
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#abcdef' } }).png().toBuffer();
    try {
      const foto = await fotos.almacenar(idCuenta(c.id), png.toString('base64'), 'image/png'); await uow.ejecutar((tx) => fotos.registrarTemporal(idCuenta(c.id), foto, tx));
      expect((await fotos.leerPropia(idCuenta(c.id), foto.id)).tipoContenido).toBe('image/png');
      await expect(fotos.leerPropia(idCuenta(otro.id), foto.id)).rejects.toMatchObject({ codigo: 'RECURSO_NO_DISPONIBLE' });
      await db.query("UPDATE fotografias_perfil SET estado='activa',vinculada_en=clock_timestamp() WHERE id=$1", [foto.id]); await db.query('UPDATE usuarios SET fotografia_id=$1 WHERE id=$2', [foto.id, c.id]);
      const huerfana = await fotos.almacenar(idCuenta(c.id), png.toString('base64'), 'image/png');
      const temporal = await fotos.almacenar(idCuenta(c.id), png.toString('base64'), 'image/png'); await uow.ejecutar((tx) => fotos.registrarTemporal(idCuenta(c.id), temporal, tx));
      expect(await limpiarTemporales(db, fotos, 3600000, new Date(Date.now() + 7200000))).toBeGreaterThanOrEqual(2);
      expect((await fotos.leerPropia(idCuenta(c.id), foto.id)).tipoContenido).toBe('image/png');
      await expect(fotos.leerPropia(idCuenta(c.id), temporal.id)).rejects.toMatchObject({ codigo: 'RECURSO_NO_DISPONIBLE' });
      expect(huerfana.objetoClave.length > 0).toBe(true);
      await db.query('UPDATE usuarios SET fotografia_id=NULL WHERE id=$1', [c.id]); await db.query("UPDATE fotografias_perfil SET estado='pendiente_eliminacion' WHERE id=$1", [foto.id]); await limpiarTemporales(db, fotos);
    } finally { cliente.destroy(); }
  });
});
