import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';

export type { Clasificacion, DistritoCodigo } from './dominio/clasificacion.js';
export type { ProyeccionPublica, ProyeccionPrestador } from './aplicacion/puertos/proyeccion-publica.js';

export interface RevisionDeOferta {
  vigente(tx?: ContextoTransaccion): Promise<bigint>;
  bloquear(tx: ContextoTransaccion, modo: 'compartido' | 'exclusivo'): Promise<bigint>;
  incrementar(tx: ContextoTransaccion): Promise<bigint>;
}

// Dentro de cada nivel, adquirir las filas por identificador.
export const ordenBloqueosOferta = ['permiso-rf39', 'idempotencia', 'revision-oferta', 'clasificacion-raiz',
  'subcategoria', 'servicio', 'perfil', 'trabajo'] as const;

export { distritosCanonicos } from './dominio/clasificacion.js';

/** Contrato interno para validar clasificaciones declaradas. Resuelve la actividad efectiva con su jerarquía. */
export interface ClasificacionesEfectivas {
  efectivamenteActivas(tx: ContextoTransaccion, ids: readonly string[]): Promise<ReadonlySet<string>>;
}

export type { EstadoServicio } from './dominio/servicio.js';
export interface RegistroServicio {
  readonly servicioId: string; readonly prestadorId: string; readonly categoriaId: string;
  readonly titulo: string; readonly descripcion: string; readonly estado: 'PUBLICADO' | 'PAUSADO' | 'RETIRADO'; readonly version: number;
}
export interface EvaluacionElegibilidad {
  readonly servicioId: string;
  readonly elegible: boolean;
  /** Presente solo cuando no es elegible. */
  readonly motivo?: 'NO_EXISTE' | 'ESTADO_NO_PUBLICADO' | 'CLASIFICACION_INACTIVA';
}
/** Contrato interno para Solicitudes (003) y otros procesos autorizados. No registra rutas HTTP. */
export interface ElegibilidadServicio {
  /** Con `tx` toma el bloqueo compartido de la revisión de Catálogo hasta el commit del llamador. Sin `tx` lee el estado vigente. */
  evaluar(servicioId: string, tx?: ContextoTransaccion): Promise<EvaluacionElegibilidad>;
  /** Registro histórico en cualquier estado, incluido RETIRADO. Devuelve `null` si el identificador no existe. */
  registro(servicioId: string, tx?: ContextoTransaccion): Promise<RegistroServicio | null>;
}

export type { ServicioPublicoDto, PaginaDto } from './aplicacion/puertos/consultas-publicas.js';
/** Oferta visible de un prestador para su perfil público. Solo servicios PUBLICADO con clasificación efectivamente activa. */
/** Clasificación vista por la gestión autorizada (RF39). Nunca incluye datos de cuentas. */
export interface ClasificacionAdmin {
  readonly categoriaId: string; readonly categoriaPadreId: string | null; readonly nombre: string;
  readonly activaPropia: boolean; readonly activaEfectiva: boolean; readonly version: number;
}
export interface ClasificacionPublica { readonly categoriaId: string; readonly categoriaPadreId: string | null; readonly nombre: string }
export interface PrevisualizacionDesactivacion { readonly confirmacionId: string; readonly afectados: number; readonly venceEn: string }
/**
 * API interna para Administración. Cada mutación exige una transacción abierta por el llamador, que ya tomó el permiso RF39 y la idempotencia.
 * Catálogo toma después la revisión exclusiva, la raíz y la subcategoría. No audita ni autoriza.
 */
export interface GestionClasificaciones {
  listarAdmin(): Promise<readonly ClasificacionAdmin[]>;
  listarPublicas(): Promise<readonly ClasificacionPublica[]>;
  crear(tx: ContextoTransaccion, entrada: { nombre: unknown; padreId?: string | null }): Promise<ClasificacionAdmin>;
  editar(tx: ContextoTransaccion, id: string, version: number, nombre: unknown): Promise<ClasificacionAdmin>;
  activar(tx: ContextoTransaccion, id: string, version: number): Promise<ClasificacionAdmin>;
  previsualizarDesactivacion(tx: ContextoTransaccion, id: string, version: number, actorCuentaId: string): Promise<PrevisualizacionDesactivacion>;
  desactivar(tx: ContextoTransaccion, id: string, version: number, confirmacionId: string, actorCuentaId: string): Promise<ClasificacionAdmin>;
}

export interface OfertaPublica {
  serviciosVisiblesDe(prestadorId: string, pagina: number, tamano: number): Promise<import('./aplicacion/puertos/consultas-publicas.js').PaginaDto<import('./aplicacion/puertos/consultas-publicas.js').ServicioPublicoDto>>;
}
