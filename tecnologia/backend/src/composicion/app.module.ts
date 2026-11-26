import { Module } from '@nestjs/common';
import type { INestApplication, Provider, Type } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { S3Client } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Configuracion } from './configuracion.js';
import { persistencia002, persistencia003, persistenciaFundacional, type RegistroPersistencia002 } from './persistencia.js';
import { componerExtensiones, inventarioOpenApi, type DocumentoOpenApi } from './componer-openapi.js';
import { GuardIdentidad002 } from './identidad-002.js';
import { RevisionDeOfertaPostgres } from '../modulos/catalogo/infraestructura/persistencia/revision-de-oferta.js';
import { ProyeccionPublicaPostgres } from '../modulos/catalogo/infraestructura/persistencia/proyeccion-publica.js';
import { ClasificacionesEfectivasPostgres } from '../modulos/catalogo/infraestructura/persistencia/clasificaciones-efectivas.js';
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
import { CambiarContrasena } from '../modulos/usuarios-acceso/aplicacion/cambiar-contrasena.js';
import { CAMBIAR_CONTRASENA, ContrasenaController } from '../modulos/usuarios-acceso/presentacion/contrasena.controller.js';
import { ESTADO_SALUD, SaludController } from '../compartido/infraestructura/http/salud.controller.js';

interface RegistroHttp002 {
  readonly controladores: readonly Type[];
  readonly proveedores?: readonly Provider[];
  readonly persistencia?: readonly RegistroPersistencia002[];
}
type Composicion002 = RegistroHttp002 & ({ modo: 'completa' } | { modo: 'prueba'; operaciones: readonly string[] });
/** Misma forma que la extensión de la 002: una extensión de la 003 solo se admite sobre la composición de la 002. */
type Composicion003 = Composicion002;
type Opciones = { worker?: boolean; registrarDiagnostico?: (linea: string) => void; registrar?: (linea: string) => void; oferta002?: Composicion002; oferta003?: Composicion003 };
export const USUARIOS_ACCESO_002 = Symbol('UsuariosAcceso público para 002');
export const UNIDAD_DE_TRABAJO_002 = Symbol('Unidad de trabajo compartida de 002');
export const REVISION_OFERTA_002 = Symbol('Revisión de oferta de Catálogo');
export const PROYECCION_PUBLICA_002 = Symbol('Proyección pública de Catálogo');
export const IDEMPOTENCIA_002 = Symbol('Idempotencia transaccional de 002');
export const CLASIFICACIONES_EFECTIVAS_002 = Symbol('Clasificaciones efectivamente activas de Catálogo');

/** Extensiones de contrato admitidas, en el orden de composición. El inventario esperado protege contra un activo OpenAPI cambiado por error. */
const extensionesDeContrato = [
  { etiqueta: '002', archivo: 'prestadores-catalogo.openapi.json', esperadas: 23 },
  { etiqueta: '003', archivo: 'solicitudes-cotizaciones.openapi.json', esperadas: 18 },
] as const;

async function contratoDeOferta(contrato001: string, registros: readonly [Composicion002, Composicion003 | undefined]) {
  const base: DocumentoOpenApi = JSON.parse(await readFile(contrato001, 'utf8'));
  if (inventarioOpenApi(base).length !== 17) throw new Error('Inventario de los activos OpenAPI incompatible.');
  const documentos: DocumentoOpenApi[] = []; const propias = new Set<string>(); const ids = new Set<string>();
  for (const [indice, extension] of extensionesDeContrato.entries()) {
    const registro = registros[indice];
    if (!registro) continue;
    const documento: DocumentoOpenApi = JSON.parse(await readFile(resolve(contrato001, '..', extension.archivo), 'utf8'));
    const inventario = inventarioOpenApi(documento);
    if (inventario.length !== extension.esperadas) throw new Error('Inventario de los activos OpenAPI incompatible.');
    const seleccionadas = registro.modo === 'completa' ? inventario.map(({ operacion }) => operacion.operationId) : registro.operaciones;
    const propios = new Set(inventario.map(({ operacion }) => operacion.operationId));
    const elegidas = new Set(seleccionadas);
    if (!elegidas.size || elegidas.size !== seleccionadas.length || seleccionadas.some(id => !propios.has(id))) throw new Error(`Subconjunto ${extension.etiqueta} vacío, duplicado o desconocido.`);
    documentos.push(documento);
    for (const id of propios) propias.add(id);
    for (const id of elegidas) ids.add(id);
  }
  const contrato = componerExtensiones(base, documentos);
  const paths = new Map<string, DocumentoOpenApi['paths'][string]>();
  for (const { metodo, ruta, operacion } of inventarioOpenApi(contrato)) {
    if (propias.has(operacion.operationId) && !ids.has(operacion.operationId)) continue;
    paths.set(ruta, { ...paths.get(ruta), [metodo]: operacion });
  }
  return { contrato: { ...contrato, paths: Object.fromEntries(paths) }, ids };
}

function verificarRouter(app: INestApplication, contrato: DocumentoOpenApi): void {
  const instancia = app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } };
  const registradas = instancia.router.stack.flatMap(({ route }) => route ? Object.keys(route.methods).map(metodo => ({
    metodo, ruta: route.path.replace(/^\/api\/v1/, '').replace(/:([\w]+)/g, '{$1}'),
  })) : []);
  const claves = (rutas: { metodo: string; ruta: string }[]) => rutas.map(({ metodo, ruta }) => `${metodo} ${ruta}`).sort();
  if (JSON.stringify(claves(registradas)) !== JSON.stringify(claves(inventarioOpenApi(contrato)))) throw new Error('El router no coincide con las operaciones seleccionadas.');
  // Express atiende la primera ruta compatible. Detectar controladores montados en orden incorrecto.
  for (const [i, { metodo, ruta }] of registradas.entries()) {
    const partes = ruta.split('/');
    if (registradas.slice(i + 1).some(otra => {
      if (otra.metodo !== metodo) return false;
      const destino = otra.ruta.split('/');
      return partes.length === destino.length && partes.some((p, j) => p.startsWith('{') && !destino[j]?.startsWith('{')) &&
        partes.every((p, j) => p.startsWith('{') || p === destino[j]);
    })) throw new Error('Una ruta parametrizada oculta una ruta literal en Nest.');
  }
}

export async function crearAplicacion(config: Configuracion, opciones: Opciones = {}) {
  const registro = opciones.oferta002; const registro003 = opciones.oferta003;
  if (registro003 && !registro) throw new Error('La extensión 003 requiere la composición de la 002.');
  const oferta = registro ? await contratoDeOferta(config.contrato, [registro, registro003]) : undefined;
  const db = !registro ? persistenciaFundacional(config.databaseUrl)
    : registro003 ? persistencia003(config.databaseUrl, registro.persistencia, registro003.persistencia) : persistencia002(config.databaseUrl, registro.persistencia);
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
  const cambiarContrasena = new CambiarContrasena(cuentas, lector, idempotencia, hash, catalogo, reloj);
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
  const proveedores002: Provider[] = registro ? [
    ...(registro.proveedores ?? []), ...(registro003?.proveedores ?? []),
    { provide: USUARIOS_ACCESO_002, useValue: usuariosAcceso },
    { provide: UNIDAD_DE_TRABAJO_002, useValue: uow },
    { provide: REVISION_OFERTA_002, useValue: new RevisionDeOfertaPostgres(uow) },
    { provide: PROYECCION_PUBLICA_002, useValue: new ProyeccionPublicaPostgres(uow) },
    { provide: IDEMPOTENCIA_002, useValue: idempotencia },
    { provide: CLASIFICACIONES_EFECTIVAS_002, useValue: new ClasificacionesEfectivasPostgres(uow) },
  ] : [];
  @Module({ controllers: [ContrasenaController, CorreoController,ReautenticacionController,SaludController, RegistroController, SesionesController, RecuperacionController, PerfilController, FotografiasController, ...(registro?.controladores ?? []), ...(registro003?.controladores ?? [])], providers: [{ provide: CAMBIAR_CONTRASENA, useValue: cambiarContrasena }, {provide:SERVICIOS_CORREO,useValue:serviciosCorreo},{provide:REAUTENTICAR,useValue:reautenticar},{ provide: SERVICIOS_PERFIL, useValue: serviciosPerfil }, { provide: SERVICIO_FOTOGRAFIAS, useValue: servicioFotografias }, { provide: SERVICIOS_RECUPERACION, useValue: serviciosRecuperacion }, { provide: SERVICIOS_SESION, useValue: serviciosSesion }, { provide: REGISTRAR_CUENTA, useValue: registrar }, { provide: HABILITAR_PERFIL, useValue: habilitar }, { provide: ESTADO_SALUD, useValue: salud }, { provide: 'cierre-fundacion', useValue: { onModuleDestroy: cerrar } }, ...proveedores002] })
  class AppModule {}
  let creada: INestApplication | undefined;
  const app = await (async () => {
    try {
      creada = await NestFactory.create(AppModule, { logger: false, bodyParser: false, abortOnError: false });
      await configurarApi(creada, { origen: config.origen, contrato: oferta?.contrato ?? config.contrato,
        ...(oferta ? { operaciones002: oferta.ids } : {}), ...(opciones.registrar ? { registrar: opciones.registrar } : {}),
        ...(opciones.registrarDiagnostico ? { registrarDiagnostico: opciones.registrarDiagnostico } : {}) });
      const sesionBase = new GuardSesion(lector, creada.get(Reflector));
      creada.useGlobalGuards(oferta ? new GuardIdentidad002(usuariosAcceso, sesionBase) : sesionBase);
      creada.enableShutdownHooks();
      await creada.init();
      if (oferta) verificarRouter(creada, oferta.contrato);
      return creada;
    } catch (error) {
      if (creada) await creada.close();
      else await cerrar();
      throw error;
    }
  })();
  if (opciones.worker !== false) worker.iniciar();
  return { app, db, catalogo, uow, reloj, hash, idempotencia, notificaciones, cifrado, smtp, worker, fotos, lector, cuentas, sesiones, serviciosSesion, recuperaciones, serviciosRecuperacion, consentimientos, perfiles, serviciosPerfil, servicioFotografias, usuariosAcceso, evaluarAcceso, cambiosCorreo, serviciosCorreo, reautenticar };
}
