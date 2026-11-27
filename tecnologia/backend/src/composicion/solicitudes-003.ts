import type { Provider, Type } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { Idempotencia002 } from '../compartido/aplicacion/idempotencia.js';
import type { UnidadDeTrabajoPostgres } from '../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { conTraduccionBd } from '../compartido/infraestructura/postgres/traduccion-errores.js';
import type { ClasificacionesEfectivas, ElegibilidadServicio, RevisionDeOferta } from '../modulos/catalogo/api-publica.js';
import { CategoriasDeOfertaPostgres } from '../modulos/catalogo/infraestructura/persistencia/categorias-de-oferta.js';
import { ApiCotizaciones } from '../modulos/cotizaciones/api-publica.js';
import { AutoriaPostgres } from '../modulos/cotizaciones/infraestructura/persistencia/autoria.js';
import { AvisosNegocioPostgres } from '../modulos/notificaciones/infraestructura/avisos-negocio.js';
import type { LecturasDePrestadores, PrestadoresApi } from '../modulos/prestadores/api-publica.js';
import type { UsuariosAcceso } from '../modulos/usuarios-acceso/api-publica.js';
import { ArchivosSolicitudServicio } from '../modulos/solicitudes/aplicacion/archivos-solicitud.js';
import { OportunidadesServicio } from '../modulos/solicitudes/aplicacion/oportunidades.js';
import type { AlmacenArchivosSolicitud, SaneadorImagenSolicitud } from '../modulos/solicitudes/aplicacion/puertos/archivos.js';
import { SolicitudesServicio } from '../modulos/solicitudes/aplicacion/solicitudes.js';
import { traducirCondicionSolicitudes } from '../modulos/solicitudes/dominio/errores.js';
import { LimpiezaSolicitudes, type OpcionesDeLimpieza, limpiezaPorOmision } from '../modulos/solicitudes/infraestructura/archivos/limpieza-solicitudes.js';
import { SaneadorSharpSolicitudes } from '../modulos/solicitudes/infraestructura/archivos/sanear-imagen.js';
import { RepositorioArchivosPostgres } from '../modulos/solicitudes/infraestructura/persistencia/archivos.js';
import { RepositorioOportunidadesPostgres } from '../modulos/solicitudes/infraestructura/persistencia/oportunidades.js';
import { RepositorioSolicitudesPostgres } from '../modulos/solicitudes/infraestructura/persistencia/solicitudes.js';
import { ARCHIVOS_SOLICITUD_003, OPORTUNIDADES_003, SOLICITUDES_003, SolicitudesController } from '../modulos/solicitudes/presentacion/solicitudes.controller.js';
import { CLASIFICACIONES_EFECTIVAS_002, IDEMPOTENCIA_002, REVISION_OFERTA_002, UNIDAD_DE_TRABAJO_002, USUARIOS_ACCESO_002 } from './app.module.js';
import { ELEGIBILIDAD_SERVICIO_002, PRESTADORES_API_002 } from './servicios-002.js';

/** Operaciones de HU07 y HU08 disponibles en el modo de prueba. */
export const operacionesSolicitudes003 = [
  'crearSolicitud003', 'listarMisSolicitudes003', 'obtenerSolicitud003', 'editarSolicitud003', 'publicarSolicitud003', 'cerrarSolicitud003',
  'consultarHistorialSolicitud003', 'cargarArchivoSolicitud003', 'obtenerArchivoSolicitud003',
  'listarOportunidades003',
] as const;

export interface OpcionesSolicitudes003 {
  /** Almacén de los archivos sobre el bucket único con el prefijo `solicitudes/`. */
  readonly almacen: AlmacenArchivosSolicitud;
  readonly saneador?: SaneadorImagenSolicitud;
  readonly ahora?: () => Date;
}

const REPOSITORIO_SOLICITUDES_003 = Symbol('Repositorio de solicitudes de 003');
const REPOSITORIO_ARCHIVOS_003 = Symbol('Repositorio de archivos de solicitudes de 003');
const COTIZACIONES_003 = Symbol('Lecturas de autoría de Cotizaciones para Solicitudes');
const AVISOS_NEGOCIO_003 = Symbol('Registro de avisos de negocio');
const traducirEscritura = <T>(trabajo: () => Promise<T>) => conTraduccionBd(traducirCondicionSolicitudes, trabajo);

/**
 * Registro explícito de HU07 y HU08. La aplicación comprueba al arrancar que la ruta literal preceda a `solicitudes/:solicitudId`.
 * Los puertos de Solicitudes hacia Cotizaciones (interesados y autoría) se conectan aquí con las lecturas reales de `cotizaciones/api-publica`.
 */
export function registroSolicitudes003(opciones: OpcionesSolicitudes003): {
  readonly controladores: readonly Type[]; readonly proveedores: readonly Provider[]; readonly operaciones: readonly string[];
} {
  const proveedores: Provider[] = [
    { provide: REPOSITORIO_SOLICITUDES_003, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new RepositorioSolicitudesPostgres(uow) },
    { provide: REPOSITORIO_ARCHIVOS_003, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new RepositorioArchivosPostgres(uow) },
    { provide: COTIZACIONES_003, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new ApiCotizaciones(new AutoriaPostgres(uow)) },
    { provide: AVISOS_NEGOCIO_003, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new AvisosNegocioPostgres(uow) },
    { provide: OPORTUNIDADES_003, inject: [UNIDAD_DE_TRABAJO_002, PRESTADORES_API_002, COTIZACIONES_003],
      useFactory: (uow: UnidadDeTrabajoPostgres, prestadores: PrestadoresApi & LecturasDePrestadores, cotizaciones: ApiCotizaciones) =>
        new OportunidadesServicio(new RepositorioOportunidadesPostgres(uow), prestadores, new CategoriasDeOfertaPostgres(uow), {
          tieneNoRetirada: (s, c, tx) => cotizaciones.tieneNoRetirada(s, c, tx),
          solicitudesConNoRetirada: (c, tx) => cotizaciones.solicitudesConCotizacionNoRetirada(c, tx),
        }) },
    { provide: SOLICITUDES_003,
      inject: [REPOSITORIO_SOLICITUDES_003, REPOSITORIO_ARCHIVOS_003, IDEMPOTENCIA_002, USUARIOS_ACCESO_002, REVISION_OFERTA_002, CLASIFICACIONES_EFECTIVAS_002, ELEGIBILIDAD_SERVICIO_002, PRESTADORES_API_002, AVISOS_NEGOCIO_003, COTIZACIONES_003, OPORTUNIDADES_003],
      useFactory: (repositorio: RepositorioSolicitudesPostgres, archivos: RepositorioArchivosPostgres, idempotencia: Idempotencia002, usuarios: UsuariosAcceso, revision: RevisionDeOferta,
        clasificaciones: ClasificacionesEfectivas, elegibilidad: ElegibilidadServicio, prestadores: PrestadoresApi & LecturasDePrestadores, avisos: AvisosNegocioPostgres, cotizaciones: ApiCotizaciones, oportunidades: OportunidadesServicio) =>
        new SolicitudesServicio({ repositorio, archivos, almacen: opciones.almacen, idempotencia, usuarios, revision, clasificaciones, elegibilidad, prestadores, avisos, traducirEscritura, oportunidades,
          interesados: { de: (solicitudId, tx) => cotizaciones.autoresNoRetirados(solicitudId, tx) },
          ...(opciones.ahora ? { ahora: opciones.ahora } : {}) }) },
    { provide: ARCHIVOS_SOLICITUD_003,
      inject: [REPOSITORIO_SOLICITUDES_003, REPOSITORIO_ARCHIVOS_003, IDEMPOTENCIA_002, USUARIOS_ACCESO_002, UNIDAD_DE_TRABAJO_002, OPORTUNIDADES_003],
      useFactory: (repositorio: RepositorioSolicitudesPostgres, archivos: RepositorioArchivosPostgres, idempotencia: Idempotencia002, usuarios: UsuariosAcceso, uow: UnidadDeTrabajoPostgres, oportunidades: OportunidadesServicio) =>
        new ArchivosSolicitudServicio({ repositorio, archivos, almacen: opciones.almacen, saneador: opciones.saneador ?? new SaneadorSharpSolicitudes(), idempotencia, unidad: uow, usuarios, traducirEscritura, oportunidades,
          ...(opciones.ahora ? { ahora: opciones.ahora } : {}) }) },
  ];
  return { controladores: [SolicitudesController], proveedores, operaciones: operacionesSolicitudes003 };
}

/**
 * Proceso periódico de limpieza física (FR-322). Idempotente, con reclamo `SKIP LOCKED` y arrendamiento: varias instancias no repiten una clave. Una pasada no se solapa con
 * la siguiente. El temporizador no mantiene vivo el proceso. Devuelve la función que lo detiene.
 */
export function iniciarLimpiezaPeriodica003(db: DataSource, almacen: AlmacenArchivosSolicitud, intervaloSegundos: number, opciones: OpcionesDeLimpieza = limpiezaPorOmision, registrar: (conteos: object) => void = () => undefined): () => Promise<void> {
  const limpieza = new LimpiezaSolicitudes(db, almacen, opciones);
  let pasada: Promise<void> | undefined;
  const temporizador = setInterval(() => {
    if (pasada || !db.isInitialized) return;
    pasada = limpieza.ejecutar().then(c => { if (c.reclamadas) registrar(c); }).catch(() => undefined).finally(() => { pasada = undefined; });
  }, intervaloSegundos * 1000);
  temporizador.unref();
  return async () => { clearInterval(temporizador); await pasada; };
}
