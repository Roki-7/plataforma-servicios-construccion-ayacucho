import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { Solicitud } from '../../dominio/solicitud.js';
import type { TipoBitacora } from '../../dominio/version.js';
import type { EstadoDeArchivo, EstadoSolicitud, TipoSolicitud } from '../../dominio/tipos.js';

export interface PaginaDeFilas<T> { readonly elementos: readonly T[]; readonly total: number }
export type BloqueoDeFila = 'actualizacion' | 'compartido';

export interface ResumenDeFila {
  readonly solicitudId: string; readonly tipo: TipoSolicitud; readonly estado: EstadoSolicitud; readonly categoriaId: string | null; readonly distrito: string | null;
  readonly fechaDesde: string | null; readonly descripcionCorta: string | null; readonly version: number; readonly versionTrabajo: number; readonly actualizadaEn: Date;
  /** Solo con `rol=prestador`: es destinataria de una dirigida. */
  readonly esDestinatario: boolean;
}
export interface ResumenParaOtrosModulos {
  readonly solicitudId: string; readonly tipo: TipoSolicitud; readonly estado: EstadoSolicitud; readonly versionTrabajo: number;
  readonly categoriaId: string | null; readonly distritoCodigo: string | null; readonly prestadorId: string | null;
}
export interface OportunidadDeFila {
  readonly solicitudId: string; readonly tipo: TipoSolicitud; readonly categoriaId: string; readonly distrito: string;
  readonly fechaDesde: string; readonly fechaHasta: string | null; readonly descripcionCorta: string;
  readonly clienteCuentaId: string; readonly prestadorCuentaId: string | null; readonly compartirFotografias: boolean;
  readonly hayFotografias: boolean; readonly versionTrabajo: number; readonly publicadaEn: Date;
}
export interface RepositorioOportunidades {
  listarAbiertas(cuentaId: string, prestadorId: string, categorias: readonly string[], distritos: readonly string[], pagina: number, tamano: number): Promise<PaginaDeFilas<OportunidadDeFila>>;
  listarComoPrestador(cuentaId: string, solicitudesConAutoria: readonly string[], estado: EstadoSolicitud | undefined, pagina: number, tamano: number): Promise<PaginaDeFilas<ResumenDeFila>>;
}
export interface ArchivoDeVersion { readonly archivoId: string; readonly tipoMime: string; readonly bytes: number; readonly ancho: number; readonly alto: number; readonly sha256: string }
export interface NuevaVersion {
  readonly solicitudId: string; readonly numero: number; readonly descripcion: string; readonly medidas: string | null; readonly categoriaId: string; readonly distrito: string;
  readonly fechaDesde: string; readonly fechaHasta: string | null; readonly archivos: readonly ArchivoDeVersion[]; readonly creadaPorCuentaId: string;
}
export interface VersionGuardada extends Omit<NuevaVersion, 'creadaPorCuentaId'> { readonly creadaEn: Date }
export interface NuevaBitacora {
  readonly solicitudId: string; readonly actorCuentaId: string; readonly tipo: TipoBitacora; readonly version: number; readonly versionTrabajo: number; readonly camposCambiados: readonly string[];
}
export interface EntradaGuardada extends NuevaBitacora { readonly entradaId: string; readonly ocurridaEn: Date }

/** Persistencia de Solicitudes. Solo tablas propias; nunca consulta tablas de otro módulo. Con `tx` participa en la unidad de trabajo del llamador. */
export interface RepositorioSolicitudes {
  obtener(id: string, tx?: ContextoTransaccion, bloqueo?: BloqueoDeFila): Promise<Solicitud | null>;
  crear(tx: ContextoTransaccion, solicitud: Solicitud): Promise<void>;
  /** Escribe el estado completo vigente (los campos inmutables tras publicar no cambian: lo exigen el dominio y un disparador). */
  guardar(tx: ContextoTransaccion, solicitud: Solicitud): Promise<void>;
  insertarVersion(tx: ContextoTransaccion, version: NuevaVersion): Promise<void>;
  insertarBitacora(tx: ContextoTransaccion, entrada: NuevaBitacora): Promise<void>;
  /** Lectura masiva (UNA sentencia) de los campos que otros módulos pueden conocer. Omite las inexistentes. */
  resumenes(ids: readonly string[], tx?: ContextoTransaccion): Promise<readonly ResumenParaOtrosModulos[]>;
  /** Cuenta del cliente dueño, o `null` si la solicitud no existe. */
  clienteDe(id: string, tx?: ContextoTransaccion): Promise<string | null>;
  listarComoCliente(cuentaId: string, estado: EstadoSolicitud | undefined, pagina: number, tamano: number): Promise<PaginaDeFilas<ResumenDeFila>>;
  versiones(solicitudId: string, pagina: number, tamano: number): Promise<PaginaDeFilas<VersionGuardada>>;
  bitacora(solicitudId: string, pagina: number, tamano: number): Promise<PaginaDeFilas<EntradaGuardada>>;
}

export interface ArchivoGuardado {
  readonly id: string; readonly solicitudId: string; readonly estado: EstadoDeArchivo; readonly objetoClave: string;
  readonly bytes: number; readonly ancho: number; readonly alto: number; readonly checksum: Uint8Array; readonly creadoEn: Date; readonly caducaEn: Date | null;
}
export interface NuevoArchivo { readonly id: string; readonly solicitudId: string; readonly objetoClave: string; readonly bytes: number; readonly ancho: number; readonly alto: number; readonly checksum: Uint8Array; readonly caducaEn: Date }
export interface ResultadoDeConfirmacion { readonly confirmados: readonly string[]; readonly quitados: readonly string[]; /** Claves de los objetos quitados, para intentar su borrado físico tras confirmar la transacción. */ readonly clavesAPurgar: readonly string[] }

/** Persistencia de archivos de solicitudes y de su cola de limpieza física. Toda baja lógica deja una entrada de purga en la misma transacción. */
export interface RepositorioArchivos {
  /** Descarta los PREPARANDO y PREPARADO caducados de la solicitud y programa su purga. Se llama dentro de la transacción que evalúa el cupo. */
  caducar(tx: ContextoTransaccion, solicitudId: string): Promise<number>;
  /** Archivos visibles de la solicitud: CONFIRMADO y PREPARADO no caducados, en orden de carga. */
  listarVisibles(solicitudId: string, tx?: ContextoTransaccion): Promise<readonly ArchivoGuardado[]>;
  porIds(ids: readonly string[], tx?: ContextoTransaccion): Promise<readonly ArchivoGuardado[]>;
  porId(id: string, tx?: ContextoTransaccion): Promise<ArchivoGuardado | null>;
  /** Registra el archivo como PREPARANDO, con su entrada `PREPARACION` que vence a las 24 horas. El disparador de contadores aplica el cupo. */
  reservar(tx: ContextoTransaccion, archivo: NuevoArchivo): Promise<void>;
  marcarPreparado(tx: ContextoTransaccion, id: string): Promise<void>;
  /** PREPARANDO → DESCARTADO, con su purga inmediata. */
  descartarPreparacion(tx: ContextoTransaccion, id: string): Promise<void>;
  aplicarConfirmacion(tx: ContextoTransaccion, solicitudId: string, confirmar: readonly string[], quitar: readonly string[]): Promise<ResultadoDeConfirmacion>;
  /** Descarta los archivos no confirmados al cerrar una solicitud. Devuelve las claves a eliminar. */
  descartarNoConfirmados(tx: ContextoTransaccion, solicitudId: string): Promise<readonly string[]>;
  /** Quita la entrada de limpieza de una clave cuyo objeto ya se eliminó. */
  completarPurga(clave: string): Promise<void>;
}
/** Traducción de condiciones de escritura que deben conservar su error de negocio al revertir la transacción. */
export type TraducirEscrituraSolicitud = <T>(trabajo: () => Promise<T>) => Promise<T>;
