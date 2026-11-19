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
export interface OfertaPublica {
  serviciosVisiblesDe(prestadorId: string, pagina: number, tamano: number): Promise<import('./aplicacion/puertos/consultas-publicas.js').PaginaDto<import('./aplicacion/puertos/consultas-publicas.js').ServicioPublicoDto>>;
}
