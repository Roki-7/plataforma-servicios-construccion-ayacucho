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
import { RepositorioRecuperacionesPostgres } from '../modulos/usuarios-acceso/infraestructura/persistencia/repositorio-recuperaciones.js';
import { SolicitarRecuperacion } from '../modulos/usuarios-acceso/aplicacion/solicitar-recuperacion.js';
import { ConsumirRecuperacion } from '../modulos/usuarios-acceso/aplicacion/consumir-recuperacion.js';
import { RecuperacionController, SERVICIOS_RECUPERACION } from '../modulos/usuarios-acceso/presentacion/recuperacion.controller.js';
import { PlantillasSeguridad } from '../modulos/notificaciones/infraestructura/plantillas-seguridad.js';
import { ConsultarPerfil } from '../modulos/usuarios-acceso/aplicacion/consultar-perfil.js';
import { ActualizarPerfil } from '../modulos/usuarios-acceso/aplicacion/actualizar-perfil.js';
import { Fotografias } from '../modulos/usuarios-acceso/aplicacion/fotografias.js';
import { RepositorioPerfilPostgres } from '../modulos/usuarios-acceso/infraestructura/persistencia/repositorio-perfil.js';
import { RepositorioConsentimientosPostgres } from '../modulos/usuarios-acceso/infraestructura/persistencia/repositorio-consentimientos.js';
import { HuellasTelefonoHmac } from '../modulos/usuarios-acceso/infraestructura/seguridad/huellas-telefono.js';
import { PerfilController, SERVICIOS_PERFIL } from '../modulos/usuarios-acceso/presentacion/perfil.controller.js';
import { FotografiasController, SERVICIO_FOTOGRAFIAS } from '../modulos/usuarios-acceso/presentacion/fotografias.controller.js';
import { EvaluarAcceso } from '../modulos/usuarios-acceso/aplicacion/evaluar-acceso.js';
import { ApiUsuariosAcceso } from '../modulos/usuarios-acceso/api-publica.js';
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
import {RepositorioCambiosCorreoPostgres} from '../modulos/usuarios-acceso/infraestructura/persistencia/repositorio-cambios-correo.js';
import {ReautenticarSesion} from '../modulos/usuarios-acceso/aplicacion/reautenticar-sesion.js';
import {SolicitarCambioCorreo} from '../modulos/usuarios-acceso/aplicacion/solicitar-cambio-correo.js';
import {ConfirmarCambioCorreo} from '../modulos/usuarios-acceso/aplicacion/confirmar-cambio-correo.js';
import {CorreoController,SERVICIOS_CORREO} from '../modulos/usuarios-acceso/presentacion/correo.controller.js';
import {ReautenticacionController,REAUTENTICAR} from '../modulos/usuarios-acceso/presentacion/reautenticacion.controller.js';
import { ESTADO_SALUD, SaludController } from '../compartido/infraestructura/http/salud.controller.js';

export async function crearAplicacion(config: Configuracion, opciones: { worker?: boolean; registrarDiagnostico?: (linea: string) => void } = {}) {
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
  const consentimientos = new RepositorioConsentimientosPostgres(uow,new HuellasTelefonoHmac(config.hmac,config.hmacId));
  const cuentas = new RepositorioCuentasPostgres(db, uow, consentimientos);
  const perfiles = new RepositorioPerfilPostgres(uow);
  const serviciosPerfil = { consultar:new ConsultarPerfil(cuentas,lector,uow,reloj),actualizar:new ActualizarPerfil(cuentas,perfiles,consentimientos,fotos,idempotencia,lector,reloj) };
  const evaluarAcceso=new EvaluarAcceso(lector);const usuariosAcceso=new ApiUsuariosAcceso(evaluarAcceso,serviciosPerfil.consultar);
  const servicioFotografias = new Fotografias(cuentas,fotos,idempotencia,lector,reloj);
  const registrar = new RegistrarCuenta(cuentas, idempotencia, hash, catalogo, reloj, new SecretosCrypto(), fotos);
  const habilitar = new HabilitarPerfil(cuentas, idempotencia, lector, reloj);
  const sesiones = new RepositorioSesionesPostgres(db, uow); const secretos = new SecretosCrypto(); const csrf = new CsrfHmac(config.hmac, config.hmacId);
  const serviciosSesion = {
    iniciar: new IniciarSesion(cuentas, sesiones, uow, hash, reloj, secretos, csrf),
    renovar: new RenovarSesion(sesiones, uow, reloj, secretos, csrf),
    csrf: new ObtenerCsrf(sesiones, uow, reloj, secretos, csrf),
    cerrar: new CerrarSesion(sesiones, uow, reloj, secretos, lector), origen: config.origen,
  };
  const recuperaciones = new RepositorioRecuperacionesPostgres(db, uow); const plantillas = new PlantillasSeguridad(config.urlPublica);
  const cambiosCorreo=new RepositorioCambiosCorreoPostgres(db,uow);
  const reautenticar=new ReautenticarSesion(cuentas,sesiones,cambiosCorreo,lector,uow,hash,reloj);
  const serviciosCorreo={solicitar:new SolicitarCambioCorreo(cuentas,sesiones,cambiosCorreo,lector,idempotencia,reloj,secretos,notificaciones,plantillas),confirmar:new ConfirmarCambioCorreo(cuentas,cambiosCorreo,lector,idempotencia,reloj,secretos)};
  const serviciosRecuperacion = {
    solicitar: new SolicitarRecuperacion(cuentas, recuperaciones, uow, reloj, secretos, notificaciones, plantillas),
    consumir: new ConsumirRecuperacion(cuentas, recuperaciones, sesiones, idempotencia, reloj, secretos, hash, catalogo, notificaciones, plantillas),
  };
  const salud = { disponible: async () => {
    try {
      await conectar();
      const tablas: { lista: boolean }[] = await db.query("SELECT count(*)=9 AS lista FROM unnest(ARRAY['usuarios','perfiles_habilitados','sesiones','claves_idempotencia','avisos_pendientes','fotografias_perfil','recuperaciones_acceso','consentimientos_telefono','cambios_correo']) t WHERE to_regclass(t) IS NOT NULL");
      return tablas[0]?.lista === true && await catalogo.preparada();
    } catch { return false; }
  } };
  let limpiando = false;
  const limpieza = opciones.worker === false ? undefined : setInterval(() => {
    if (!limpiando) { limpiando = true; void limpiarTemporales(db, fotos).catch(() => undefined).finally(() => { limpiando = false; }); }
  }, 60000);
  limpieza?.unref();
  const cerrar = async () => { if (limpieza) clearInterval(limpieza); await worker.detener(); smtp.cerrar(); cliente.destroy(); if (db.isInitialized) await db.destroy(); };
  @Module({ controllers: [CorreoController,ReautenticacionController,SaludController, RegistroController, SesionesController, RecuperacionController, PerfilController, FotografiasController], providers: [{provide:SERVICIOS_CORREO,useValue:serviciosCorreo},{provide:REAUTENTICAR,useValue:reautenticar},{ provide: SERVICIOS_PERFIL, useValue: serviciosPerfil }, { provide: SERVICIO_FOTOGRAFIAS, useValue: servicioFotografias }, { provide: SERVICIOS_RECUPERACION, useValue: serviciosRecuperacion }, { provide: SERVICIOS_SESION, useValue: serviciosSesion }, { provide: REGISTRAR_CUENTA, useValue: registrar }, { provide: HABILITAR_PERFIL, useValue: habilitar }, { provide: ESTADO_SALUD, useValue: salud }, { provide: 'cierre-fundacion', useValue: { onModuleDestroy: cerrar } }] })
  class AppModule {}
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false, abortOnError: false });
  await configurarApi(app, { origen: config.origen, contrato: config.contrato, ...(opciones.registrarDiagnostico ? { registrarDiagnostico: opciones.registrarDiagnostico } : {}) });
  app.useGlobalGuards(new GuardSesion(lector, app.get(Reflector)));
  app.enableShutdownHooks();
  await app.init();
  if (opciones.worker !== false) worker.iniciar();
  return { app, db, catalogo, uow, reloj, hash, idempotencia, notificaciones, cifrado, smtp, worker, fotos, lector, cuentas, sesiones, serviciosSesion, recuperaciones, serviciosRecuperacion, consentimientos, perfiles, serviciosPerfil, servicioFotografias, usuariosAcceso, evaluarAcceso, cambiosCorreo, serviciosCorreo, reautenticar };
}
