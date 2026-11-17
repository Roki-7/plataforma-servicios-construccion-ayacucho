import { Module } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { S3Client } from '@aws-sdk/client-s3';
import type { Configuracion } from './configuracion.js';
import { persistenciaFundacional } from './persistencia.js';
import { UnidadDeTrabajoPostgres } from '../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { IdempotenciaPostgres } from '../compartido/infraestructura/idempotencia.js';
import { RelojServidor, SecretosCrypto } from '../modulos/usuarios-acceso/infraestructura/seguridad/crypto.js';
import { RepositorioCuentasPostgres } from '../modulos/usuarios-acceso/infraestructura/persistencia/repositorio-cuentas.js';
import { RegistrarCuenta } from '../modulos/usuarios-acceso/aplicacion/registrar-cuenta.js';
import { HabilitarPerfil } from '../modulos/usuarios-acceso/aplicacion/habilitar-perfil.js';
import { RegistroController, REGISTRAR_CUENTA, HABILITAR_PERFIL } from '../modulos/usuarios-acceso/presentacion/registro.controller.js';
import { RepositorioSesionesPostgres } from '../modulos/usuarios-acceso/infraestructura/persistencia/repositorio-sesiones.js';
import { CsrfHmac } from '../modulos/usuarios-acceso/infraestructura/seguridad/csrf.js';
import { IniciarSesion } from '../modulos/usuarios-acceso/aplicacion/iniciar-sesion.js';
import { RenovarSesion } from '../modulos/usuarios-acceso/aplicacion/renovar-sesion.js';
import { ObtenerCsrf } from '../modulos/usuarios-acceso/aplicacion/obtener-csrf.js';
import { CerrarSesion } from '../modulos/usuarios-acceso/aplicacion/cerrar-sesion.js';
import { SesionesController, SERVICIOS_SESION } from '../modulos/usuarios-acceso/presentacion/sesiones.controller.js';
import { HashArgon2id } from '../modulos/usuarios-acceso/infraestructura/seguridad/argon2id.js';
import { CatalogoLocal } from '../modulos/usuarios-acceso/infraestructura/seguridad/catalogo-contrasenas.js';
import { LectorSesionPostgres } from '../modulos/usuarios-acceso/infraestructura/persistencia/lector-sesion.js';
import { GuardSesion } from '../modulos/usuarios-acceso/presentacion/guard-sesion.js';
import { CifradoOutbox, OutboxPostgres } from '../modulos/notificaciones/infraestructura/outbox.js';
import { WorkerCorreo } from '../modulos/notificaciones/infraestructura/worker-correo.js';
import { SmtpNodemailer } from '../modulos/notificaciones/infraestructura/smtp.js';
import { FotografiasS3 } from '../modulos/usuarios-acceso/infraestructura/almacenamiento/fotografias-s3.js';
import { limpiarTemporales } from '../modulos/usuarios-acceso/infraestructura/almacenamiento/limpiar-temporales.js';
import { configurarApi } from '../compartido/infraestructura/http/configurar-api.js';
import { ESTADO_SALUD, SaludController } from '../compartido/infraestructura/http/salud.controller.js';

export async function crearAplicacion(config: Configuracion, opciones: { worker?: boolean } = {}) {
  const db = persistenciaFundacional(config.databaseUrl);
  const catalogo = new CatalogoLocal(config.catalogo, config.validacion);
  let conexion: Promise<void> | undefined;
  const conectar = async () => {
    if (db.isInitialized) return;
    if (!conexion) conexion = db.initialize().then(() => undefined).finally(() => { conexion = undefined; });
    await conexion;
  };
  await Promise.allSettled([conectar(), catalogo.inicializar()]);
  const uow = new UnidadDeTrabajoPostgres(db); const reloj = new RelojServidor(); const hash = new HashArgon2id();
  const idempotencia = new IdempotenciaPostgres(uow, config.hmac, config.hmacId);
  const cifrado = new CifradoOutbox(config.aead, config.aeadId);
  const notificaciones = new OutboxPostgres((tx) => uow.runner(tx), cifrado);
  const smtp = new SmtpNodemailer(config.smtp); const worker = new WorkerCorreo(db, cifrado, smtp);
  const cliente = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey }, forcePathStyle: true, maxAttempts: 2, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  const fotos = new FotografiasS3(cliente, config.s3.bucket, db, uow);
  const lector = new LectorSesionPostgres(db, reloj);
  const cuentas = new RepositorioCuentasPostgres(db, uow);
  const registrar = new RegistrarCuenta(cuentas, idempotencia, hash, catalogo, reloj, new SecretosCrypto(), fotos);
  const habilitar = new HabilitarPerfil(cuentas, idempotencia, lector, reloj);
  const sesiones = new RepositorioSesionesPostgres(db, uow); const secretos = new SecretosCrypto(); const csrf = new CsrfHmac(config.hmac, config.hmacId);
  const serviciosSesion = {
    iniciar: new IniciarSesion(cuentas, sesiones, uow, hash, reloj, secretos, csrf),
    renovar: new RenovarSesion(sesiones, uow, reloj, secretos, csrf),
    csrf: new ObtenerCsrf(sesiones, uow, reloj, secretos, csrf),
    cerrar: new CerrarSesion(sesiones, uow, reloj, secretos, lector), origen: config.origen,
  };
  const salud = { disponible: async () => {
    try {
      await conectar();
      const tablas: { lista: boolean }[] = await db.query("SELECT count(*)=6 AS lista FROM unnest(ARRAY['usuarios','perfiles_habilitados','sesiones','claves_idempotencia','avisos_pendientes','fotografias_perfil']) t WHERE to_regclass(t) IS NOT NULL");
      return tablas[0]?.lista === true && await catalogo.preparada();
    } catch { return false; }
  } };
  let limpiando = false;
  const limpieza = opciones.worker === false ? undefined : setInterval(() => {
    if (!limpiando) { limpiando = true; void limpiarTemporales(db, fotos).catch(() => undefined).finally(() => { limpiando = false; }); }
  }, 60000);
  limpieza?.unref();
  const cerrar = async () => { if (limpieza) clearInterval(limpieza); await worker.detener(); smtp.cerrar(); cliente.destroy(); if (db.isInitialized) await db.destroy(); };
  @Module({ controllers: [SaludController, RegistroController, SesionesController], providers: [{ provide: SERVICIOS_SESION, useValue: serviciosSesion }, { provide: REGISTRAR_CUENTA, useValue: registrar }, { provide: HABILITAR_PERFIL, useValue: habilitar }, { provide: ESTADO_SALUD, useValue: salud }, { provide: 'cierre-fundacion', useValue: { onModuleDestroy: cerrar } }] })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false, abortOnError: false });
  await configurarApi(app, { origen: config.origen, contrato: config.contrato });
  app.useGlobalGuards(new GuardSesion(lector, app.get(Reflector)));
  app.enableShutdownHooks();
  await app.init();
  if (opciones.worker !== false) worker.iniciar();
  return { app, db, catalogo, uow, reloj, hash, idempotencia, notificaciones, cifrado, smtp, worker, fotos, lector, cuentas, sesiones, serviciosSesion };
}
